"""Conservative, reusable event relations; never turn arbitrary headline tokens into clues."""
import re
from collect_crossword_news import normalized

def relations(title,summary):
    text=' '.join(summary.split())
    # Do not convert uncertain, denied or predicted events into asserted facts.
    unsafe=r'\b(?:non|forse|potrebbe|avrebbe|dovrebbe|presunto|accusato|sospetto)\b|[?]'
    proposals=[]
    # An explicit match score identifies both opponents and the result.
    m=re.match(r"([A-ZÀ-Ö][\wÀ-ÿ ]{2,25})-([A-ZÀ-Ö][\wÀ-ÿ ]{2,25}) (\d{1,2})-(\d{1,2})(?:,|:|$)",title)
    if m and int(m[3])!=int(m[4]):
        winner,loser=(m[1],m[2]) if int(m[3])>int(m[4]) else (m[2],m[1])
        proposals.append((winner,f'Ha battuto {loser.strip()} per {max(int(m[3]),int(m[4]))} a {min(int(m[3]),int(m[4]))}','match-result','sport'))
    m=re.fullmatch(r'([^,:]{4,55}), ([A-ZÀ-Ö][A-Za-zÀ-ÿ]{2,14}) vince ([^.!?]{8,100})',title)
    if m and not re.search(unsafe,title,re.I):
        proposals.append((m[2],f'Ha vinto {m[1]}','event-winner','sport'))
    # Location is attached to an explicit opening event, not merely mentioned.
    m=re.fullmatch(r'([^:]{8,90}):\s*a ([A-ZÀ-Ö][a-zà-ÿ]{2,14}) si apre ([^.!?]{8,100})',title)
    if m and not re.search(unsafe,title,re.I):
        proposals.append((m[2],f'Ospita l’apertura di {m[1].strip()}','event-opening-city','scienza'))
    m=re.fullmatch(r'([^,:]{8,80}) al via a ([A-ZÀ-Ö][a-zà-ÿ]{2,14}), [^.!?]+',title)
    if m and not re.search(unsafe,title,re.I):
        proposals.append((m[2],f'La città in cui sono iniziati {m[1].lower()}','event-start-city','sport'))
    # Named university + explicit discovery/development: the place is the institution's name.
    m=re.search(r"(?:Università|università) (?:di |dell[’'])([A-ZÀ-Ö][a-zà-ÿ]{2,14})(?: \([^)]{1,30}\))? ha (scoperto|sviluppato|rilevato) ([^.!?;]{15,150})(?:[.!?;]|$)",text)
    if m and not re.search(unsafe,m[0],re.I):
        detail=m[3].split(':')[0].strip()
        proposals.append((m[1],f'Dà il nome all’università che ha {m[2]} {detail}','university-result','scienza'))
    # Explicit exhibition relation; the artist, not any incidental word, is the answer.
    m=re.fullmatch(r'[^:]{4,70}: alle ([^,]{5,65}) in scena l’universo di ([A-ZÀ-Ö][a-zà-ÿ]{2,14})\s*',title)
    if m:
        proposals.append((m[2],f'L’artista protagonista dell’esposizione alle {m[1]}','exhibition-artist','cultura'))
    for word,clue,rule,category in proposals:
        word=normalized(word)
        if re.fullmatch('[A-Z]{3,15}',word) and len(clue)<=210 and not any(normalized(t)==word for t in re.findall(r'\w+',clue)):
            yield word,clue,rule,category
