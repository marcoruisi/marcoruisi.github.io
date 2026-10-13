#!/usr/bin/env python3
"""Produce a daily news crossword ONLY from dated, source-attributed, reviewed fact pairs.

Input CSV columns: word,clue_it,source_name,source_url,published_at
This script does not fetch/reprint news articles and never commits or deploys.
If the validated set is insufficient, it does NOT overwrite the existing static puzzle.
"""
import argparse,csv,datetime,json,pathlib,re,sys,urllib.parse
from zoneinfo import ZoneInfo
from build_crossword_collection import construct,load_filler_bank,select_filler_bank,bank_categories

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--root',default='.')
 ap.add_argument('--input',required=True,help='Reviewed news facts CSV, in the specified format')
 ap.add_argument('--date',default=None,help='Issue date YYYY-MM-DD (default UTC today)')
 ap.add_argument('--topic',choices=['cinema','musica','scienza','natura','storia','geografia','sport','letteratura','tecnologia','curiosita'],help='Optional thematic bank for completion')
 ap.add_argument('--min-news',type=int,default=4)
 ap.add_argument('--min-placed-news',type=int,default=3)
 ap.add_argument('--output-dir',help='Preview directory. Never edits published crossword files.')
 a=ap.parse_args()
 root=pathlib.Path(a.root);today=datetime.date.fromisoformat(a.date) if a.date else datetime.datetime.now(ZoneInfo('Europe/Rome')).date()
 items=[];credits={};seen=set();reviewed=set()
 with pathlib.Path(a.input).open(encoding='utf-8-sig',newline='') as f:
  required={'word','clue_it','source_name','source_url','published_at'}
  reader=csv.DictReader(f)
  if not required.issubset(reader.fieldnames or []):raise ValueError('CSV: colonne richieste '+', '.join(sorted(required)))
  for row in reader:
   word=row['word'].strip().upper();clue=row['clue_it'].strip();url=row['source_url'].strip()
   if not re.fullmatch('[A-Z]{3,15}',word) or not 12<=len(clue)<=250 or word in seen:continue
   if row.get('language','it').strip()!='it':continue
   approved=row.get('reviewed','').strip().lower() in ('yes','si','sì','true','1')
   if not approved and not a.output_dir:continue
   if not row.get('source_title','').strip():continue
   if re.search(r'\b'+re.escape(word)+r'\b',clue,re.I):continue
   if re.search(r'termine associato|nelle notizie di|parola (?:del|dal) titolo',clue,re.I):continue
   u=urllib.parse.urlparse(url)
   if u.scheme!='https' or not u.hostname or not row['source_name'].strip():continue
   try:date=datetime.date.fromisoformat(row['published_at'].strip()[:10])
   except ValueError:continue
   # Today and yesterday by calendar date; do not claim an exact hourly window.
   if not 0<=(today-date).days<=1:continue
   if approved:reviewed.add(word)
   seen.add(word);items.append((word,clue));credits[word]={'name':row['source_name'].strip(),'url':url,'publishedAt':str(date),'title':row['source_title'].strip()}
 if len(items)<a.min_news:
  raise RuntimeError(f'Non pubblicare: solo {len(items)} coppie di notizie valide, minimo {a.min_news}')
 fillers=load_filler_bank(root,a.topic)
 categories=bank_categories(root,a.topic)
 chosen=construct(items+select_filler_bank(items,fillers,limit=90,categories=categories,include_thematic=True),'verified-news-'+str(today),max_words=54,attempts=12,primary_words=set(credits),word_categories=categories,completion_bank=fillers)
 if not chosen:raise RuntimeError('Nessun incastro valido, nessuna pubblicazione')
 answers=chosen['mrcEditorial']['answers'];usednews=sum(word in credits for word in answers.values())
 if usednews<a.min_placed_news:
  raise RuntimeError(f'Solo {usednews} parole di notizie incastrate: nessuna pubblicazione')
 for key,word in answers.items():
  if word in credits:chosen['clueSources'][key]=credits[word]
 verified=sum(word in reviewed for word in answers.values())
 chosen['mrcEditorial'].update({'topic':'Notizie di oggi e ieri · anteprima' if a.output_dir else 'Notizie di oggi e ieri','dailyDate':str(today),'newsClues':usednews,'verifiedNewsClues':verified,'reviewRequired':verified<usednews,'fillerClues':len(answers)-usednews,'credit':'Indizi dalle notizie attribuiti singolarmente; voci di raccordo originali MRC'})
 dest=pathlib.Path(a.output_dir) if a.output_dir else root/'assets/games/crosswords';dest.mkdir(parents=True,exist_ok=True)
 out=dest/('preview-'+str(today)+'.json' if a.output_dir else 'mrc-del-giorno.json')
 # Write only after all validations and build a manifest without silently labeling previews as news.
 out.write_text(json.dumps(chosen,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 if a.output_dir:
  print(f'Anteprima {today}: {len(answers)} definizioni, {usednews} da notizie; file {out}')
  return
 manifest=dest/'index.json';data=json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else {'version':1,'games':[]}
 data['games']=[g for g in data['games'] if g.get('file')!='mrc-del-giorno.json']
 data['games'].insert(0,{'id':'daily','file':'mrc-del-giorno.json','title':'Cruciverba del giorno · notizie','language':'it','type':'daily-news','date':str(today)})
 manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(f'Pronto per revisione: {len(answers)} definizioni, {usednews} da notizie, {chosen["rows"]}x{chosen["cols"]}')

if __name__=='__main__':
 try:main()
 except (ValueError,RuntimeError,FileNotFoundError) as e:
  print('MRC Cruciverba del giorno: '+str(e),file=sys.stderr);sys.exit(2)
