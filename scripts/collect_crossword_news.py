#!/usr/bin/env python3
"""RSS -> candidate crossword clues. No article body retrieval. Stdlib only.
Daily quotas refer to articles USED; requests capped at one feed fetch per source/run.
Historical runs require archive-capable feeds or an explicit local snapshot CSV.
"""
import argparse,csv,datetime as dt,email.utils,html,json,pathlib,re,sys,urllib.request,xml.etree.ElementTree as ET,unicodedata
from zoneinfo import ZoneInfo
ROME=ZoneInfo('Europe/Rome')
STOP=set('il lo la i gli le un uno una del dello della dei degli delle di da a ad con su per tra fra nel nello nella nei negli nelle che ed e o al allo alla ai agli alle si se non sul sulla sono era dopo prima oggi nuova nuovo nuove nuovi come anche sulla sui agli allo nel suo sua suoi sue alla dal dalle nel loro oltre contro ieri piu fa'.split())
UA='MRC-Crossword/1.0 (RSS headline indexing; attribution to original source)'
def normalized(word):
 s=''.join(c for c in unicodedata.normalize('NFKD',word) if not unicodedata.combining(c))
 return re.sub(r'[^A-Z]','',s.upper())
def parsedate(value):
 try:return email.utils.parsedate_to_datetime(value).astimezone(ROME).date()
 except (ValueError,TypeError,OverflowError,AttributeError):
  try:return dt.datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(ROME).date()
  except (ValueError,TypeError):return None
def localname(tag):return tag.rsplit('}',1)[-1]
def child(node, tag):
 for x in node:
  if localname(x.tag)==tag:return (x.text or '').strip()
 return ''
def entries(payload,include_summary=False):
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
  summary=html.unescape(re.sub('<[^>]+>',' ',child(node,'description') or child(node,'summary') or child(node,'encoded')))
  summary=' '.join(summary.split())[:6000]
  if title and url.startswith('https://'):
   yield (title,url,parsedate(pub),summary) if include_summary else (title,url,parsedate(pub))

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
   proposals.append(('MAGNETOSFERA',f'La regione dominata dal campo magnetico terrestre su cui {name} studia gli effetti del vento solare','mission-target'))
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
  (name+r" vince (?:il |la |l’|l')(?P<event>[^.!?]+)",
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
def collect(root,date,fixture=None):
 source_path=root/'assets/games/topic-sources.csv'
 with source_path.open(encoding='utf-8-sig',newline='') as fh:sources=list(csv.DictReader(fh))
 result=[];audit=[];seen=set();per_category={};remaining=10
 for row in sources:
  if remaining<=0:break
  if row.get('stato','').lower()!='attiva' or row.get('accesso')!='rss' or row.get('lingua')!='it':continue
  feed=row.get('feed_url','').strip()
  if not feed.startswith('https://') or not int(row.get('max_richieste_giorno') or 0):continue
  maxitems=min(int(row.get('max_notizie_giorno') or 0),3,remaining)
  if maxitems<=0:continue
  source=row['nome'];category=row.get('categoria','attualita').split('|')[0]
  if per_category.get(category,0)>=4:continue
  try:
   if fixture:
    filepath=fixture/(row['id']+'.xml')
    if not filepath.exists():continue
    payload=filepath.read_bytes()
   else:
    with urllib.request.urlopen(urllib.request.Request(feed,headers={'User-Agent':UA,'Accept':'application/rss+xml, application/atom+xml, application/xml'}),timeout=15) as response:payload=response.read(1_500_001)
    if len(payload)>1_500_000:raise ValueError('Feed over size limit')
   matches=[(title,link,pub,summary) for title,link,pub,summary in entries(payload,True) if pub is not None and 0<=(date-pub).days<=1]
   used=0
   for title,link,pub,summary in matches:
    if used>=maxitems or remaining<=0 or per_category.get(category,0)>=4:break
    new=[]
    proposals=list(summary_candidates(title,summary,source,link,pub)) or list(candidates(title,source,category,link,pub))
    for item in proposals[:2]:
     if item['word'] not in seen:new.append(item)
    if not new:continue
    # One used article can yield up to two candidate answers.
    for item in new:
     if item['word'] in seen:continue
     seen.add(item['word']);result.append(item)
    used+=1;remaining-=1;per_category[category]=per_category.get(category,0)+1
   audit.append({'source':row['id'],'dated_articles':len(matches),'used_articles':used})
  except (OSError,ValueError,ET.ParseError) as exc:audit.append({'source':row['id'],'error':str(exc)[:160]})
 return result,audit
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',default='.');ap.add_argument('--date',help='YYYY-MM-DD in Europe/Rome');ap.add_argument('--out',required=True);ap.add_argument('--fixture-dir',help='Local RSS fixtures, no network');a=ap.parse_args()
 day=dt.date.fromisoformat(a.date) if a.date else dt.datetime.now(ROME).date()
 root=pathlib.Path(a.root);items,audit=collect(root,day,pathlib.Path(a.fixture_dir) if a.fixture_dir else None)
 out=pathlib.Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
 with out.open('w',encoding='utf-8',newline='') as fh:
  writer=csv.DictWriter(fh,fieldnames=['word','clue_it','source_name','source_url','published_at','source_title','language','reviewed','rule']);writer.writeheader();writer.writerows(items)
 print(json.dumps({'date':str(day),'candidate_words':len(items),'used_sources':audit,'csv':str(out)},ensure_ascii=False))
 if not items:sys.exit(3)
if __name__=='__main__':main()
