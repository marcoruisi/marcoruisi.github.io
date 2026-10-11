#!/usr/bin/env python3
"""Check numbered crossword runs, clue consistency, and optional answer metadata."""
import pathlib,sys,json
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'assets/games/crosswords')
manifest=json.loads((root/'index.json').read_text(encoding='utf8'))
for item in manifest['games']:
    p=root/item['file']
    assert p.is_file(),p
    o=json.loads(p.read_text(encoding='utf8'))
    R,C=o['rows'],o['cols'];black=o['blacks'];clues=o['clues']
    assert 3<=R<=30 and 3<=C<=30,(p,R,C)
    assert len(black)==R*C and len(o['letters'])==R*C,p
    entries={}
    for r in range(R):
      for c in range(C):
        i=r*C+c
        if black[i]:continue
        if (c==0 or black[i-1]) and c+1<C and not black[i+1]:
            ids=[];j=c
            while j<C and not black[r*C+j]:ids.append(r*C+j);j+=1
            entries['a:'+str(i)]=ids
        if (r==0 or black[i-C]) and r+1<R and not black[i+C]:
            ids=[];j=r
            while j<R and not black[j*C+c]:ids.append(j*C+c);j+=1
            entries['d:'+str(i)]=ids
    assert entries.keys()==clues.keys(),(p,'different clue keys',list(entries.keys()-clues.keys()),list(clues.keys()-entries.keys()))
    assert len(entries)>=6,(p,'too few clues')
    for key,ans in o.get('mrcEditorial',{}).get('answers',{}).items():
        assert len(ans)==len(entries[key]),(p,key,'answer length')
    print(f'{p.name}: {len(entries)} clues, {R}x{C}')
