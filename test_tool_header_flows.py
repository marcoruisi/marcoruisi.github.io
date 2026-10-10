"""Tool header regression tests. Run: python3 -m unittest -v test_tool_header_flows."""
import re
import unittest
from html.parser import HTMLParser
from update_shared_ui import ROOT, INDEX_PAIRS, dataset_checked, plan_shared_ui, tool_header
from render_tool_flows import FLOW_URLS


class NavigationLinks(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.in_tools_nav = False
        self.links = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'nav':
            self.in_tools_nav = 'mrc-tools-nav' in attrs.get('class', '').split()
        elif tag == 'a' and self.in_tools_nav:
            self.links.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'nav':
            self.in_tools_nav = False


class ToolHeaderFlowsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pairs = [dict(zip(('en', 'it'), pair)) for pair in INDEX_PAIRS]
        cls.pairs.extend(t['url'] for t in dataset_checked(ROOT)['tools'])

    def test_links_in_order_and_correct_language(self):
        for pair in self.pairs:
            for lang, current in pair.items():
                with self.subTest(lang=lang, current=current):
                    header = tool_header(ROOT, lang, pair, current)
                    links = NavigationLinks(header).links
                    expected = [
                        '/it/' if lang == 'it' else '/',
                        '/it/tools/' if lang == 'it' else '/tools/',
                        '/it/tools/tutti/' if lang == 'it' else '/tools/all/',
                        FLOW_URLS[lang],
                    ]
                    self.assertEqual([a['href'] for a in links], expected)
                    self.assertEqual(links[-1]['aria-label'], 'Tool Flows')
                    self.assertNotIn('target', links[-1])
                    self.assertNotIn('aria-current', links[-1])
                    self.assertIn('<span class="mrc-nav-short" aria-hidden="true">Tool Flows</span>', header)

    def test_saved_headers_match_shared_generator(self):
        for pair in self.pairs:
            for lang, current in pair.items():
                with self.subTest(lang=lang, current=current):
                    page = (ROOT / current.strip('/') / 'index.html').read_text(encoding='utf-8')
                    matches = re.findall(
                        r'<!-- MRC SHARED TOOL HEADER START -->\s*(.*?)\s*<!-- MRC SHARED TOOL HEADER END -->',
                        page, re.S,
                    )
                    self.assertEqual(len(matches), 1)
                    self.assertEqual(matches[0].strip(), tool_header(ROOT, lang, pair, current).strip())

    def test_current_index_and_language_switcher_preserved(self):
        for pair in self.pairs:
            for lang, current in pair.items():
                header = tool_header(ROOT, lang, pair, current)
                links = NavigationLinks(header).links
                active = [a['href'] for a in links if a.get('aria-current') == 'page']
                self.assertEqual(active, [current] if current in [u for p in INDEX_PAIRS for u in p] else [])
                for language, url in pair.items():
                    self.assertIn(f'href="{url}" lang="{language}"', header)

    def test_shared_build_is_stable(self):
        self.assertEqual(plan_shared_ui(), {})


if __name__ == '__main__':
    unittest.main()
