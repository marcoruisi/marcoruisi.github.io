"""Tool Flows regression tests. Run: python3 -m unittest -v test_tool_flows"""
from pathlib import Path
from html.parser import HTMLParser
import json
import unittest
import xml.etree.ElementTree as ET
from render_tool_flows import FLOW_URLS, flow_page_content
from update_shared_ui import ROOT, HOST, plan_shared_ui, dataset_checked, index_content

class Elements(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items=[]
    def handle_starttag(self,tag,attrs):
        self.items.append((tag,dict(attrs)))
    def count_class(self,name):
        return sum(name in attrs.get('class','').split() for _,attrs in self.items)

class ToolFlowsTests(unittest.TestCase):
    def test_actual_public_domain(self):
        from generate_sitemap import HOST as sitemap_host
        self.assertEqual(HOST,'https://marcorui.si')
        self.assertEqual(sitemap_host,HOST)

    def test_examples_use_existing_tools(self):
        data=json.loads((ROOT/'shared/tool-flows.json').read_text(encoding='utf-8'))
        tools={t['id']:t for t in dataset_checked(ROOT)['tools']}
        self.assertEqual(data['pages'],FLOW_URLS)
        self.assertEqual(len(data['examples']),3)
        for flow in data['examples']:
            self.assertEqual([step['kind'] for step in flow['steps']],['input','tool','tool','output'])
            for step in flow['steps']:
                if step['kind']=='tool':
                    self.assertIn(step['tool'],tools)
                    for route in tools[step['tool']]['url'].values():
                        self.assertTrue((ROOT/route.strip('/')/'index.html').is_file())

    def test_rendered_examples_and_languages(self):
        for lang,route in FLOW_URLS.items():
            content=flow_page_content(ROOT,lang)
            parser=Elements();parser.feed(content)
            self.assertEqual(parser.count_class('mrc-flow-example'),3)
            self.assertEqual(parser.count_class('mrc-flow-step'),12)
            self.assertEqual(parser.count_class('mrc-flow-step--tool'),6)
            self.assertNotIn('<script',content)
            for tag,a in parser.items:
                if tag=='a':
                    self.assertTrue(a['href'].startswith('/it/') if lang=='it' else not a['href'].startswith('/it/'))
            page=(ROOT/route.strip('/')/'index.html').read_text(encoding='utf-8')
            self.assertIn(content,page)
            self.assertIn('font', (ROOT/'assets/tool-flows.css').read_text())

    def test_prompt_in_each_catalogue_page(self):
        for tool in dataset_checked(ROOT)['tools']:
            for lang,route in tool['url'].items():
                page=(ROOT/route.strip('/')/'index.html').read_text(encoding='utf-8')
                parser=Elements();parser.feed(page)
                self.assertEqual(parser.count_class('mrc-flow-prompt'),1,route)
                self.assertIn(f'href="{FLOW_URLS[lang]}"',page)
                self.assertLess(page.index('MRC SHARED TOOL FLOWS START'),page.index('MRC SHARED TOOL FEEDBACK START'))

    def test_index_invitation_survives_generation(self):
        data=dataset_checked(ROOT)
        for lang in ('en','it'):
            for everyday in (False,True):
                content=index_content(ROOT,data['tools'],data['tags'],lang,everyday)
                parser=Elements();parser.feed(content)
                self.assertEqual(parser.count_class('mrc-flow-prompt'),1)
                self.assertIn(f'href="{FLOW_URLS[lang]}"',content)

    def test_sitemap_and_editorial_connections(self):
        ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
        urls=[el.text for el in ET.parse(ROOT/'sitemap.xml').findall('s:url/s:loc',ns)]
        for lang,route in FLOW_URLS.items():
            self.assertEqual(urls.count(HOST+route),1)
            story=ROOT/('it/storie/connessioni/index.html' if lang=='it' else 'stories/connections/index.html')
            self.assertIn(f'href="{route}"',story.read_text())

    def test_flow_pages_use_technical_shell(self):
        for lang,route in FLOW_URLS.items():
            page=(ROOT/route.strip('/')/'index.html').read_text(encoding='utf-8')
            parser=Elements(); parser.feed(page)
            self.assertEqual(parser.count_class('mrc-tool-header'),1,route)
            self.assertEqual(parser.count_class('topbar'),0,route)
            self.assertEqual(parser.count_class('site-popup-menu'),0,route)
            self.assertIn('<main class="app mrc-flows">',page)
            self.assertNotIn('/assets/style.min.css',page)
            self.assertNotIn('/assets/menu.js',page)
            self.assertLess(page.index('MRC SHARED TOOL HEADER START'),page.index('<main'))
            self.assertLess(page.index('</main>'),page.index('MRC SHARED FOOTER START'))
            for css in ('shared-ui','tool-shell','tools-content','tool-flows-fonts','tool-flows'):
                self.assertEqual(page.count(f'href="/assets/{css}.css"'),1,route)
            current=[attrs for tag,attrs in parser.items if tag=='a'
                     and attrs.get('aria-label')=='Tool Flows'
                     and attrs.get('aria-current')=='page']
            self.assertEqual([a['href'] for a in current],[route])

    def test_flow_typography_uses_existing_manrope_faces(self):
        css=(ROOT/'assets/tool-flows.css').read_text(encoding='utf-8')
        fonts=(ROOT/'assets/tool-flows-fonts.css').read_text(encoding='utf-8')
        self.assertNotIn('Georgia',css)
        self.assertNotIn('Times New Roman',css)
        for weight,filename in ((400,'Regular'),(500,'Medium'),(800,'ExtraBold')):
            self.assertIn(f'font-weight:{weight}',fonts)
            self.assertTrue((ROOT/f'fonts/Manrope-{filename}.woff2').is_file())
        self.assertIn('font-weight:600',css)
        self.assertTrue((ROOT/'fonts/Manrope-SemiBold.woff2').is_file())
        self.assertIn('var(--panel',css)

    def test_flow_fonts_remain_page_only(self):
        for tool in dataset_checked(ROOT)['tools']:
            for route in tool['url'].values():
                page=(ROOT/route.strip('/')/'index.html').read_text(encoding='utf-8')
                self.assertNotIn('/assets/tool-flows-fonts.css',page,route)

    def test_flow_intro_matches_compact_catalogue(self):
        for lang in FLOW_URLS:
            content=flow_page_content(ROOT,lang)
            parser=Elements(); parser.feed(content)
            self.assertEqual(parser.count_class('breadcrumb'),0)
            self.assertEqual(parser.count_class('intro'),1)
            self.assertIn('<h1>Tool Flows</h1>',content)
        css=(ROOT/'assets/tool-flows.css').read_text(encoding='utf-8')
        title=css.split('.mrc-flows-intro h1{',1)[1].split('}',1)[0]
        self.assertIn('font-size:28px',title)
        self.assertIn('font-weight:600',title)
        self.assertIn('margin:0 0 8px',title)
        self.assertNotIn('font-weight:800',title)

    def test_endpoints_are_explicit_static_input_and_output(self):
        for lang in FLOW_URLS:
            content=flow_page_content(ROOT,lang)
            parser=Elements(); parser.feed(content)
            self.assertEqual(parser.count_class('mrc-flow-step--input'),3)
            self.assertEqual(parser.count_class('mrc-flow-step--output'),3)
            input_label='Input \u00b7 Partenza' if lang=='it' else 'Input \u00b7 Start'
            output_label='Output \u00b7 Risultato' if lang=='it' else 'Output \u00b7 Result'
            self.assertEqual(content.count(input_label),3)
            self.assertEqual(content.count(output_label),3)
            nodes=[(tag,a) for tag,a in parser.items if 'mrc-flow-node' in a.get('class','').split()]
            self.assertEqual(sum(tag=='div' for tag,a in nodes),6)
            self.assertEqual(sum(tag=='a' for tag,a in nodes),6)
        css=(ROOT/'assets/tool-flows.css').read_text(encoding='utf-8')
        self.assertIn('.mrc-flow-step--input .mrc-flow-node{background:var(--border',css)
        self.assertIn('.mrc-flow-step--output .mrc-flow-node{background:var(--text',css)
        self.assertNotIn('border-style:dashed',css)

    def test_build_is_idempotent(self):
        for path,text in plan_shared_ui().items():
            self.assertEqual(path.read_text(encoding='utf-8'),text,str(path.relative_to(ROOT)))

if __name__=='__main__':
    unittest.main()
