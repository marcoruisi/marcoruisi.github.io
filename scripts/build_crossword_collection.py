#!/usr/bin/env python3
"""MRC curated crossword compiler: stdlib only, no external requests, never publishes.
Run: python3 scripts/build_crossword_collection.py --root . [--daily 2026-10-11]
Sources in the generated curated packs are editorial MRC clues, NOT news articles.
"""
import argparse, json, random, pathlib, datetime, re, copy

# Carefully authored original short definitions. Each themed collection is static editorial content.
RAW={
'cinema':'''REGISTA|Dirige la realizzazione di un film
SCENA|Parte di un film ambientata in un preciso momento
ATTORE|Interpreta un personaggio sullo schermo
ATTRICE|Interpreta un ruolo cinematografico
COPIONE|Testo che guida dialoghi e azioni di un film
TRAMA|Successione degli eventi narrati
MONTAGGIO|Organizzazione delle inquadrature nella versione finale
CINEMA|Sala dedicata alla proiezione di film
GENERE|Categoria come commedia, horror o western
OSCAR|Celebre premio cinematografico statunitense
SET|Luogo in cui viene girata una scena
CIAK|Tavoletta usata per identificare le riprese
FOTOGRAFIA|Nel film cura luci e resa visiva delle immagini
SEQUENZA|Insieme di inquadrature che formano un momento narrativo
DOPPIAGGIO|Sostituzione delle voci originali
SOGGETTO|Prima descrizione sintetica della storia di un film
PRODUTTORE|Organizza risorse e finanziamento del film
COLONNA|Quella sonora accompagna le immagini
PREMIERE|Prima presentazione pubblica di un film
LOCANDINA|Manifesto promozionale di un film
DOCUMENTARIO|Film che racconta eventi e realtà non di finzione
SOTTOTITOLI|Testo dei dialoghi visualizzato sullo schermo''',
'musica':'''RITMO|Successione temporale di suoni e pause
NOTA|Segno che indica un suono musicale
MELODIA|Successione riconoscibile di note
ARMONIA|Combinazione simultanea di note
CHITARRA|Strumento a corde spesso con sei corde
PIANO|Strumento a tasti con corde percosse da martelletti
TAMBuro|Strumento a percussione con una membrana
VIOLINO|Strumento ad arco più piccolo della viola
FLAUTO|Strumento a fiato dal suono limpido
CORO|Insieme di persone che cantano
ORCHESTRA|Grande formazione di strumentisti
CANTO|Uso musicale della voce
ALBUM|Raccolta di brani pubblicata insieme
BRANO|Singola composizione musicale
SINGOLO|Brano pubblicato separatamente da un album
CONCERTO|Esecuzione musicale davanti a un pubblico
JAZZ|Genere associato a improvvisazione e swing
ROCK|Genere musicale nato dal rock and roll
BLUES|Genere caratterizzato spesso da dodici battute
BASSO|Strumento che sostiene le frequenze gravi
BATTUTA|Unità ritmica delimitata nella notazione
PENTAGRAMMA|Cinque linee su cui si scrivono le note''',
'scienza':'''ATOMO|Unità fondamentale di un elemento chimico
CELLULA|Unità strutturale di base degli esseri viventi
MASSA|Quantità di materia di un corpo
ENERGIA|Capacità di compiere lavoro o produrre trasformazioni
GRAVITA|Interazione che attrae i corpi dotati di massa
PIANETA|Corpo celeste che orbita attorno a una stella
STELLA|Corpo celeste che emette luce propria
ORBITA|Traiettoria di un corpo attorno a un altro
GALASSIA|Sistema di stelle, gas e polveri
ELETTRONE|Particella dotata di carica negativa
PROTONE|Particella nucleare a carica positiva
NEUTRONE|Particella nucleare priva di carica elettrica
MOLECOLA|Insieme stabile di atomi legati tra loro
TEORIA|Sistema di principi usato per spiegare fenomeni
IPOTESI|Spiegazione provvisoria da sottoporre a verifica
ESPERIMENTO|Prova controllata per osservare un fenomeno
LASER|Dispositivo che emette luce coerente
GENE|Tratto di DNA con informazione ereditaria
DNA|Molecola che conserva informazione genetica
OTTICA|Ramo della fisica che studia la luce
FOSSILE|Resto o traccia di organismo conservato nel tempo
MICROSCOPIO|Strumento per osservare oggetti molto piccoli''',
'natura':'''BOSCO|Terreno coperto prevalentemente da alberi
FIUME|Corso d'acqua che scorre verso un lago o il mare
LAGO|Distesa di acqua circondata da terre
FOGLIA|Organo vegetale spesso deputato alla fotosintesi
RADICE|Organo che ancora la pianta al terreno
FIORE|Struttura riproduttiva di molte piante
SEME|Struttura da cui può svilupparsi una nuova pianta
ALBERO|Pianta legnosa dotata di tronco
MUSCHIO|Piccola pianta comune in ambienti umidi
FARFALLA|Insetto con ali spesso colorate
APE|Insetto impollinatore produttore di miele
LUPO|Mammifero carnivoro della famiglia dei canidi
ORSO|Grande mammifero plantigrado
VOLPE|Canide con coda folta
AQUILA|Rapace diurno dal volo potente
DELFINO|Mammifero marino che respira aria
CORALLO|Animale coloniale spesso costruttore di scogliere
HABITAT|Ambiente naturale di una specie
ECOSISTEMA|Insieme di organismi e ambiente in relazione
CLIMA|Andamento medio delle condizioni atmosferiche
PIOGGIA|Precipitazione di gocce d'acqua
ROCCIA|Aggregato naturale di minerali''',
'storia':'''IMPERO|Territorio governato da un imperatore
REGNO|Stato governato da un sovrano
RE|Sovrano di un regno
REGINA|Sovrana o consorte di un sovrano
EPOCA|Periodo storico caratterizzato da tratti comuni
SECOLO|Periodo di cento anni
DECENNIO|Periodo di dieci anni
ARCHIVIO|Luogo che conserva documenti storici
FONTE|Testimonianza usata per ricostruire il passato
CRONACA|Racconto di avvenimenti secondo il loro svolgimento
DINASTIA|Successione di sovrani della stessa famiglia
REPUBBLICA|Forma di governo priva di monarca ereditario
SENATO|Assemblea politica già presente nell'antica Roma
FORO|Piazza pubblica nell'antica città romana
MONETA|Oggetto usato come mezzo di scambio
ROTTA|Percorso seguito da navi o esploratori
COLONIA|Insediamento fondato lontano dalla comunità d'origine
BATTAGLIA|Scontro armato tra forze avversarie
TRATTATO|Accordo formale tra stati
ARTEFATTO|Oggetto prodotto da attività umana
ARCO|Elemento architettonico curvo sopra un'apertura
MUSEO|Istituzione che conserva e presenta testimonianze''',
'geografia':'''ITALIA|Paese europeo a forma di stivale
ISOLA|Terra completamente circondata dall'acqua
MARE|Ampia distesa di acqua salata
OCEANO|Vastissima massa di acqua salata
MONTE|Rilievo naturale elevato
VALLE|Depressione allungata tra rilievi
PIANURA|Territorio prevalentemente pianeggiante
DELTA|Foce fluviale divisa in più rami
ESTUARIO|Foce fluviale ampia e aperta verso il mare
CAPITALE|Città sede delle istituzioni principali di uno stato
CONFINE|Limite che separa territori
REGIONE|Ripartizione territoriale di uno stato
LATITUDINE|Distanza angolare dall'equatore
LONGITUDINE|Distanza angolare dal meridiano di Greenwich
EQUATORE|Parallelo che divide la Terra in due emisferi
POLO|Estremo dell'asse terrestre
MAPPA|Rappresentazione grafica di un territorio
SCALA|Rapporto tra distanza sulla carta e distanza reale
DESERTO|Regione con precipitazioni molto scarse
GHIACCIAIO|Massa di ghiaccio che si muove lentamente
VULCANO|Rilievo da cui possono fuoriuscire lava e gas
ARCIPELAGO|Insieme di isole vicine''',
'sport':'''GARA|Competizione sportiva
ATLETA|Persona che pratica una disciplina sportiva
PALLA|Oggetto sferico usato in numerosi sport
RETE|Nel calcio è protetta dal portiere
GOAL|Punto segnato nel calcio
PISTA|Percorso preparato per gare o allenamenti
CORSIA|Spazio riservato a un concorrente in pista o piscina
STAFFETTA|Gara di squadra con passaggi di testimone
NUOTO|Disciplina sportiva praticata in acqua
TENNIS|Sport con racchette e pallina
CALCIO|Sport di squadra con undici giocatori per parte
RUGBY|Sport di squadra con palla ovale
SCI|Attrezzi lunghi usati per scivolare sulla neve
PODIO|Piattaforma per i primi classificati
ARBITRO|Figura incaricata di far rispettare le regole
TEMPO|Misura fondamentale nelle gare di velocità
RECORD|Migliore prestazione riconosciuta
MARATONA|Corsa su una distanza di oltre quarantadue chilometri
ALLENATORE|Persona che guida la preparazione di una squadra
TORNEO|Serie organizzata di incontri sportivi
MEDAGLIA|Premio spesso assegnato ai primi classificati
TRAGUARDO|Linea che segna la fine di una corsa''',
'letteratura':'''LIBRO|Opera scritta pubblicata in volume
ROMANZO|Narrazione di finzione generalmente lunga
POESIA|Composizione basata anche su ritmo e immagini
VERSO|Singola riga di una poesia
STROFA|Gruppo di versi di un testo poetico
RIMA|Somiglianza di suoni alla fine dei versi
AUTORE|Chi scrive un'opera
TRAMA|Successione degli eventi narrati
PERSONAGGIO|Figura che agisce in un racconto
CAPITOLO|Divisione di un libro
PAGINA|Facciata di un foglio di un libro
EDITORE|Soggetto che pubblica opere
BIBLIOTECA|Luogo di conservazione e consultazione di libri
FAVOLA|Racconto breve spesso con una morale
FIABA|Narrazione fantastica di tradizione popolare
SONETTO|Componimento poetico di quattordici versi
DIALOGO|Scambio di battute tra personaggi
PROLOGO|Sezione che precede il racconto principale
EPILOGO|Parte conclusiva di una narrazione
METAFORA|Figura retorica che trasferisce un significato
NARRATORE|Voce che racconta gli eventi
LESSICO|Insieme delle parole di una lingua''',
'tecnologia':'''CODICE|Insieme di istruzioni scritte in un linguaggio
PIXEL|Elemento minimo di una immagine digitale
RETE|Insieme di dispositivi collegati
SERVER|Sistema che offre servizi ad altri dispositivi
BROWSER|Programma per consultare pagine web
HTML|Linguaggio di marcatura delle pagine web
CSS|Linguaggio che definisce lo stile delle pagine web
SCRIPT|Sequenza di istruzioni eseguibili
CACHE|Memoria per conservare dati di uso frequente
DATABASE|Archivio organizzato di informazioni
BACKUP|Copia di sicurezza dei dati
CLOUD|Infrastruttura informatica accessibile via rete
ROUTER|Dispositivo che inoltra pacchetti tra reti
SENSORE|Dispositivo che rileva una grandezza fisica
DISPLAY|Schermo per visualizzare dati
BIT|Unità minima di informazione binaria
BYTE|Gruppo composto normalmente da otto bit
LINK|Collegamento ipertestuale
DOMINIO|Nome che identifica un sito sulla rete
PROTOCOLLO|Insieme di regole per comunicare
OPEN|Parola inglese che indica apertura
PORTA|Interfaccia per collegare dispositivi''',
'curiosita':'''ENIGMA|Questione che richiede ingegno per essere risolta
LABIRINTO|Percorso intricato con bivi
BUSSOLA|Strumento per orientarsi
SPECCHIO|Superficie che riflette le immagini
CALENDARIO|Sistema di organizzazione dei giorni
OROLOGIO|Strumento che misura il tempo
MERIDIANA|Strumento che indica il tempo con l'ombra
ARCOBALENO|Fenomeno ottico con colori nel cielo
OMBRELLO|Oggetto usato per ripararsi dalla pioggia
BOLLA|Piccola sfera di gas in un liquido
ECO|Ripetizione di un suono riflesso
GRAVITA|Forza che fa cadere gli oggetti verso il suolo
MOSAICO|Immagine composta da piccoli pezzi
CHIAVE|Oggetto che apre una serratura
CODICE|Sistema di segni per rappresentare informazioni
SFERA|Solido rotondo in tutte le direzioni
SPIRALE|Curva che gira attorno a un centro
NUMERO|Elemento usato per contare
LETTERA|Segno di un alfabeto
PAROLA|Insieme di lettere con significato
DOMANDA|Frase con cui si chiede un'informazione
RISPOSTA|Ciò che viene dato a una domanda'''
}
NAMES={'cinema':'Cinema','musica':'Musica','scienza':'Scienza','natura':'Natura','storia':'Storia','geografia':'Geografia','sport':'Sport','letteratura':'Letteratura','tecnologia':'Tecnologia','curiosita':'Curiosità'}

def words_for(key):
    out=[]
    for line in RAW[key].splitlines():
        word,clue=line.strip().split('|',1)
        word=word.upper().replace(' ','')
        if 3<=len(word)<=14 and re.fullmatch('[A-Z]+',word):out.append((word,clue))
    return out


def load_filler_bank(root):
    import csv
    csv_file=root/'assets/games/crossword-fillers.csv'
    if not csv_file.exists():
        return []
    with csv_file.open(encoding='utf-8-sig',newline='') as stream:
        rows=csv.DictReader(stream)
        return [(row['word'].strip().upper(),row['clue_it'].strip()) for row in rows
                if row.get('lang')=='it' and re.fullmatch('[A-Z]{2,6}',row['word'].strip().upper()) and row.get('clue_it')]

def select_filler_bank(data, fillers, limit=64):
    from collections import Counter
    freq=Counter(c for word,_ in data for c in set(word))
    existing={word for word,_ in data}
    candidates=[entry for entry in fillers if entry[0] not in existing]
    candidates.sort(key=lambda p:(-sum(freq.get(c,0) for c in p[0])/len(p[0]),abs(len(p[0])-3),p[0]))
    return candidates[:limit]

def construct(data,seed,max_words=48,attempts=12):
    rng=random.Random(seed)
    N=33
    main_words={w for w,_ in data if len(w)>6}
    # Two-letter entries are fillers and may be placed only without growing the board.
    short_words={w for w,_ in data if len(w)==2}
    best=None
    # Random-restart greedy placement, selecting candidates by compactness and crosses.
    for iteration in range(attempts):
        board={}; placements=[]; used=set()
        start=rng.choice(data[:min(12,len(data))]); direction=iteration%2
        r=N//2 if not direction else (N-len(start[0]))//2
        c=(N-len(start[0]))//2 if not direction else N//2
        def install(item,row,col,d,hits):
            word=item[0];dr,dc=((0,1) if d==0 else (1,0))
            for i,ch in enumerate(word):board[(row+i*dr,col+i*dc)]=ch
            placements.append((item,row,col,d));used.add(word)
        install(start,r,c,direction,0)
        while len(placements)<min(len(data),max(8,max_words)):
            minr=min(k[0] for k in board);maxr=max(k[0] for k in board)
            minc=min(k[1] for k in board);maxc=max(k[1] for k in board)
            oldarea=(maxr-minr+1)*(maxc-minc+1)
            options=[]
            for item in data:
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
                                    if ex!=ch2 or any(p[3]==d and any((p[1]+(0 if d==0 else n),p[2]+(n if d==0 else 0))==(yy,xx) for n in range(len(p[0][0]))) for p in placements):good=False;break
                                    hits+=1
                                elif ((yy+dc,xx+dr) in board or (yy-dc,xx-dr) in board):good=False;break
                            if not good or hits<1:continue
                            nr=min(minr,rr);xr=max(maxr,er);nc=min(minc,cc);xc=max(maxc,ec)
                            newarea=(xr-nr+1)*(xc-nc+1)
                            growth=newarea-oldarea
                            if word in short_words and (growth != 0 or len(placements) < 12):continue
                            score=hits*95-growth*5.8+len(word)*3+ (26 if len(word)<=8 else 0)-abs((xr-nr)-(xc-nc))*2
                            if word in short_words:score+=95
                            if word in main_words:score+=70
                            score+=rng.random()*25
                            options.append((score,item,rr,cc,d,hits))
            if not options:break
            options.sort(key=lambda z:z[0],reverse=True)
            pick=options[0]
            install(pick[1],pick[2],pick[3],pick[4],pick[5])
        minr=min(k[0] for k in board);maxr=max(k[0] for k in board)
        minc=min(k[1] for k in board);maxc=max(k[1] for k in board)
        rows=maxr-minr+1;cols=maxc-minc+1;area=rows*cols
        occupied=len(board)
        score=len(placements)*140+occupied/area*1000-area*3.0-abs(rows-cols)*18+sum(p[0][0] in main_words for p in placements)*110
        if best is None or score>best[0]:best=(score,placements,board,minr,minc,rows,cols)
    # Second pass: fill *existing* footprint, never enlarge it. Prefer slots
    # with two or more crossings and fully validate every new across/down run.
    _, placed, board, minr, minc, rows, cols = best
    placed=list(placed);board=dict(board)
    used={p[0][0] for p in placed}
    occupied_dir={}
    for item,r,c,d in placed:
        dr,dc=((0,1) if d==0 else (1,0))
        for i in range(len(item[0])):occupied_dir[(r+i*dr,c+i*dc,d)]=True
    for _ in range(min(25,max_words-len(placed))):
        winner=None
        for item in data:
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
                        if not ok or hits<2 or not added:continue
                        quality=hits*120+len(word)*4-added*2+(70 if len(word)<=4 else 0)
                        if winner is None or quality>winner[0]:winner=(quality,item,r,c,d)
        if winner is None:break
        _,item,r,c,d=winner
        dr,dc=((0,1) if d==0 else (1,0))
        for i,ch in enumerate(item[0]):
            y=r+i*dr;x=c+i*dc;board[(y,x)]=ch;occupied_dir[(y,x,d)]=True
        placed.append((item,r,c,d));used.add(item[0])
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
    return {'version':1,'rows':rows,'cols':cols,'blacks':blacks,'letters':['']*(rows*cols),'clues':clues,'clueSources':sources,'ui':{'mode':'play','dir':'a','selected':-1,'lang':'it'},'mrcEditorial':{'topic':NAMES.get(seed[0] if isinstance(seed,tuple) else '', ''),'answers':answers,'credit':'Definizioni originali MRC; non provenienti dai siti del catalogo'}}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',default='.');ap.add_argument('--daily',default=None,help='YYYY-MM-DD; default today');a=ap.parse_args()
    root=pathlib.Path(a.root);dest=root/'assets/games/crosswords';dest.mkdir(parents=True,exist_ok=True)
    manifest={'version':1,'games':[]}
    filler_bank=load_filler_bank(root)
    for k in NAMES:
        data=words_for(k)
        result=construct(data+select_filler_bank(data,filler_bank,limit=54),k,max_words=36,attempts=8)
        if not result:raise RuntimeError(f'Failed to create valid puzzle for {k}')
        result['mrcEditorial']['topic']=NAMES[k]
        result['mrcEditorial']['credit']='Definizioni originali MRC (non estratte automaticamente da articoli)'
        filename=f'mrc-tema-{k}.json'
        (dest/filename).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        manifest['games'].append({'id':k,'file':filename,'title':NAMES[k],'language':'it','type':'curated'})
        print(k,len(result['clues']),f"{result['rows']}x{result['cols']}")
    date=datetime.date.fromisoformat(a.daily) if a.daily else datetime.date.today()
    key=list(NAMES)[(date.toordinal())%len(NAMES)]
    # TEMPORARY EDITORIAL FALLBACK ONLY. Not current events; do not market this as a news crossword.
    # A true news crossword requires an approved live news feed and fact-checked answer/clue pairs.
    # An existing daily is never labeled as today's news: this is an editorial thematic puzzle.
    all_keys=list(NAMES);pos=all_keys.index(key)
    chosen=[all_keys[(pos+j)%len(all_keys)] for j in (0,3)]
    collected=[];seen=set()
    for topic in chosen:
        for word,clue in words_for(topic):
            if word not in seen:
                collected.append((word,clue));seen.add(word)
    daily=construct(collected+select_filler_bank(collected,filler_bank,limit=85),('daily-'+str(date)),max_words=48,attempts=8)
    if daily is None or len(daily['clues'])<28:
        raise RuntimeError('Cruciverba del giorno non sufficientemente ricco: non pubblicare una versione incompleta')
    daily['mrcEditorial']['topic']='Anteprima editoriale · '+' · '.join(NAMES[t] for t in chosen)
    daily['mrcEditorial']['dailyDate']=str(date)
    daily['mrcEditorial']['credit']='Selezione tematica MRC; non basata su notizie in tempo reale'
    (dest/'mrc-del-giorno.json').write_text(json.dumps(daily,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    manifest['games'].insert(0,{'id':'daily','file':'mrc-del-giorno.json','title':'Cruciverba editoriale di prova','language':'it','type':'editorial-preview','date':str(date)})
    # Preserve manually authored existing games and omit non-existent paths.
    old=dest/'index.json'
    if old.exists():
        previous=json.loads(old.read_text(encoding='utf8'))
        known={x['file'] for x in manifest['games']}
        manifest['games'] += [x for x in previous.get('games',[]) if x.get('file') not in known and (dest/x.get('file','')).exists()]
    old.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if __name__=='__main__':main()
