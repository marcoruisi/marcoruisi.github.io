"""Small offline checks. All news examples below are SYNTHETIC, not real news.

Run: python3 scripts/test_crossword_generation.py
No feed, workflow, published puzzle or user storage is touched.
"""
import csv
import datetime as dt
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

from collect_crossword_news import candidates
from build_crossword_collection import construct, load_filler_bank, select_filler_bank, words_for
from build_crossword_collection import bank_categories

ROOT = pathlib.Path(__file__).resolve().parents[1]
DAY = dt.date(2026, 10, 13)


def metrics(puzzle):
    rows, cols = puzzle['rows'], puzzle['cols']
    board = {}
    crossings = 0
    for key, word in puzzle['mrcEditorial']['answers'].items():
        direction, start = key.split(':')
        for n, letter in enumerate(word):
            pos = int(start) + n * (1 if direction == 'a' else cols)
            assert 0 <= pos < rows * cols
            if pos in board:
                assert board[pos] == letter
                crossings += 1
            board[pos] = letter
    assert set(board) == {i for i, black in enumerate(puzzle['blacks']) if not black}
    keys = set()
    for i in board:
        r, c = divmod(i, cols)
        if (c == 0 or i-1 not in board) and c+1 < cols and i+1 in board:
            keys.add('a:'+str(i))
        if (r == 0 or i-cols not in board) and r+1 < rows and i+cols in board:
            keys.add('d:'+str(i))
    assert keys == puzzle['clues'].keys()
    reached, pending = set(), [next(iter(board))]
    while pending:
        i = pending.pop()
        if i in reached:
            continue
        reached.add(i)
        r, c = divmod(i, cols)
        for rr, cc in ((r-1,c), (r+1,c), (r,c-1), (r,c+1)):
            pos = rr*cols+cc
            if 0 <= rr < rows and 0 <= cc < cols and pos in board and pos not in reached:
                pending.append(pos)
    assert len(reached) == len(board)
    assert all(isinstance(c, str) and c.strip() for c in puzzle['clues'].values())
    return {'density': round(len(board)/(rows*cols),4), 'words': len(keys),
            'crossings': crossings, 'connected': True, 'missing': 0}


class GenerationTests(unittest.TestCase):
    def test_extended_bank_and_real_news_fixture(self):
        with (ROOT/'assets/games/crossword-fillers.csv').open(encoding='utf8') as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual(len(rows), len({r['word'] for r in rows}))
        self.assertTrue(all(r['clue_it'].strip() for r in rows))
        bank = load_filler_bank(ROOT,'scienza')
        self.assertIn('TELESCOPIO',dict(bank))
        self.assertNotIn('INQUADRATURA',dict(bank))
        categories = bank_categories(ROOT,'scienza')
        self.assertEqual(categories['TELESCOPIO'],'tematica')
        self.assertEqual(categories['QUADERNO'],'generale')
        self.assertEqual(categories['AGO'],'raccordo')
        puzzle = json.loads((ROOT/'scripts/fixtures/news-2026-10-13/preview-2026-10-13.json').read_text())
        metrics(puzzle)
        editorial = puzzle['mrcEditorial']
        self.assertEqual(editorial['verifiedNewsClues'],4)
        self.assertFalse(editorial['reviewRequired'])
        expected = {'SMILE','ESA','SHAPIRO','SUBARU'}
        self.assertEqual({w for k,w in editorial['answers'].items()
                          if editorial['wordCategories'][k]=='principale'},expected)
        self.assertIn('tematica',editorial['wordCategories'].values())
        self.assertEqual(sum(bool(s['url']) for s in puzzle['clueSources'].values()),4)

    def proposals(self):
        titles = [
            'Mario Rossi vince il premio dimostrativo di narrativa',
            'Anna Bianchi riceve il riconoscimento dimostrativo di ricerca',
            'Roma ospita una mostra dimostrativa sulla pittura',
            'Euclid osserva una galassia nel caso di prova',
        ]
        return [next(candidates(title, 'FONTE SINTETICA', 'test',
                    'https://example.invalid/test/'+str(i), DAY))
                for i, title in enumerate(titles)]

    def test_relations_not_title_tokens(self):
        rows = self.proposals()
        self.assertEqual([r['word'] for r in rows], ['ROSSI','BIANCHI','ROMA','EUCLID'])
        self.assertTrue(all(r['reviewed'] == 'no' and r['source_title'] for r in rows))
        for title in ['Random English headline wins something',
                      'Mario Rossi non vince il premio dimostrativo',
                      'Mario Rossi vince il premio? Forse domani',
                      'Una scoperta importante cambia tutto']:
            self.assertEqual(list(candidates(title,'Test','test','https://example.invalid',DAY)), [])

    def test_three_existing_themes(self):
        for topic in ('cinema','scienza','natura'):
            data = words_for(topic)
            fillers = select_filler_bank(data,load_filler_bank(ROOT),24)
            puzzle = construct(data+fillers,topic,max_words=28,attempts=3,
                               primary_words=set(dict(data)))
            result = metrics(puzzle)
            result['primary'] = sum(w in dict(data) for w in puzzle['mrcEditorial']['answers'].values())
            print(topic, json.dumps(result))

    def test_preview_and_publication_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = pathlib.Path(tmp)
            path = folder/'synthetic.csv'
            rows = self.proposals()
            def write():
                with path.open('w',newline='',encoding='utf8') as stream:
                    writer = csv.DictWriter(stream,fieldnames=list(rows[0]))
                    writer.writeheader();writer.writerows(rows)
            write()
            command = [sys.executable,str(ROOT/'scripts/build_daily_news_crossword.py'),
                       '--root',str(ROOT),'--input',str(path),'--date',str(DAY),
                       '--min-news','4','--min-placed-news','3']
            result = subprocess.run(command+['--output-dir',str(folder/'preview')],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            puzzle = json.loads((folder/'preview'/f'preview-{DAY}.json').read_text())
            metrics(puzzle)
            self.assertTrue(puzzle['mrcEditorial']['reviewRequired'])
            self.assertEqual(puzzle['mrcEditorial']['verifiedNewsClues'],0)
            # Same proposals must fail BEFORE writing a published file.
            result = subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            # Old dates, foreign language and mechanical clues cannot pass even preview.
            rows[0]['published_at'] = '2026-10-10'
            rows[1]['language'] = 'en'
            rows[2]['clue_it'] = 'Nelle notizie di test: termine associato a prova'
            write()
            result = subprocess.run(command+['--output-dir',str(folder/'rejected')],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertFalse((folder/'rejected').exists())


if __name__ == '__main__':
    unittest.main()
