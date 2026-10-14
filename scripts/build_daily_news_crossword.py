#!/usr/bin/env python3
"""Generate an isolated news / on-this-day preview. Never publish or edit manifests."""
import argparse,csv,datetime,json,pathlib,re,sys,time,urllib.parse
from collections import Counter
from zoneinfo import ZoneInfo
from build_crossword_collection import construct,load_filler_bank,select_filler_bank,bank_categories
from collect_crossword_news import collect,normalized,parseinstant
from collect_crossword_history import collect_history

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--root',default='.')
 ap.add_argument('--input',help='Optional existing attributed pairs CSV; otherwise acquire sources automatically')
 ap.add_argument('--date',help='YYYY-MM-DD, Europe/Rome')
 ap.add_argument('--category',choices=['news','history'],default='news')
 ap.add_argument('--topic',default=None)
 ap.add_argument('--min-news',type=int,default=8)
 ap.add_argument('--min-placed-news',type=int,default=8)
 ap.add_argument('--budget-seconds',type=int,default=120,choices=range(1,301),metavar='1..300')
 ap.add_argument('--cache-dir',help='RSS snapshot directory for this acquisition; reused across construction attempts')
 ap.add_argument('--output-dir',default='crossword-previews',help='Isolated preview directory; no published files are touched')
 a=ap.parse_args();started=time.monotonic();root=pathlib.Path(a.root)
 now=datetime.datetime.now(ZoneInfo('Europe/Rome'));today=datetime.date.fromisoformat(a.date) if a.date else now.date()
 cutoff=now if today==now.date() else datetime.datetime.combine(today,datetime.time.max,now.tzinfo)
 dest=pathlib.Path(a.output_dir);dest.mkdir(parents=True,exist_ok=True)
 cache=pathlib.Path(a.cache_dir) if a.cache_dir else dest/('source-cache-'+now.strftime('%Y%m%d-%H%M%S'))
 if a.input:
  with pathlib.Path(a.input).open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
  audit=[]
 elif a.category=='history':rows,audit=collect_history(today,cache)
 else:rows,audit=collect(root,today,cache_dir=cache)
 credits={};items=[]
 for row in rows:
  word=normalized(row.get('word',''));clue=row.get('clue_it','').strip();url=row.get('source_url','').strip()
  if not re.fullmatch('[A-Z]{3,15}',word) or not 12<=len(clue)<=250 or word in credits:continue
  if row.get('language','it')!='it' or not row.get('source_title') or not row.get('source_name'):continue
  if any(normalized(t)==word for t in re.findall(r'\w+',clue)):continue
  u=urllib.parse.urlparse(url)
  if u.scheme!='https' or not u.hostname:continue
  stamp=parseinstant(row.get('published_at',''))
  if stamp is None:continue
  if a.category=='news' and not 0<=(cutoff-stamp).total_seconds()<=7*86400:continue
  if a.category=='history' and ((stamp.month,stamp.day)!=(today.month,today.day) or stamp.date()>=today):continue
  items.append((word,clue));credits[word]={'name':row['source_name'],'url':url,'publishedAt':row['published_at'],'title':row['source_title'],'category':row.get('category','attualita')}
 # Diversify the first seed pool, then allow up to two clues per source article.
 items.sort(key=lambda x:parseinstant(credits[x[0]]['publishedAt']),reverse=True)
 ordered=[];seen=set()
 for pair in items:
  key=credits[pair[0]]['url']
  if key not in seen:ordered.append(pair);seen.add(key)
 ordered += [p for p in items if p not in ordered]
 items=ordered[:12];credits={w:credits[w] for w,_ in items}
 if not items:raise RuntimeError('Nessun indizio documentato ricavabile dalle fonti disponibili; nessun file pubblicato modificato')
 fillers=[p for p in load_filler_bank(root,a.topic) if len(p[0])>=3]
 categories=bank_categories(root,a.topic)
 chosen=construct(items+select_filler_bank(items,fillers,limit=100,categories=categories,include_thematic=True),a.category+'-'+str(today),max_words=56,attempts=100,primary_words=set(credits),word_categories=categories,completion_bank=fillers,budget_seconds=max(1,a.budget_seconds-(time.monotonic()-started)),primary_groups={w:c['url'] for w,c in credits.items()})
 if not chosen:raise RuntimeError('Nessun incastro valido; nessun file pubblicato modificato')
 answers=chosen['mrcEditorial']['answers'];used={w for w in answers.values() if w in credits};cells=Counter();letters=['']*len(chosen['blacks'])
 for key,word in answers.items():
  direction,index=key.split(':');step=1 if direction=='a' else chosen['cols'];index=int(index)
  for offset,char in enumerate(word):
   pos=index+offset*step
   if letters[pos] and letters[pos]!=char:raise RuntimeError('Incrocio incoerente')
   if chosen['blacks'][pos]:raise RuntimeError('Lettera su casella nera')
   letters[pos]=char;cells[pos]+=1
  if word in credits:
   chosen['clueSources'][key]=dict(credits[word])
   if a.category=='history':
    chosen['clueSources'][key]['date']=chosen['clueSources'][key].pop('publishedAt')
    chosen['clueSources'][key]['year']=chosen['clueSources'][key]['date'][:4]
 # Exchange a new, blank game; answer keys remain editorial metadata.
 chosen['letters']=['']*len(letters)
 chosen['title']=('Cruciverba del giorno' if a.category=='news' else 'Macchina del tempo · Accadde oggi')+' · '+str(today)
 chosen['date']=str(today)
 occupied=sum(not b for b in chosen['blacks']);density=round(100*occupied/len(chosen['blacks']),2)
 articles={credits[w]['url'] for w in used};sources=sorted({credits[w]['name'] for w in used})
 warnings=[]
 if a.category=='news':
  if len(used)<a.min_placed_news:warnings.append(f'Solo {len(used)} indizi di attualità (obiettivo 8–12)')
  if len(articles)<4:warnings.append(f'Solo {len(articles)} notizie distinte (obiettivo almeno 4)')
 if a.category=='news' and len({credits[w]['category'] for w in used})<3:warnings.append('Varietà limitata a meno di tre argomenti')
 if len(answers)<50:warnings.append(f'Solo {len(answers)} parole (obiettivo 50–60)')
 if density<60:warnings.append('Densità inferiore all’obiettivo del 60%')
 metrics={'category':a.category,'dailyDate':str(today),'candidateClues':len(items),'newsClues':len(used) if a.category=='news' else 0,'historicalClues':len(used) if a.category=='history' else 0,'distinctArticles':len(articles),'sourcesUsed':sources,'topicsUsed':sorted({credits[w]['category'] for w in used}),'totalWords':len(answers),'fillerClues':len(answers)-len(used),'densityPercent':density,'crossingCells':sum(v>1 for v in cells.values()),'elapsedSeconds':round(time.monotonic()-started,2),'warnings':warnings,'acquisition':audit,'reviewRequired':True}
 chosen['mrcEditorial'].update(metrics)
 chosen['mrcEditorial']['topic']=('Cruciverba del giorno' if a.category=='news' else 'Macchina del tempo · Accadde oggi')+' · '+str(today)
 chosen['mrcEditorial']['credit']='Definizioni originali da titoli/estratti con attribuzione individuale; riempimento MRC. Anteprima non pubblicata.'
 out=dest/(('preview-' if a.category=='news' else 'accadde-oggi-')+str(today)+'.json')
 out.write_text(json.dumps(chosen,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'file':str(out),**metrics},ensure_ascii=False,indent=2))
if __name__=='__main__':
 try:main()
 except (ValueError,RuntimeError,OSError) as e:
  print('MRC Cruciverba: '+str(e),file=sys.stderr);sys.exit(2)
