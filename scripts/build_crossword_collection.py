#!/usr/bin/env python3
"""MRC editorial construction engine. Personal category pools live in the shared CSV.
"""
import argparse, json, random, pathlib, datetime, re, copy, time

NAMES={'cinema':'Cinema','musica':'Musica','scienza':'Scienza','natura':'Natura','storia':'Storia','geografia':'Geografia','sport':'Sport','letteratura':'Letteratura','tecnologia':'Tecnologia','curiosita':'Curiosità'}

def words_for(key):
    import csv
    with (pathlib.Path(__file__).resolve().parents[1]/'assets/games/crossword-fillers.csv').open(encoding='utf-8-sig',newline='') as stream:
        return [(r['word'],r['clue_it']) for r in csv.DictReader(stream)
                if r['lang']=='it' and key in (r.get('tags','')+' '+r.get('topic','')).split()]

def load_filler_bank(root,topic=None):
    import csv
    csv_file=root/'assets/games/crossword-fillers.csv'
    if not csv_file.exists():
        return []
    with csv_file.open(encoding='utf-8-sig',newline='') as stream:
        rows=csv.DictReader(stream)
        return [(row['word'].strip().upper(),row['clue_it'].strip()) for row in rows
                if row.get('lang')=='it' and re.fullmatch('[A-Z]{2,15}',row['word'].strip().upper()) and row.get('clue_it')
                and (not topic or not row.get('topic') or row['topic']==topic)]

def bank_categories(root,topic=None):
    import csv
    with (root/'assets/games/crossword-fillers.csv').open(encoding='utf-8-sig',newline='') as stream:
        return {r['word']:('tematica' if topic and r.get('topic')==topic else
                           'raccordo' if len(r['word'])<=3 else 'generale') for r in csv.DictReader(stream)}

def select_filler_bank(data, fillers, limit=64, categories=None, include_thematic=False):
    from collections import Counter
    freq=Counter(c for word,_ in data for c in set(word))
    existing={word for word,_ in data}
    candidates=[entry for entry in fillers if entry[0] not in existing]
    candidates.sort(key=lambda p:(-sum(freq.get(c,0) for c in p[0])/len(p[0]),abs(len(p[0])-3),p[0]))
    if categories:
        thematic=[p for p in candidates if categories.get(p[0])=='tematica'][:max(1,limit//3)]
        candidates=[p for p in candidates if categories.get(p[0])!='tematica' and len(p[0])<=6]
        if include_thematic:candidates=thematic+candidates
    return candidates[:limit]

def _complete(candidate,data,completion_bank,max_words,main_words,categories,deadline):
    # Second pass: fill *existing* footprint, never enlarge it. Prefer slots
    # with two or more crossings and fully validate every new across/down run.
    placed, board, minr, minc, rows, cols = candidate
    maxr=minr+rows-1;maxc=minc+cols-1
    placed=list(placed);board=dict(board)
    used={p[0][0] for p in placed}
    occupied_dir={}
    for item,r,c,d in placed:
        dr,dc=((0,1) if d==0 else (1,0))
        for i in range(len(item[0])):occupied_dir[(r+i*dr,c+i*dc,d)]=True
    completion=list(dict(list(completion_bank or [])+data).items())
    for _ in range(min(25,max_words-len(placed))):
        if time.monotonic()>=deadline:break
        winner=None
        for item in completion:
            if time.monotonic()>=deadline:break
            word=item[0]
            if word in used or len(word)>max(rows,cols):continue
            for d in (0,1):
                dr,dc=((0,1) if d==0 else (1,0))
                for r in range(minr,maxr+1):
                    for c in range(minc,maxc+1):
                        er=r+dr*(len(word)-1);ec=c+dc*(len(word)-1)
                        if er>maxr or ec>maxc:continue
                        if (r-dr,c-dc) in board or (er+dr,ec+dc) in board:continue
                        hits=0;added=0;ok=True
                        for i,ch in enumerate(word):
                            y=r+i*dr;x=c+i*dc;old=board.get((y,x))
                            if old:
                                if old!=ch or occupied_dir.get((y,x,d)):ok=False;break
                                hits+=1
                            else:
                                # A new letter may not touch a parallel entry.
                                if (y+dc,x+dr) in board or (y-dc,x-dr) in board:ok=False;break
                                added+=1
                        if not ok or hits<1 or not added:continue
                        quality=hits*120+len(word)*4-added*2+(70 if len(word)<=4 else 0)
                        quality+=180 if word in main_words else {'tematica':80,'generale':30,'raccordo':0}.get(categories.get(word),0)
                        if winner is None or quality>winner[0]:winner=(quality,item,r,c,d)
        if winner is None:break
        _,item,r,c,d=winner
        dr,dc=((0,1) if d==0 else (1,0))
        for i,ch in enumerate(item[0]):
            y=r+i*dr;x=c+i*dc;board[(y,x)]=ch;occupied_dir[(y,x,d)]=True
        placed.append((item,r,c,d));used.add(item[0])
    return placed,board,minr,minc,rows,cols

def _search_satisfactory(best,max_words,primary_groups):
    if best is None:return False
    quality,placed,board,_,_,rows,cols=best
    return (len(placed)>=min(50,max_words)
            and len(board)/(rows*cols)>=0.60
            and (not primary_groups or (quality[0]>=8 and quality[1]>=4)))

def construct(data,seed,max_words=48,attempts=12,primary_words=None,word_categories=None,completion_bank=None,budget_seconds=None,primary_groups=None):
    # Keep one non-empty clue per answer; never construct an undefined entry.
    data=list(dict((w.strip().upper(),c.strip()) for w,c in data
                   if re.fullmatch('[A-Za-z]{2,15}',w.strip()) and c.strip()).items())
    if not data:return None
    started=time.monotonic(); deadline=started+budget_seconds if budget_seconds else float("inf")
    stale=0; primary_groups=primary_groups or {}
    rng=random.Random(seed)
    N=33
    main_words=set(primary_words) if primary_words is not None else {w for w,_ in data if len(w)>6}
    categories=word_categories or {}
    # Two-letter entries are fillers and may be placed only without growing the board.
    short_words={w for w,_ in data if len(w)==2}
    best=None
    # Random-restart greedy placement, selecting candidates by compactness and crosses.
    iteration=-1;stop_reason='attempt_limit'
    # Timed jobs use their budget, not the legacy fixed number of attempts.
    while budget_seconds is not None or iteration+1<attempts:
        elapsed=time.monotonic()-started
        if time.monotonic()>=deadline:
            stop_reason='time_budget';break
        if stale>=4 and elapsed>25 and (budget_seconds is None or _search_satisfactory(best,max_words,primary_groups)):
            stop_reason='satisfactory_plateau' if budget_seconds is not None else 'plateau';break
        iteration+=1
        board={}; placements=[]; used=set(); occupied_dir=set()
        starters=[item for item in data if item[0] in main_words] or data
        start=rng.choice(starters[:min(12,len(starters))]); direction=iteration%2
        r=N//2 if not direction else (N-len(start[0]))//2
        c=(N-len(start[0]))//2 if not direction else N//2
        def install(item,row,col,d,hits):
            word=item[0];dr,dc=((0,1) if d==0 else (1,0))
            for i,ch in enumerate(word):
                board[(row+i*dr,col+i*dc)]=ch
                occupied_dir.add((row+i*dr,col+i*dc,d))
            placements.append((item,row,col,d));used.add(word)
        install(start,r,c,direction,0)
        # Alternate full restarts with rebuilding the best primary skeleton.
        # Reinsert its news entries; discard obstructing fillers, preserving connectivity.
        if best is not None and iteration%2:
            prior=best[1]
            needed={p[0][0] for p in prior if p[0][0] in main_words}
            # Keep the connected prefix through the last primary word; prune trailing branches.
            last=max((i for i,p in enumerate(prior) if p[0][0] in needed),default=0)
            board.clear();placements.clear();used.clear();occupied_dir.clear()
            for item,y,x,d in prior[:last+1]:install(item,y,x,d,0)
        while len(placements)<min(len(data),max(8,max_words-10)) and time.monotonic()<deadline:
            minr=min(k[0] for k in board);maxr=max(k[0] for k in board)
            minc=min(k[1] for k in board);maxc=max(k[1] for k in board)
            oldarea=(maxr-minr+1)*(maxc-minc+1)
            options=[]
            for item in data:
                if time.monotonic()>=deadline:break
                word=item[0]
                if word in used:continue
                for (y,x),letter in board.items():
                    for k,ch in enumerate(word):
                        if ch!=letter:continue
                        for d in (0,1):
                            dr,dc=((0,1) if d==0 else (1,0));rr=y-dr*k;cc=x-dc*k
                            er=rr+dr*(len(word)-1);ec=cc+dc*(len(word)-1)
                            if min(rr,er,cc,ec)<1 or max(rr,er,cc,ec)>=N-1:continue
                            if (rr-dr,cc-dc) in board or (er+dr,ec+dc) in board:continue
                            good=True;hits=0
                            for j,ch2 in enumerate(word):
                                yy=rr+dr*j;xx=cc+dc*j;ex=board.get((yy,xx))
                                if ex:
                                    if ex!=ch2 or (yy,xx,d) in occupied_dir:good=False;break
                                    hits+=1
                                elif ((yy+dc,xx+dr) in board or (yy-dc,xx-dr) in board):good=False;break
                            if not good or hits<1:continue
                            nr=min(minr,rr);xr=max(maxr,er);nc=min(minc,cc);xc=max(maxc,ec)
                            newarea=(xr-nr+1)*(xc-nc+1)
                            if xr-nr+1>30 or xc-nc+1>30:continue
                            growth=newarea-oldarea
                            if word in short_words and (growth != 0 or len(placements) < 12):continue
                            score=hits*95-growth*5.8+len(word)*3+ (26 if len(word)<=8 else 0)-abs((xr-nr)-(xc-nc))*2
                            if word in short_words:score+=95
                            if word in main_words:score+=350
                            if primary_groups.get(word) and primary_groups[word] not in {primary_groups.get(w) for w in used}:score+=200
                            elif categories.get(word)=='tematica':score+=80
                            # Close internal gaps before growing another sparse branch.
                            if growth==0:score+=80
                            score+=rng.random()*25
                            priority=3 if word in main_words else {'tematica':2,'generale':1,'raccordo':0}.get(categories.get(word),0)
                            options.append((score,priority,item,rr,cc,d,hits))
            if not options:break
            options.sort(key=lambda z:(z[0],z[1]),reverse=True)
            # Explore a few near-best alternatives to avoid locking the same early footprint.
            choices=[o for o in options[:4] if o[0]>=options[0][0]-55]
            pick=rng.choice(choices) if iteration%3 else options[0]
            install(pick[2],pick[3],pick[4],pick[5],pick[6])
        minr=min(k[0] for k in board);maxr=max(k[0] for k in board)
        minc=min(k[1] for k in board);maxc=max(k[1] for k in board)
        rows=maxr-minr+1;cols=maxc-minc+1;area=rows*cols
        occupied=len(board)
        candidate=_complete((placements,board,minr,minc,rows,cols),data,completion_bank,max_words,main_words,categories,deadline)
        placements,board,minr,minc,rows,cols=candidate
        news={p[0][0] for p in placements if p[0][0] in main_words}
        quality=(min(12,len(news)),min(4,len({primary_groups.get(w,w) for w in news})),len(placements)*140+len(board)/(rows*cols)*1000-rows*cols*3.0-abs(rows-cols)*18)
        if best is None or quality>best[0]:best=(quality,*candidate);stale=0
        else:stale+=1
    if best is None:return None
    _,placed,board,minr,minc,rows,cols=best
    blacks=[]
    for r in range(rows):
        for c in range(cols):blacks.append((r+minr,c+minc) not in board)
    clues={};answers={};sources={}
    starts={}
    for item,r,c,d in placed:
        pos=(r-minr)*cols+(c-minc)
        key=('a' if d==0 else 'd')+':'+str(pos)
        clues[key]=item[1];answers[key]=item[0];sources[key]={'name':'MRC · definizione redazionale','url':''}
    # Every horizontal/vertical run must have exactly one corresponding clue.
    for r in range(rows):
        for c in range(cols):
            i=r*cols+c
            if blacks[i]:continue
            for d,dr,dc in [('a',0,1),('d',1,0)]:
                before=c==0 or r==0 if d=='a' else r==0
                if d=='a':isstart=(c==0 or blacks[i-1]) and c+1<cols and not blacks[i+1]
                else:isstart=(r==0 or blacks[i-cols]) and r+1<rows and not blacks[i+cols]
                if isstart and f'{d}:{i}' not in clues:return None
    return {'version':1,'rows':rows,'cols':cols,'blacks':blacks,'letters':['']*(rows*cols),'clues':clues,'clueSources':sources,'ui':{'mode':'play','dir':'a','selected':-1,'lang':'it'},'mrcEditorial':{'topic':NAMES.get(seed[0] if isinstance(seed,tuple) else '', ''),'searchAttempts':iteration+1,'searchStopReason':stop_reason,'answers':answers,'wordCategories':{k:('principale' if w in main_words else categories.get(w,'raccordo' if len(w)<=3 else 'generale')) for k,w in answers.items()},'credit':'Definizioni originali MRC; non provenienti dai siti del catalogo'}}

if __name__=='__main__':
    print('Motore editoriale importabile. Per le anteprime usare build_daily_news_crossword.py; le categorie personali sono generate nel browser.')
