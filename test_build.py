"""Regression tests for shared footer and publication preserving working files."""
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from update_shared_ui import replace_footer, marked, plan_shared_ui, tool_header, editorial_header, request_mailto, request_cta, dataset_checked, index_content, feedback_cta, HOST, ROOT
from urllib.parse import urlparse, parse_qs
from publish_local import align_history, publish


class BuildTests(unittest.TestCase):
    def test_dropbox_conflict_copy_is_not_a_public_page(self):
        from update_shared_ui import page_files
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'index.html').write_text('<!doctype html><title>Original</title>')
            conflict = root / 'index (Copia in conflitto di MBP-di-Marco.fritz.box 2026-10-08).html'
            conflict.write_text('<!doctype html><title>Conflict</title>')
            self.assertEqual([path.name for path, _ in page_files(root)], ['index.html'])
            self.assertTrue(conflict.exists())

    def test_editorial_tools_link_shared_and_unique(self):
        for lang in ('en', 'it'):
            language = '<nav class="header-language"><a href="/">EN</a><span>/</span><a href="/it/">IT</a></nav>'
            menu = '<button class="menu-trigger" data-popup-menu-toggle>Menu</button>'
            for existing in ('', '<a class="header-tools" href="/tools/">Tools</a>'):
                source = '<div class="topbar"><a href="/">mrc</a><div class="header-actions">' + existing + language + menu + '</div></div>'
                output = editorial_header(ROOT, source, lang)
                self.assertEqual(output.count('class="header-tools"'), 1)
                self.assertIn('href="' + ('/it/tools/' if lang == 'it' else '/tools/') + '">Tools</a>', output)
                self.assertIn(language, output)
                self.assertEqual(output.count('data-popup-menu-toggle'), 1)
                self.assertIn('aria-controls="site-popup-menu"', output)
                self.assertNotIn('target=', output)
                self.assertEqual(editorial_header(ROOT, output, lang), output)

    def test_shared_tool_feedback(self):
        import re
        from html import unescape
        tools = dataset_checked(ROOT)['tools']
        for tool in tools:
            for lang in ('en', 'it'):
                content = feedback_cta(ROOT, tool, lang)
                query = parse_qs(urlparse(unescape(re.search(r'href="([^"]+)"', content)[1])).query)
                self.assertEqual(query['subject'][0], f'MRC — {tool["name"][lang]} — Feedback')
                self.assertIn(HOST + tool['url'][lang], query['body'][0])
                page = (ROOT / tool['url'][lang].strip('/') / 'index.html').read_text()
                self.assertEqual(page.count('MRC SHARED TOOL FEEDBACK START'), 1)
                if 'MRC SHARED TOOL AFTERWORD START' in page:
                    self.assertLess(page.index('MRC SHARED TOOL FEEDBACK START'), page.index('MRC SHARED TOOL AFTERWORD START'))
        for rel in ('index.html', 'it/index.html', 'tools/index.html', 'tools/all/index.html', 'it/tools/index.html', 'it/tools/tutti/index.html'):
            self.assertNotIn('mrc-tool-feedback', (ROOT / rel).read_text())

    def test_direct_plugin_email(self):
        for tool in dataset_checked(ROOT)['tools']:
            if tool['availability'] != 'on-request': continue
            for lang in ('en', 'it'):
                parsed = urlparse(request_mailto(tool, lang))
                self.assertEqual(parsed.scheme, 'mailto')
                self.assertEqual(parsed.path, 'marcoruisi@gmail.com')
                query = parse_qs(parsed.query)
                self.assertEqual(query['subject'][0], tool['name'][lang] + (' — richiesta plugin' if lang == 'it' else ' — plugin request'))
                self.assertIn(HOST + tool['url'][lang], query['body'][0])
                self.assertIn(tool['name'][lang], query['body'][0])
                content = request_cta(ROOT, tool, lang)
                self.assertNotIn('<form', content)
                self.assertNotIn('<script', content)
                self.assertIn('mailto:', content)
                self.assertIn('preventivo' if lang == 'it' else 'quote', content)

    def test_catalogue_filter_dimensions(self):
        data = dataset_checked(ROOT)
        self.assertEqual([f['value'] for f in data['views']], ['all', 'everyday'])
        self.assertEqual([f['value'] for f in data['filters']], ['wordpress', 'images', 'pdf', 'html', 'compression'])
        for field, value, count in [('type', 'plugin', 6), ('type', 'snippet', 4), ('availability', 'free', 13), ('availability', 'on-request', 4)]:
            self.assertEqual(sum(t[field] == value for t in data['tools']), count)
        for lang in ('en', 'it'):
            content = index_content(ROOT, data['tools'], data['tags'], lang, False)
            self.assertEqual(content.count('class="mrc-tool-row"'), 17)
            self.assertEqual(content.count('data-tool-availability="on-request"'), 4)
            self.assertNotIn('data-filter-field="availability"', content)
            self.assertNotIn('data-filter-field="type"', content)
            self.assertNotIn('mrc-tool-tags', content)
            self.assertIn('mrc-tool-views', content)
            self.assertIn('mrc-tool-scopes', content)
            self.assertEqual(content.count('class="mrc-tool-model"'), 17)

    def test_print_pdf_to_web_integrated(self):
        tool = next(t for t in dataset_checked(ROOT)['tools'] if t['id'] == 'print-pdf-to-web')
        self.assertEqual(tool['tags'], ['everyday', 'pdf'])
        self.assertEqual((tool['type'], tool['availability']), ('tool', 'free'))
        for lang in ('en', 'it'):
            text = (ROOT / tool['url'][lang].strip('/') / 'index.html').read_text()
            self.assertIn('src="/tools/print-pdf-to-web/tool.mjs"', text)
            self.assertIn('src="/tools/images-to-pdf/pdf-lib-1.17.1.min.js"', text)
            self.assertIn('href="' + ('/it/tools/pdf-compressor/' if lang == 'it' else '/tools/pdf-compressor/') + '"', text)
            self.assertIn('MRC SHARED TOOL AFTERWORD START', text)
        for name in ('pdf.min.mjs', 'pdf.worker.min.mjs', 'LICENSE-pdfjs.txt'):
            self.assertTrue((ROOT / 'tools/print-pdf-to-web/vendor' / name).is_file())

    def test_complete_header_and_home_menu(self):
        for path in [ROOT/'index.html', ROOT/'it/index.html', ROOT/'work/index.html', ROOT/'it/lavoro/index.html']:
            text = path.read_text()
            self.assertEqual(text.count('MRC SHARED SITE HEADER START'), 1)
            self.assertEqual(text.count('class="header-tools"'), 1)
            self.assertEqual(text.count('data-popup-menu-toggle'), 1)
            self.assertEqual(text.count('id="site-popup-menu"'), 1)
            self.assertEqual(text.count('src="/assets/menu.js"'), 1)
            self.assertNotIn('src="/assets/menu.min.js"', text)

    def test_tool_header_returns_to_language_home(self):
        pair = {'en': '/tools/webp-compressor/', 'it': '/it/tools/webp-compressor/'}
        for lang, home in [('en', '/'), ('it', '/it/')]:
            header = tool_header(ROOT, lang, pair, pair[lang])
            self.assertIn('class="mrc-tools-brand" href="' + home + '"', header)
            self.assertIn('>← MRC</a>', header)
            self.assertNotIn('target=', header)
            self.assertIn('Everyday Tools', header)
            self.assertIn('href="' + pair['en'] + '" lang="en"', header)
            self.assertIn('href="' + pair['it'] + '" lang="it"', header)

    def test_footer_legacy_marked_new_absent(self):
        footer = '<footer class="footer mrc-site-footer">new</footer>'
        variants = ['', '<footer class="footer">old</footer>', '<footer><div class="foot">old</div></footer>', marked('FOOTER', footer)]
        for old in variants:
            source = '<!doctype html><body>' + old + '</body>'
            rendered = replace_footer(source, footer)
            self.assertEqual(rendered.count('MRC SHARED FOOTER START'), 1)
            self.assertEqual(replace_footer(rendered, footer), rendered)
        with self.assertRaises(ValueError):
            replace_footer('<body><footer>a</footer><footer>b</footer></body>', footer)

    def test_current_build_idempotent(self):
        self.assertEqual(plan_shared_ui(), {})

    @unittest.skipUnless(os.environ.get('MRC_RUN_ISOLATED_GIT_TESTS') == '1', 'Opt-in only: isolated Git integration test; no Git operations in normal checks')
    def test_remote_advance_divergence_and_real_push_preserve_working_files(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp); bare = base / 'remote.git'; a = base / 'a'; b = base / 'b'
            def run(root, *args):
                return subprocess.run(['git', *args], cwd=root, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True).stdout
            run(base, 'init', '--bare', str(bare))
            run(base, 'clone', str(bare), str(a))
            run(a, 'checkout', '-b', 'main')
            for root in [a]:
                run(root, 'config', 'user.name', 'MRC local test'); run(root, 'config', 'user.email', 'test@example.invalid')
            (a/'content.html').write_text('baseline'); (a/'build.py').write_text("print('Test build OK')\n")
            run(a,'add','.');run(a,'commit','-m','Initial');run(a,'push','-u','origin','main')
            run(base,'clone','--branch','main',str(bare),str(b))
            run(b,'config','user.name','MRC local test');run(b,'config','user.email','test@example.invalid')
            (b/'content.html').write_text('remote publish');run(b,'add','.');run(b,'commit','-m','Online change');run(b,'push')
            (a/'local.txt').write_text('unpublished commit');run(a,'add','.');run(a,'commit','-m','Local change')
            (a/'content.html').write_text('Dropbox later change');(a/'new.txt').write_text('new Dropbox file')
            def hashes():
                return {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in a.iterdir() if p.is_file()}
            before = hashes();align_history(a);self.assertEqual(before,hashes())
            self.assertIn('mrc-history-before-sync-',run(a,'branch'))
            publish('Publish Dropbox state',a)
            self.assertEqual(before,hashes());self.assertEqual(run(a,'status','--porcelain'),'')
            self.assertEqual(run(a,'rev-parse','HEAD'),run(a,'rev-parse','origin/main'))
            self.assertEqual(run(bare,'show','main:content.html').strip(),'Dropbox later change')


if __name__ == '__main__':
    unittest.main()
