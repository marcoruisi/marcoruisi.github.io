"""Regression tests for shared footer and publication preserving working files."""
import hashlib
from pathlib import Path
import subprocess
import tempfile
import unittest
from update_shared_ui import replace_footer, marked, plan_shared_ui, tool_header, request_mailto, request_cta, dataset_checked, index_content, HOST, ROOT
from urllib.parse import urlparse, parse_qs
from publish_local import align_history, publish


class BuildTests(unittest.TestCase):
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
        self.assertEqual([f['value'] for f in data['filters']], ['everyday', 'wordpress', 'plugin', 'snippet', 'free', 'on-request', 'images', 'pdf', 'html', 'compression'])
        for field, value, count in [('type', 'plugin', 6), ('type', 'snippet', 4), ('availability', 'free', 12), ('availability', 'on-request', 4)]:
            self.assertEqual(sum(t[field] == value for t in data['tools']), count)
        for lang in ('en', 'it'):
            content = index_content(ROOT, data['tools'], data['tags'], lang, False)
            self.assertEqual(content.count('class="mrc-tool-row"'), 16)
            self.assertEqual(content.count('data-tool-availability="on-request"'), 4)
            self.assertIn('data-filter-field="availability"', content)

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
