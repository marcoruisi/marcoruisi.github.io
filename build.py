#!/usr/bin/env python3
"""Local preparation only: shared UI -> discovery checks -> sitemap. No Git/network."""
from collections import deque
from urllib.parse import urljoin, urlparse, unquote
from update_shared_ui import ROOT, plan_shared_ui, write_if_changed, dataset_checked
import re
from generate_sitemap import HOST, inspect_pages, sitemap_text


def check_discovery(pages):
    graph = {url: set() for url in pages}
    for url, (path, parser, text) in pages.items():
        if 'marcoruisi.github.io' in text or 'marcoruisi.com' in text:
            raise ValueError(f'Hostname precedente: {path}')
        for href, rel in parser.links:
            target = urljoin(url, href)
            parsed = urlparse(target)
            if parsed.netloc != 'marcoruisi.pages.dev':
                continue
            file = ROOT / unquote(parsed.path).lstrip('/')
            if file.is_dir():
                file = file / 'index.html'
            if not file.is_file():
                raise ValueError(f'Link interno mancante: {path} -> {href}')
            target_url = parsed._replace(query='', fragment='').geturl()
            if target_url in pages and 'nofollow' not in rel.split():
                graph[url].add(target_url)
            if parsed.fragment and target_url in pages and unquote(parsed.fragment) not in pages[target_url][1].ids:
                raise ValueError(f'Ancora interna mancante: {path} -> {href}')
        for source in parser.resources:
            parsed = urlparse(urljoin(url, source))
            if parsed.netloc == 'marcoruisi.pages.dev' and not (ROOT / unquote(parsed.path).lstrip('/')).is_file():
                raise ValueError(f'Asset mancante: {path} -> {source}')
        for lang, target in parser.alternates:
            if target not in pages:
                raise ValueError(f'Alternativa lingua mancante: {path} -> {target}')
            if lang != 'x-default' and url not in [u for _, u in pages[target][1].alternates]:
                raise ValueError(f'Hreflang non reciproco: {path} -> {target}')
            if lang in ('en', 'it') and pages[target][1].lang != lang:
                raise ValueError(f'Hreflang/HTML lang discordanti: {path} -> {target}')
        if not parser.noindex and {l for l, _ in parser.alternates} != {'en', 'it', 'x-default'}:
            raise ValueError(f'Hreflang duplicati/mancanti: {path}')
        if re.search(r'(?:AIza[\w-]{30,}|sk_(?:live|test)_[\w]{12,}|gh[pousr]_[\w]{20,}|(?:pk|sk)\.eyJ[\w.-]{20,})', text):
            raise ValueError(f'Possibile credenziale reale nel frontend: {path}')
    for tool in dataset_checked(ROOT)['tools']:
        for lang, route in tool['url'].items():
            path, parser, text = pages[HOST + route]
            if parser.noindex:
                raise ValueError(f'Tool ufficiale noindex: {path}')
            downloads = [h for h, _ in parser.links if urlparse(h).path.endswith('.zip')]
            if tool['availability'] == 'on-request' and downloads:
                raise ValueError(f'ON REQUEST espone download: {path}')
            if tool.get('download') and downloads != [tool['download']]:
                raise ValueError(f'Download FREE incoerente: {path}')
    found, pending = set(), deque([HOST + '/'])
    while pending:
        url = pending.popleft()
        if url in found:
            continue
        found.add(url)
        pending.extend(graph.get(url, set()) - found)
    unreachable = [url for url, (_, parser, _) in pages.items() if not parser.noindex and url not in found]
    if unreachable:
        raise ValueError(f'Pagine non raggiungibili dalla home tramite link HTML: {unreachable}')
    return len(found)


def main():
    planned = plan_shared_ui()
    pages = inspect_pages(ROOT, planned)
    reachable = check_discovery(pages)
    xml = sitemap_text(ROOT, planned)
    count = sum(write_if_changed(path, text) for path, text in planned.items())
    count += write_if_changed(ROOT / 'sitemap.xml', xml)
    print(f'Build locale: {count} file aggiornati; {sum(not p.noindex for _, p, _ in pages.values())} URL indicizzabili; {reachable} pagine raggiungibili dalla home. Nessuna operazione Git o rete.')


if __name__ == '__main__':
    main()
