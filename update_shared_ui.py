#!/usr/bin/env python3
"""Render shared fragments into complete HTML files; no browser-side includes."""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parent


def page_files(root=ROOT):
    for path in sorted(root.rglob('*.html')):
        rel = path.relative_to(root)
        if any(part.startswith('.') for part in rel.parts) or rel.parts[0] == 'shared':
            continue
        text = path.read_text(encoding='utf-8')
        if re.search(r'<!doctype\s+html', text, re.I):
            yield path, text


def route(path, root=ROOT):
    rel = path.relative_to(root).as_posix()
    return '/' + (rel[:-10] if rel.endswith('index.html') else rel)


def marked(name, content):
    return f'<!-- MRC SHARED {name} START -->\n{content.strip()}\n<!-- MRC SHARED {name} END -->'


def replace_block(text, name, content, legacy=None):
    start, end = f'<!-- MRC SHARED {name} START -->', f'<!-- MRC SHARED {name} END -->'
    if text.count(start) != text.count(end) or text.count(start) > 1:
        raise ValueError(f'Marcatori ambigui: {name}')
    pattern = re.escape(start) + r'.*?' + re.escape(end)
    if start in text:
        return re.sub(pattern, lambda _: marked(name, content), text, flags=re.S)
    if legacy:
        matches = list(re.finditer(legacy, text, re.S))
        if len(matches) != 1:
            raise ValueError(f'Blocco iniziale {name}: atteso uno, trovati {len(matches)}')
        return re.sub(legacy, lambda _: marked(name, content), text, count=1, flags=re.S)
    if text.count('</body>') != 1:
        raise ValueError('Chiusura body mancante o ambigua')
    return text.replace('</body>', marked(name, content) + '\n</body>')


def template(root, name, context=None):
    text = (root / 'shared' / name).read_text(encoding='utf-8').strip()
    for key, value in (context or {}).items():
        text = text.replace('{{' + key + '}}', value)
    if re.search(r'{{[^}]+}}', text):
        raise ValueError(f'Variabile non risolta in {name}')
    return text


def link(url, label, current=None):
    active = ' aria-current="page"' if url == current else ''
    return f'<a href="{html.escape(url, quote=True)}"{active}>{html.escape(label)}</a>'


def plan_shared_ui(root=ROOT):
    tools = json.loads((root / 'shared' / 'tools.json').read_text(encoding='utf-8'))
    tool_by_url = {tool['url'][lang]: tool for tool in tools for lang in ('en', 'it')}
    if len(tool_by_url) != 2 * len(tools):
        raise ValueError('URL Tools duplicati')
    planned = {}
    for path, original in page_files(root):
        text = original
        lang_match = re.search(r'<html\b[^>]*\blang=["\'](en|it)["\']', text, re.I)
        if not lang_match:
            raise ValueError(f'Lingua non riconosciuta: {path}')
        lang = lang_match[1]
        url = route(path, root)
        for css in ('/assets/shared-ui.css',):
            if f'href="{css}"' not in text:
                text = text.replace('</head>', f'<link rel="stylesheet" href="{css}">\n</head>')
        if url in tool_by_url:
            tool = tool_by_url[url]
            for css in ('/assets/tool-shell.css',):
                if f'href="{css}"' not in text:
                    text = text.replace('</head>', f'<link rel="stylesheet" href="{css}">\n</head>')
            context = {
                'tools_index': '/it/tools/' if lang == 'it' else '/tools/',
                'language_label': 'Selezione lingua' if lang == 'it' else 'Language selection',
                'tool_links': '\n        '.join(link(t['url'][lang], t['name'][lang].split(' / ')[0], url) for t in tools),
                'language_links': ' / '.join(
                    f'<a href="{tool["url"][l]}" lang="{l}"' + (' aria-current="page"' if l == lang else '') + f'>{l.upper()}</a>' for l in ('en', 'it')),
            }
            text = replace_block(text, 'TOOL HEADER', template(root, 'tool-header.html', context),
                                 r'<nav class="mrc-tools-nav"[^>]*>.*?</nav>|<header class="tool-header"[^>]*>.*?</header>')
            text = replace_block(text, 'TOOL AFTERWORD', template(root, f'tool-afterword.{lang}.html'),
                                 r'<footer class="mrc-tool-afterword"[^>]*>.*?</footer>')
            # Exact counterparts, not runtime language changes or mixed-language blocks.
            text = re.sub(r'<link\b[^>]*\brel="alternate"[^>]*>', '', text)
            alternates = '\n'.join(f'<link rel="alternate" hreflang="{l}" href="https://marcoruisi.pages.dev{tool["url"][l]}">' for l in ('en', 'it'))
            alternates += f'\n<link rel="alternate" hreflang="x-default" href="https://marcoruisi.pages.dev{tool["url"]["en"]}">'
            # Dedicated markers prevent extra whitespace accumulating across builds.
            text = replace_head_block(text, 'TOOL ALTERNATES', alternates)
            text = replace_block(text, 'FOOTER', template(root, 'footer.html'))
        else:
            text = replace_block(text, 'FOOTER', template(root, 'footer.html'), r'<footer class="footer"[^>]*>.*?</footer>')
            if '<!-- MRC POPUP MENU START -->' in text or '<!-- MRC SHARED MENU START -->' in text:
                menu = template(root, f'menu.{lang}.html')
                menu = re.sub(r'(<a\s+href="([^"]+)")', lambda m: m[1] + (' aria-current="page"' if m[2] == url else ''), menu)
                text = replace_block(text, 'MENU', menu, r'<!-- MRC POPUP MENU START -->.*?<!-- MRC POPUP MENU END -->')
            if url in ('/tools/', '/it/tools/'):
                open_label = 'Apri lo strumento →' if lang == 'it' else 'Open tool →'
                cards = '\n'.join(f'<section class="story-card"><span class="story-number">{i:02d}</span><h2>{html.escape(t["name"][lang])}</h2><p>{html.escape(t["description"][lang])}</p><p>{link(t["url"][lang], open_label)}</p></section>' for i, t in enumerate(tools, 1))
                text = replace_block(text, 'TOOLS LIST', '<div class="stories-list">\n' + cards + '\n</div>', r'<div class="stories-list">.*?</div>')
        if text != original:
            planned[path] = text
    return planned


def replace_head_block(text, name, content):
    start, end = f'<!-- MRC SHARED {name} START -->', f'<!-- MRC SHARED {name} END -->'
    if start in text:
        return re.sub(re.escape(start) + r'.*?' + re.escape(end), lambda _: marked(name, content), text, flags=re.S)
    return text.replace('</head>', marked(name, content) + '\n</head>')


def write_if_changed(path, text):
    if path.exists() and path.read_text(encoding='utf-8') == text:
        return False
    temporary = path.with_name(path.name + '.mrc-tmp')
    temporary.write_text(text, encoding='utf-8')
    temporary.replace(path)
    return True


if __name__ == '__main__':
    changes = plan_shared_ui()
    for path, text in changes.items():
        write_if_changed(path, text)
    print(f'Shared UI: {len(changes)} file aggiornati.')
