#!/usr/bin/env python3
"""Sitemap from actual complete, indexable, self-canonical HTML pages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
from update_shared_ui import ROOT, page_files, route, write_if_changed

HOST = 'https://marcoruisi.pages.dev'
NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.canonicals = []
        self.noindex = False
        self.links = []
        self.ids = []
        self.h1 = 0
        self.alternates = []
        self.resources = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.append(a['id'])
        if tag == 'h1':
            self.h1 += 1
        if tag == 'meta' and a.get('name', '').lower() in ('robots', 'googlebot'):
            self.noindex |= 'noindex' in a.get('content', '').lower()
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonicals.append(a.get('href', ''))
        if tag == 'link' and a.get('rel') == 'alternate' and a.get('hreflang'):
            self.alternates.append((a['hreflang'], a.get('href', '')))
        if tag == 'a' and a.get('href'):
            self.links.append((a['href'], a.get('rel', '')))
        if tag in ('img', 'script', 'source', 'iframe') and a.get('src'):
            self.resources.append(a['src'])
        if tag == 'link' and a.get('rel') in ('stylesheet', 'icon') and a.get('href'):
            self.resources.append(a['href'])


def inspect_pages(root=ROOT, planned=None):
    pages = {}
    for path, original in page_files(root):
        text = (planned or {}).get(path, original)
        parser = PageParser()
        parser.feed(text)
        url = HOST + route(path, root)
        if len(parser.ids) != len(set(parser.ids)):
            raise ValueError(f'ID HTML duplicati: {path}')
        if parser.h1 != 1:
            raise ValueError(f'H1: atteso uno in {path}')
        if not parser.noindex and parser.canonicals != [url]:
            raise ValueError(f'Canonical assente/ambiguo/non self: {path}: {parser.canonicals}')
        pages[url] = (path, parser, text)
    return pages


def sitemap_text(root=ROOT, planned=None):
    pages = inspect_pages(root, planned)
    ET.register_namespace('', NS)
    tree = ET.Element(f'{{{NS}}}urlset')
    for url, (_, parser, _) in sorted(pages.items()):
        if parser.noindex:
            continue
        if urlparse(url).netloc != 'marcoruisi.pages.dev':
            raise ValueError(f'Host sitemap non valido: {url}')
        entry = ET.SubElement(tree, f'{{{NS}}}url')
        ET.SubElement(entry, f'{{{NS}}}loc').text = url
    # No synthetic lastmod based on local download/build times.
    ET.indent(tree, space='  ')
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(tree, encoding='unicode') + '\n'


if __name__ == '__main__':
    text = sitemap_text()
    changed = write_if_changed(ROOT / 'sitemap.xml', text)
    print(f'Sitemap: {"aggiornata" if changed else "invariata"}.')
