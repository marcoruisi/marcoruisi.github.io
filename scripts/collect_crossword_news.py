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
def entries(payload):
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
  if title and url.startswith('https://'):yield title,url,parsedate(pub)
def candidates(title,source,cat,link,date):
 # Avoid guessing actual factual answers from news headlines: extract explicit, literal headline tokens.
 # Source title is never published verbatim; hint uses up to two context keywords excluding the answer.
 words=re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]{3,18}",title)
 ranked=[]
 for idx,token in enumerate(words):
  answer=normalized(token)
  if not 3<=len(answer)<=12 or token.lower() in STOP or answer in ('ITALIA','ITALIANO','EUROPA','EUROPEO','NOTIZIE'):continue
  rank=(3 if idx>0 and token[:1].isupper() else 0)+(2 if len(answer)>=5 else 0)-idx*.07
  ranked.append((rank,idx,answer))
 for _,pos,answer in sorted(ranked,reverse=True)[:2]:
  context=[w.lower() for i,w in enumerate(words) if i!=pos and w.lower() not in STOP and 3<=len(w)<=15][:3]
  if len(context)<2:continue
  clue=f"Nelle notizie di {cat}: termine associato a {' e '.join(context[:2])}"
  yield {'word':answer,'clue_it':clue[:180],'source_name':source,'source_url':link,'published_at':date.isoformat()}
def collect(root,date,fixture=None):
 source_path=root/'assets/games/topic-sources.csv'
 with source_path.open(encoding='utf-8-sig',newline='') as fh:sources=list(csv.DictReader(fh))
 result=[];audit=[];seen=set();per_category={};remaining=10
 for row in sources:
  if remaining<=0:break
  if row.get('stato','').lower()!='attiva' or row.get('accesso')!='rss':continue
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
   matches=[(title,link,pub) for title,link,pub in entries(payload) if pub==date]
   used=0
   for title,link,pub in matches:
    if used>=maxitems or remaining<=0 or per_category.get(category,0)>=4:break
    new=[]
    for item in candidates(title,source,category,link,pub):
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
  writer=csv.DictWriter(fh,fieldnames=['word','clue_it','source_name','source_url','published_at']);writer.writeheader();writer.writerows(items)
 print(json.dumps({'date':str(day),'candidate_words':len(items),'used_sources':audit,'csv':str(out)},ensure_ascii=False))
 if not items:sys.exit(3)
if __name__=='__main__':main()
