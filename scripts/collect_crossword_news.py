#!/usr/bin/env python3
"""RSS -> candidate crossword clues. No article body retrieval. Stdlib only.
Daily quotas refer to articles USED; requests capped at one feed fetch per source/run.
Historical runs require archive-capable feeds or an explicit local snapshot CSV.
"""
import argparse,csv,datetime as dt,email.utils,html,json,pathlib,re,ssl,sys,urllib.error,urllib.request,xml.etree.ElementTree as ET,unicodedata
from zoneinfo import ZoneInfo
ROME=ZoneInfo('Europe/Rome')
STOP=set('il lo la i gli le un uno una del dello della dei degli delle di da a ad con su per tra fra nel nello nella nei negli nelle che ed e o al allo alla ai agli alle si se non sul sulla sono era dopo prima oggi nuova nuovo nuove nuovi come anche sulla sui agli allo nel suo sua suoi sue alla dal dalle nel loro oltre contro ieri piu fa'.split())
UA='MRC-Crossword/1.0 (RSS headline indexing; attribution to original source)'
def normalized(word):
 s=''.join(c for c in unicodedata.normalize('NFKD',word) if not unicodedata.combining(c))
 return re.sub(r'[^A-Z]','',s.upper())
def parseinstant(value):
 try:stamp=email.utils.parsedate_to_datetime(value)
 except (ValueError,TypeError,OverflowError,AttributeError):
  try:stamp=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
  except (ValueError,TypeError):return None
 if stamp.tzinfo is None:stamp=stamp.replace(tzinfo=ROME)
 return stamp.astimezone(ROME)
def parsedate(value):
 stamp=parseinstant(value)
 return stamp.date() if stamp else None
def localname(tag):return tag.rsplit('}',1)[-1]
def child(node, tag):
 for x in node:
  if localname(x.tag)==tag:return (x.text or '').strip()
 return ''
def discard(audit,reason):
 audit['discarded_articles']+=1
 reasons=audit['discard_reasons'];reasons[reason]=reasons.get(reason,0)+1
def entries(payload,include_summary=False,include_instant=False,diagnostics=None):
 root=ET.fromstring(payload)
 for node in root.iter():
  if localname(node.tag) not in ('item','entry'):continue
  title=html.unescape(re.sub('<[^>]+>','',child(node,'title')))
  url=child(node,'link')
  if not url:
   for elem in node:
    if localname(elem.tag)=='link' and elem.attrib.get('href'):
     url=elem.attrib['href'];break
  pub=child(node,'pubDate') or child(node,'published') or child(node,'updated')
  instant=parseinstant(pub)
  if diagnostics is not None:
   diagnostics['fetched_articles']+=1
   if instant is not None:diagnostics['valid_date_articles']+=1
  summary=html.unescape(re.sub('<[^>]+>',' ',child(node,'description') or child(node,'summary') or child(node,'encoded')))
  summary=' '.join(summary.split())[:6000]
  if title and url.startswith('https://'):
   yield (title,url,instant,summary) if include_instant else ((title,url,instant.date() if instant else None,summary) if include_summary else (title,url,instant.date() if instant else None))
  elif diagnostics is not None:discard(diagnostics,'missing_title' if not title else 'missing_or_non_https_link')

def summary_candidates(title,summary,source,link,date):
 # Evidence-bound proposals from explicit relations, not free headline tokens.
 # No LLM, external API or additional article request. Publication remains gated.
 text=' '.join(summary.split())
 if re.search(r'\b(non|forse|potrebbe|avrebbe|dovrebbe)\b',text,re.I):return
 proposals=[]
 mission=re.search(r'(?:Lo scorso )?(?P<day>\d{1,2} [a-zà]+) la missione (?P<name>[A-Z][A-Za-z-]{2,14}) ha (?:iniziato|avviato)(?: ufficialmente)? la sua attività scientifica',text)
 if mission:
  name=mission['name']
  proposals.append((normalized(name),f'La missione entrata nella fase scientifica il {mission["day"]}, secondo la notizia del {date.strftime("%d/%m")}', 'mission-science-start'))
  if 'effetti del vento solare sulla magnetosfera terrestre' in text:
   proposals.append(('MAGNETOSFERA',f'La regione studiata per gli effetti del vento solare da {name}, entrata in fase scientifica il {mission["day"]}','mission-target'))
 discovery=re.search(r'Sono (?P<count>tre|due|quattro) (?P<kind>galassie|stelle|comete|nebulose) (?P<detail>[^,.!?]{5,70})[,.!?]',text)
 person=re.search(r'A scoprir(?:le|li),?.{0,150}?è stato (?P<name>[A-ZÀ-Ö][a-zà-öø-ÿ]+(?: [A-ZÀ-Ö][a-zà-öø-ÿ]+){1,2}),',text)
 if discovery and person:
  name=person['name'];obj=f'{discovery["count"]} {discovery["kind"]} {discovery["detail"]}'.strip()
  if not re.search(r'\b(non|forse|possibili|candidate)\b',obj,re.I):
   proposals.append((normalized(name.split()[-1]),f'Il cognome di chi ha individuato {obj}, nella ricerca descritta dalla fonte','discovery-author'))
   proposals.append((normalized(discovery['kind']),f'{discovery["detail"].capitalize()}: ne ha individuate {discovery["count"]} {name}', 'discovery-object'))
 seen=set()
 for word,clue,rule in proposals:
  if word in seen or not re.fullmatch('[A-Z]{3,15}',word) or not 12<=len(clue)<=250:continue
  if any(normalized(token)==word for token in re.findall(r'[\wÀ-ÿ]+',clue)):continue
  seen.add(word)
  yield {'word':word,'clue_it':clue,'source_name':source,'source_url':link,
         'published_at':date.isoformat(),'source_title':title,'language':'it','reviewed':'no','rule':rule}
def candidates(title,source,cat,link,date):
 # Only explicit Italian subject/event relations. Unknown titles yield no clue.
 # These are editorial proposals, NEVER automatically verified news.
 title=' '.join(title.split())
 name=r"(?P<subject>[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?: [A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+){1,3})"
 rules=[
  (name+r"(?: con [\"“][^\"”]{1,80}[\"”])? vince (?:il |la |l’|l')(?P<event>[^.!?]+)",
   "Il cognome di chi ha conquistato {event}"),
  (name+r" riceve (?:il |la |l’|l')(?P<event>[^.!?]+)",
   "Il cognome della persona a cui è stato assegnato {event}"),
  (r"(?P<subject>Roma|Milano|Torino|Bologna|Napoli|Venezia|Firenze) ospita (?P<event>[^.!?]+)",
   "La città che ospita {event}"),
  (r"(?P<subject>Euclid|Webb|Hubble|Gaia|Cheops|Juice) (?:scopre|rileva|osserva) (?P<event>[^.!?]+)",
   "La missione o il telescopio protagonista dell’osservazione di {event}"),
 ]
 for pattern,template in rules:
  match=re.fullmatch(pattern,title.rstrip('.'))
  if not match:continue
  subject=match['subject'];event=match['event'].strip()
  # Negations, predictions, quotations and compound events need human authoring.
  if re.search(r"[?:;“”\"]|\b(non|forse|potrebbe|dovrebbe|secondo|indiscrezioni)\b",event,re.I):return
  if len(event)<8 or len(event)>130:return
  answer=normalized(subject.split()[-1])
  if not 3<=len(answer)<=15 or answer in normalized(event):return
  clue=template.format(event=event)+f" (notizia del {date.strftime('%d/%m')})"
  yield {'word':answer,'clue_it':clue,'source_name':source,'source_url':link,
         'published_at':date.isoformat(),'source_title':title,'language':'it','reviewed':'no'}
  return
def feed_relations(title,summary,source,link,date):
 # Feed summaries often name the research institution or award winner explicitly.
 text=' '.join(summary.split())
 proposals=[]
 institution=re.search(r"(?:[Uu]n team guidato dall[’']|[Uu]n gruppo dell[’']|[Uu]n team di astronomi dell[’'])Università (?:di |dell[’'])(?P<place>[A-ZÀ-Ö][a-zà-öø-ÿ]{2,14})(?: \([^)]{1,30}\))? ha (?P<action>scoperto|sviluppato|rilevato) (?P<detail>[^.!?;]{15,300})(?:[.!?;]|$)",text)
 if institution:
  detail=institution['detail'].split(':')[0].strip()
  proposals.append((institution['place'],f'Dà il nome all’università del team che ha {institution["action"]} {detail}','feed-university-result'))
 institute=re.search(r'[Uu]n team a guida (?P<institute>Inaf|INAF) ha (?P<action>analizzato|scoperto|rilevato) (?P<detail>[^,.!?;]{15,140})(?:[,.;!?]|$)',text)
 if institute:
  proposals.append((institute['institute'],f'Sigla dell’istituto alla guida del team che ha {institute["action"]} {institute["detail"]}','feed-institute-result'))
 winner=re.search(r'(?P<person>[A-ZÀ-Ö][a-zà-öø-ÿ]+(?: [A-ZÀ-Ö][a-zà-öø-ÿ]+){1,3}) si è aggiudicat[oa] (?:il |la |l’|l\')(?P<award>[^.!?;]{8,130})(?:[.!?;]|$)',text)
 if winner:
  proposals.append((winner['person'].split()[-1],f'Il cognome di chi si è aggiudicato {winner["award"]}','feed-award-winner'))
 seen=set()
 for answer,clue,rule in proposals:
  word=normalized(answer)
  if word in seen or not re.fullmatch('[A-Z]{3,15}',word):continue
  if re.search(r'\b(non|forse|potrebbe|avrebbe|dovrebbe|possibile|possibili|presunto|accusato|sospetto)\b',clue,re.I):continue
  if any(normalized(token)==word for token in re.findall(r'\w+',clue)):continue
  clue+=f' (notizia del {date:%d/%m/%Y})'
  if not 12<=len(clue)<=250:continue
  seen.add(word)
  yield {'word':word,'clue_it':clue,'source_name':source,'source_url':link,
         'published_at':date.isoformat(),'source_title':title,'language':'it','reviewed':'no','rule':rule}
def collect(root,date,fixture=None,cache_dir=None):
 from news_relations import relations
 import hashlib,urllib.parse
 with (root/'assets/games/topic-sources.csv').open(encoding='utf-8-sig',newline='') as fh:sources=list(csv.DictReader(fh))
 result=[];audit=[];by_source={};seen_words=set();seen_articles=set();pool=[]
 now=dt.datetime.now(ROME)
 cutoff=now if date==now.date() else dt.datetime.combine(date,dt.time.max,ROME)
 if cache_dir:cache_dir.mkdir(parents=True,exist_ok=True)
 for row in sources:
  if row.get('stato','').lower()!='attiva' or row.get('accesso')!='rss' or row.get('lingua')!='it':continue
  feed=row.get('feed_url','').strip()
  if not feed.startswith('https://') or not int(row.get('max_richieste_giorno') or 0):continue
  source=row['nome'];category=row.get('categoria','attualita').split('|')[0]
  record={'source':row['id'],'fetched_articles':0,'valid_date_articles':0,
          'dated_articles':0,'used_articles':0,'discarded_articles':0,
          'discard_reasons':{},'proposed_candidates':0,'candidate_words':0}
  audit.append(record);by_source[row['id']]=record
  try:
   snapshot=(fixture/(row['id']+'.xml')) if fixture else (cache_dir/(row['id']+'.xml') if cache_dir else None)
   if snapshot and snapshot.exists():payload=snapshot.read_bytes()
   elif fixture:
    record['error_code']='missing_fixture';continue
   else:
    with urllib.request.urlopen(urllib.request.Request(feed,headers={'User-Agent':UA,'Accept':'application/rss+xml, application/xml'}),timeout=15) as response:payload=response.read(1_500_001)
    if len(payload)>1_500_000:raise ValueError('Feed over size limit')
    if snapshot:snapshot.write_bytes(payload)
   records=list(entries(payload,True,True,record))
   for title,link,pub,summary in records:
    if pub is None:
     discard(record,'invalid_date');continue
    age=(cutoff-pub).total_seconds()
    if age<0 or age>7*86400:
     discard(record,'future_date' if age<0 else 'outside_seven_day_window');continue
    # Same URL (minus tracking) or same normalized title is one article across feeds.
    parts=urllib.parse.urlsplit(link);identity=urllib.parse.urlunsplit((parts.scheme,parts.netloc,parts.path,'',''))
    title_key=normalized(title)
    if identity in seen_articles or title_key in seen_articles:
     discard(record,'duplicate_article');continue
    seen_articles.update((identity,title_key));record['dated_articles']+=1
    pool.append((pub,row,title,link,summary))
  except (OSError,ValueError,ET.ParseError) as exc:
   reason=exc.reason if isinstance(exc,urllib.error.URLError) else exc
   record['error_code']='tls_dh_key_too_small' if isinstance(reason,ssl.SSLError) and 'DH_KEY_TOO_SMALL' in str(reason) else 'feed_fetch_or_parse_error'
   record['error']=str(exc)[:160]
   if record['error_code']=='tls_dh_key_too_small':
    record['error_action']='Source skipped; server must use stronger DH parameters. Default TLS verification retained.'
 # Prefer the last 72 hours; retain exact feed publication timestamps.
 # Older articles are only considered if the fresh candidates do not meet quota/diversity.
 counts={};categories={};used_urls=set();processed=set()
 for window in (3,7):
  for pub,row,title,link,summary in sorted(pool,key=lambda x:x[0],reverse=True):
   age=(cutoff-pub).total_seconds()/86400
   if (window==3 and age>3) or (window==7 and age<=3):continue
   processed.add((row['id'],link));record=by_source[row['id']]
   if counts.get(row['id'],0)>=int(row.get('max_notizie_giorno') or 4):
    discard(record,'source_article_quota');continue
   category=row.get('categoria','attualita').split('|')[0]
   proposals=list(summary_candidates(title,summary,row['nome'],link,pub))+list(candidates(title,row['nome'],category,link,pub))+list(feed_relations(title,summary,row['nome'],link,pub))
   for word,clue,rule,cat in relations(title,summary):
    proposals.append({'word':word,'clue_it':clue+f' (notizia del {pub.strftime("%d/%m/%Y")})','source_name':row['nome'],'source_url':link,'published_at':pub.isoformat(),'source_title':title,'language':'it','reviewed':'no','rule':rule,'category':cat})
   record['proposed_candidates']+=len(proposals)
   added=0
   for item in proposals:
    if item['word'] in seen_words or added>=2:continue
    item.setdefault('category',category);item.setdefault('rule','explicit-title-relation')
    if item['rule'] in ('mission-target','discovery-author','discovery-object'):
     item['clue_it']+=f' (notizia del {pub:%d/%m/%Y})'
    # Store evidence for review, separately from the distributable crossword.
    item['evidence']=title+' — '+summary
    item['published_at']=pub.isoformat()
    seen_words.add(item['word']);result.append(item);added+=1
   if added:
    used_urls.add(link);counts[row['id']]=counts.get(row['id'],0)+1
    record['used_articles']+=1;record['candidate_words']+=added
   else:discard(record,'duplicate_candidate_words' if proposals else ('no_explicit_relation' if summary else 'no_explicit_relation_or_summary'))
  if len(result)>=12 and len(used_urls)>=4:break
 for pub,row,title,link,summary in pool:
  if (row['id'],link) not in processed:discard(by_source[row['id']],'older_fallback_not_needed')
 return result,audit

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',default='.');ap.add_argument('--date',help='YYYY-MM-DD in Europe/Rome');ap.add_argument('--out',required=True);ap.add_argument('--fixture-dir',help='Local RSS fixtures, no network');ap.add_argument('--cache-dir',help='Run-specific cache, reused during construction');a=ap.parse_args()
 day=dt.date.fromisoformat(a.date) if a.date else dt.datetime.now(ROME).date()
 root=pathlib.Path(a.root);items,audit=collect(root,day,pathlib.Path(a.fixture_dir) if a.fixture_dir else None,pathlib.Path(a.cache_dir) if a.cache_dir else None)
 out=pathlib.Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
 with out.open('w',encoding='utf-8',newline='') as fh:
  writer=csv.DictWriter(fh,fieldnames=['word','clue_it','source_name','source_url','published_at','source_title','language','reviewed','rule','category','evidence']);writer.writeheader();writer.writerows(items)
 print(json.dumps({'date':str(day),'candidate_words':len(items),'used_sources':audit,'csv':str(out)},ensure_ascii=False))
 if not items:sys.exit(3)
if __name__=='__main__':main()
