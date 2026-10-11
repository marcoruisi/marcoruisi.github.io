#!/usr/bin/env python3
"""Validate editable source CSV; no requests to external providers."""
import csv,pathlib,sys,urllib.parse
p=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path('assets/games/topic-sources.csv')
rows=list(csv.DictReader(p.open(encoding='utf-8-sig',newline='')))
required={'id','nome','url','categoria','lingua','accesso','stato'}
assert rows and required.issubset(rows[0]),'CSV missing mandatory fields'
seen=set()
for i,row in enumerate(rows,2):
 assert row['id'] not in seen,(i,'duplicate id');seen.add(row['id'])
 assert urllib.parse.urlparse(row['url']).scheme=='https',(i,'non-HTTPS source')
 assert row['lingua'] in {'it','en'},(i,'language')
 assert row['stato'] in {'attiva','verifica','disattivata'},(i,'status')
 assert row['categoria'].strip(),(i,'category')
print(f'CSV valido: {len(rows)} fonti ({sum(x["stato"]=="attiva" for x in rows)} attive)')
