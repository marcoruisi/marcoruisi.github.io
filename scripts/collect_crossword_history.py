#!/usr/bin/env python3
"""Accadde oggi: original clues from explicit Rai Cultura archive relations."""
import datetime as dt,json,re,urllib.request
from collect_crossword_news import normalized,UA
API='https://www.raicultura.it/atomatic/rai-search-service/api/v2/raicultura/archive'
def collect_history(date,cache_dir):
 cache_dir.mkdir(parents=True,exist_ok=True);path=cache_dir/f'history-{date:%m-%d}.json'
 try:
  if path.exists():payload=json.loads(path.read_text())
  else:
   body={'page':0,'pageSize':100,'filters':{'types':['accadde oggi'],'date':f'*-{date:%m-%d}'},'param':None,'post_filters':{}}
   request=urllib.request.Request(API,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','User-Agent':UA})
   with urllib.request.urlopen(request,timeout=15) as response:raw=response.read(1500001)
   if len(raw)>1500000:raise ValueError('Archivio troppo grande')
   payload=json.loads(raw);path.write_text(json.dumps(payload,ensure_ascii=False))
 except (OSError,ValueError) as exc:return [],[{'source':'raicultura','error':str(exc)[:160]}]
 items=[];seen=set()
 for item in payload.get('hits',[]):
  event=item.get('data_pubblicazione','');title=item.get('title','');subtitle=item.get('subtitle','')
  try:day=dt.date.fromisoformat(event[:10])
  except ValueError:continue
  if (day.month,day.day)!=(date.month,date.day) or day>=date:continue
  urls=[s.get('url','') for s in item.get('siti',[]) if s.get('nome')=='Rai Cultura']
  url=next((u for u in urls if u.startswith('https://www.raicultura.it/')),'')
  if not url:continue
  pairs=[]
  m=re.fullmatch(r'([A-ZÀ-Ö][a-zà-ÿ]+) sostituisce ([A-ZÀ-Ö][a-zà-ÿ]+)',title)
  if m:pairs=[(m[1],f'Il {day:%d/%m/%Y} subentra a {m[2]}'),(m[2],f'Il {day:%d/%m/%Y} viene sostituito da {m[1]}')]
  m=re.fullmatch(r'(?:Si apre|Inizia) (.{8,100}) (?:a|in) ([A-ZÀ-Ö][a-zà-ÿ]{2,14})',title)
  if m:pairs.append((m[2],f'Qui il {day:%d/%m/%Y} ha inizio {m[1]}'))
  m=re.fullmatch(r'(Nasce|Muore) ([A-ZÀ-Ö][a-zà-ÿ]+) ([A-ZÀ-Ö][a-zà-ÿ]{2,14})',title)
  if m and subtitle and len(subtitle)<100:pairs.append((m[3],f'Il cognome di {m[2]}, che {"nasce" if m[1]=="Nasce" else "muore"} il {day:%d/%m/%Y}. {subtitle}'))
  for word,clue in pairs:
   word=normalized(word)
   if word in seen or not re.fullmatch('[A-Z]{3,15}',word) or any(normalized(t)==word for t in re.findall(r'\w+',clue)):continue
   seen.add(word);items.append({'word':word,'clue_it':clue,'source_name':'Rai Cultura','source_url':url,'published_at':event,'source_title':title,'category':'history','language':'it','reviewed':'no'})
 return items,[{'source':'raicultura','fetched_articles':len(payload.get('hits',[])),'used_articles':len({x['source_url'] for x in items})}]
