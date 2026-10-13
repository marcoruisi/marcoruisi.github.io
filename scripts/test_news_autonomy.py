"""Offline checks for RSS summary proposals; no fetching, generation or publishing.
Run: python3 scripts/test_news_autonomy.py
The RSS adapter fixture contains attributed excerpts, not prewritten clue pairs.
"""
import datetime as dt
from pathlib import Path
import unittest

from collect_crossword_news import collect, entries, summary_candidates

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT/'scripts/fixtures/news-excerpts'
DAY = dt.date(2026,10,13)


class SummaryTests(unittest.TestCase):
    def test_automatic_pairs_from_excerpts(self):
        rows, audit = collect(ROOT, DAY, FIXTURE)
        self.assertEqual({r['word'] for r in rows},
                         {'SMILE','MAGNETOSFERA','SHAPIRO','GALASSIE'})
        self.assertTrue(all(r['reviewed']=='no' and r['rule'] and
                            r['source_url'].startswith('https://www.media.inaf.it/')
                            and r['language']=='it' for r in rows))
        self.assertEqual(sum(r['used_articles'] for r in audit),2)
        self.assertEqual(len({r['source_url'] for r in rows}),2)

    def test_uncertainty_and_old_news_rejected(self):
        base='Lo scorso 23 settembre la missione Smile ha iniziato ufficialmente la sua attività scientifica.'
        for text in ['', 'Testo senza un fatto riconosciuto', base+' Forse è una simulazione.',
                     base.replace('ha iniziato','avrebbe iniziato')]:
            self.assertEqual(list(summary_candidates('Test',text,'Test',
                             'https://example.invalid/test',DAY)),[])
        self.assertEqual(collect(ROOT,DAY+dt.timedelta(days=3),FIXTURE)[0],[])

    def test_existing_entry_interface(self):
        payload=(FIXTURE/'inaf.xml').read_bytes()
        self.assertTrue(all(len(item)==3 for item in entries(payload)))
        self.assertTrue(all(len(item)==4 and item[3] for item in entries(payload,True)))


if __name__=='__main__':
    unittest.main()
