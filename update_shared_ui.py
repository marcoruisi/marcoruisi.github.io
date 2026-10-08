#!/usr/bin/env python3
"""Render shared fragments into complete HTML files; no browser-side includes."""
from pathlib import Path
import html
import json
import re
from urllib.parse import quote, urlencode

ROOT = Path(__file__).resolve().parent


def page_files(root=ROOT):
    for path in sorted(root.rglob('*.html')):
        rel = path.relative_to(root)
        if any(part.startswith('.') for part in rel.parts) or rel.parts[0] == 'shared':
            continue
        # Dropbox sync conflict copies are preserved for review, not public pages.
        if re.search(r' \(Copia in conflitto di .+ \d{4}-\d{2}-\d{2}\)\.html$', path.name):
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

def replace_footer(text, content):
    start, end = '<!-- MRC SHARED FOOTER START -->', '<!-- MRC SHARED FOOTER END -->'

    if text.count(start) != text.count(end) or text.count(start) > 1:
        raise ValueError('Marcatori ambigui: FOOTER')

    if start in text:
        pattern = re.escape(start) + r'.*?' + re.escape(end)
        return re.sub(pattern, lambda _: marked('FOOTER', content), text, flags=re.S)

    legacy = r'<footer\b(?![^>]*mrc-tool-afterword)[^>]*>.*?</footer>'
    matches = list(re.finditer(legacy, text, re.S | re.I))

    if len(matches) == 1:
        return re.sub(legacy, lambda _: marked('FOOTER', content), text, count=1, flags=re.S | re.I)

    if len(matches) > 1:
        raise ValueError(f'Blocco iniziale FOOTER ambiguo: trovati {len(matches)} footer compatibili')

    if text.lower().count('</body>') != 1:
        raise ValueError('FOOTER assente e chiusura body mancante o ambigua')

    return re.sub(
        r'</body>',
        lambda _: marked('FOOTER', content) + '\n</body>',
        text,
        count=1,
        flags=re.I
    )



def normalize_page_url_metadata(text, url):
    """Force canonical and og:url to the page's actual public URL."""
    canonical = f'<link rel="canonical" href="https://marcoruisi.pages.dev{url}">'
    og_url = f'<meta property="og:url" content="https://marcoruisi.pages.dev{url}">'

    # Remove any existing canonical/og:url regardless of attribute order.
    text = re.sub(
        r'<link\b(?=[^>]*\brel=["\']canonical["\'])[^>]*>\s*',
        '',
        text,
        flags=re.I
    )
    text = re.sub(
        r'<meta\b(?=[^>]*\bproperty=["\']og:url["\'])[^>]*>\s*',
        '',
        text,
        flags=re.I
    )

    if len(re.findall(r'</head>', text, re.I)) != 1:
        raise ValueError(f'Chiusura head mancante o ambigua per {url}')

    metadata = canonical + '\n' + og_url + '\n'
    return re.sub(r'</head>', metadata + '</head>', text, count=1, flags=re.I)


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


HOST = 'https://marcoruisi.pages.dev'
INDEX_PAIRS = [('/tools/', '/it/tools/'), ('/tools/all/', '/it/tools/tutti/')]


def dataset_checked(root):
    dataset = json.loads((root / 'shared/tools.json').read_text(encoding='utf-8'))
    tools, tags = dataset['tools'], dataset['tags']
    filters = dataset.get('filters', [])
    if not filters or len({f['value'] for f in filters}) != len(filters):
        raise ValueError('Filtri Tools assenti/duplicati')
    allowed = {'tags': set(tags), 'type': {'tool', 'snippet', 'plugin'}, 'availability': {'free', 'on-request'}}
    for item in filters:
        if item.get('field') not in allowed or item.get('value') not in allowed[item['field']] or set(item.get('label', {})) != {'en', 'it'}:
            raise ValueError(f'Filtro Tools non valido: {item}')
    views = dataset.get('views', [])
    if [v.get('value') for v in views] != ['all', 'everyday']:
        raise ValueError('Viste Tools mancanti/non valide')
    for item in views:
        if set(item.get('label', {})) != {'en', 'it'} or item.get('field') != ('view' if item['value'] == 'all' else 'tags'):
            raise ValueError(f'Vista Tools non valida: {item}')
    if len({t['id'] for t in tools}) != len(tools):
        raise ValueError('ID Tools duplicati')
    urls = set()
    for tool in tools:
        if tool.get('type') not in ('tool', 'snippet', 'plugin') or tool.get('availability') not in ('free', 'on-request'):
            raise ValueError(f'Tipo/disponibilità non validi: {tool["id"]}')
        if not tool.get('tags') or any(tag not in tags for tag in tool['tags']):
            raise ValueError(f'Tag mancanti/sconosciuti: {tool["id"]}')
        for lang in ('en', 'it'):
            url = tool['url'][lang]
            if url in urls or not url.startswith('/') or not url.endswith('/'):
                raise ValueError(f'URL Tools duplicato/non valido: {url}')
            urls.add(url)
            if not (root / url.strip('/') / 'index.html').is_file():
                raise ValueError(f'Pagina Tools assente: {url}')
        if tool['availability'] == 'on-request' and tool.get('download'):
            raise ValueError(f'Download vietato per ON REQUEST: {tool["id"]}')
        if tool['type'] == 'plugin' and tool['availability'] == 'free':
            download = tool.get('download', '')
            if not download.startswith('/downloads/') or not (root / download.lstrip('/')).is_file():
                raise ValueError(f'Download FREE assente: {tool["id"]}')
            import zipfile
            with zipfile.ZipFile(root / download.lstrip('/')) as archive:
                if archive.testzip():
                    raise ValueError(f'ZIP corrotto: {download}')
    return dataset


def remove_marked(text, name):
    start, end = f'<!-- MRC SHARED {name} START -->', f'<!-- MRC SHARED {name} END -->'
    if text.count(start) != text.count(end) or text.count(start) > 1:
        raise ValueError(f'Marcatori ambigui: {name}')
    return re.sub(re.escape(start) + r'.*?' + re.escape(end) + r'\s*', '', text, flags=re.S)


def metadata(text, url, pair, lang, tool=None, index=False):
    # Normalize stale domains only for this site's own URLs, including JSON-LD.
    text = re.sub(r'https?://(?:www\.)?(?:marcoruisi\.com|marcoruisi\.github\.io)(?=[/"\s])', HOST, text)
    text = remove_marked(text, 'METADATA')
    text = remove_marked(text, 'TOOL ALTERNATES')
    text = re.sub(r'<link\b(?=[^>]*\brel=["\'](?:canonical|alternate)["\'])[^>]*>\s*', '', text, flags=re.I)
    text = re.sub(r'<meta\b(?=[^>]*\bproperty=["\'](?:og:url|og:site_name)["\'])[^>]*>\s*', '', text, flags=re.I)
    content = f'<meta property="og:site_name" content="Marco Ruisi">'
    if url != '/404.html':
        content += f'\n<link rel="canonical" href="{HOST}{url}">\n<meta property="og:url" content="{HOST}{url}">'
        if not pair:
            raise ValueError(f'Paire lingua assente: {url}')
        content += '\n' + '\n'.join(f'<link rel="alternate" hreflang="{l}" href="{HOST}{pair[l]}">' for l in ('en', 'it'))
        content += f'\n<link rel="alternate" hreflang="x-default" href="{HOST}{pair["en"]}">'
    if tool or index:
        text = re.sub(r'<meta\b(?=[^>]*\bname=["\'](?:robots|googlebot)["\'])[^>]*>\s*', '', text, flags=re.I)
        title = tool['name'][lang] + ' | MRC · Marco Ruisi' if tool else ('Everyday Tools' if url in INDEX_PAIRS[0] else ('Tutti gli strumenti' if lang == 'it' else 'All Tools')) + ' | Marco Ruisi'
        desc = tool['description'][lang] if tool else (('Strumenti gratuiti per immagini e PDF: scegli un problema e risolvilo direttamente nel browser.' if lang == 'it' else 'Free tools for images and PDFs: choose a problem and solve it directly in your browser.') if url in INDEX_PAIRS[0] else ('Strumenti, snippet e plugin WordPress nati da problemi reali. Catalogo completo MRC, gratuito o su richiesta.' if lang == 'it' else 'Tools, WordPress snippets and plugins born from real problems. The complete MRC catalogue, free or on request.'))
        text = re.sub(r'<title>.*?</title>\s*', '', text, flags=re.S)
        text = re.sub(r'<meta\b(?=[^>]*\b(?:name|property)=["\'](?:description|og:title|og:description|twitter:title|twitter:description|og:type|og:locale)["\'])[^>]*>\s*', '', text, flags=re.I)
        content += f'\n<title>{html.escape(title)}</title>\n<meta name="description" content="{html.escape(desc, quote=True)}">\n<meta property="og:type" content="website">\n<meta property="og:locale" content="{"it_IT" if lang == "it" else "en_GB"}">'
        for prop, value in [('og:title', title), ('og:description', desc), ('twitter:title', title), ('twitter:description', desc)]:
            content += f'\n<meta {"property" if prop.startswith("og:") else "name"}="{prop}" content="{html.escape(value, quote=True)}">'
        if tool and tool['type'] != 'tool':
            text = re.sub(r'<script\b[^>]*type="application/ld\+json"[^>]*>.*?</script>\s*', '', text, flags=re.S)
            schema = {'@context': 'https://schema.org', '@type': 'TechArticle' if tool['type'] == 'snippet' else 'SoftwareApplication', 'name': tool['name'][lang], 'description': desc, 'url': HOST + url, 'inLanguage': lang, 'author': {'@id': HOST + '/#person'}}
            if tool['type'] == 'plugin':
                schema.update(applicationCategory='DeveloperApplication', operatingSystem='WordPress')
                if tool.get('version'): schema['softwareVersion'] = tool['version']
                if tool.get('download'): schema['downloadUrl'] = HOST + tool['download']
                if tool['availability'] == 'free': schema['isAccessibleForFree'] = True
            content += '\n<script type="application/ld+json">' + json.dumps(schema, ensure_ascii=False) + '</script>'
    return text.replace('</head>', marked('METADATA', content) + '\n</head>')


def language_pairs(files, tools):
    from urllib.parse import urlparse
    pairs = {}
    def put(pair):
        for url in pair.values():
            if url in pairs and pairs[url] != pair:
                raise ValueError(f'Coppie lingua discordanti: {url}')
            pairs[url] = pair
    for en, it in INDEX_PAIRS: put({'en': en, 'it': it})
    for tool in tools: put(tool['url'])
    for path, text in files:
        url = route(path)
        if url in pairs or url == '/404.html': continue
        alternates = {}
        for tag in re.findall(r'<link\b[^>]*>', text, re.I):
            attrs = dict(re.findall(r'([\w:-]+)=["\']([^"\']*)["\']', tag))
            if attrs.get('rel') == 'alternate' and attrs.get('hreflang') in ('en', 'it'):
                alternates[attrs['hreflang']] = urlparse(attrs['href']).path
        if set(alternates) == {'en', 'it'}: put(alternates)
    return pairs


def editorial_header(root, text, lang):
    """Generate one complete header, preserving the existing language equivalents."""
    language = re.findall(r'<nav class="header-language"[^>]*>.*?</nav>', text, re.S)
    if len(language) != 1:
        raise ValueError('Header editoriale: switch lingua assente/duplicato')
    utilities = template(root, 'header-utilities.html', {
        'tools_url': '/it/tools/' if lang == 'it' else '/tools/',
        'language_navigation': language[0],
    })
    content = template(root, 'site-header.html', {
        'home_url': '/it/' if lang == 'it' else '/',
        'home_label': 'Home MRC' if lang == 'it' else 'MRC home',
        'utilities': utilities,
        'open_label': 'Apri menu' if lang == 'it' else 'Open menu',
        'close_label': 'Chiudi menu' if lang == 'it' else 'Close menu',
    })
    if '<!-- MRC SHARED SITE HEADER START -->' in text:
        return replace_block(text, 'SITE HEADER', content)
    starts = list(re.finditer(r'<div class="topbar">', text))
    if len(starts) != 1:
        raise ValueError('Header editoriale: topbar assente/duplicata')
    start = starts[0].start()
    depth = 0
    for tag in re.finditer(r'</?div\b[^>]*>', text[start:]):
        depth += -1 if tag[0].startswith('</') else 1
        if depth == 0:
            return text[:start] + marked('SITE HEADER', content) + text[start + tag.end():]
    raise ValueError('Header editoriale: topbar non chiusa')


def tool_header(root, lang, pair, current):
    everyday = '/it/tools/' if lang == 'it' else '/tools/'
    all_url = '/it/tools/tutti/' if lang == 'it' else '/tools/all/'
    links = link(everyday, 'Everyday Tools', current) + link(all_url, 'Tutti gli strumenti' if lang == 'it' else 'All Tools', current)
    language = '<span class="mrc-language-separator" aria-hidden="true">/</span>'.join(f'<a href="{pair[l]}" lang="{l}"' + (' aria-current="page"' if l == lang else '') + f'>{l.upper()}</a>' for l in ('en', 'it'))
    return template(root, 'tool-header.html', {'site_home': '/it/' if lang == 'it' else '/', 'home_label': 'Home MRC' if lang == 'it' else 'MRC home', 'tool_links': links, 'language_label': 'Selezione lingua' if lang == 'it' else 'Language selection', 'language_links': language})


def status(tool, tags, lang):
    words = {'tool': 'TOOL', 'snippet': 'SNIPPET', 'plugin': 'PLUGIN'}
    availability = 'ON REQUEST' if tool['availability'] == 'on-request' else 'FREE'
    return f'<p class="mrc-tool-model">{words[tool["type"]]} · {availability}</p>'


def related_tools(tool, tools):
    weights = {'everyday': 0.1, 'wordpress': 0.5, 'plugin': 0.2, 'snippet': 0.2, 'gravity-forms': 5, 'elementor': 5, 'csv': 4, 'access': 4, 'compression': 4, 'images': 3, 'pdf': 3, 'html': 3, 'text': 3}
    scores = [(sum(weights.get(tag, 2) for tag in set(tool['tags']) & set(t['tags'])), t) for t in tools if t['id'] != tool['id']]
    # Stable dataset order breaks ties. Curated fallback favours same audience/type.
    ranked = sorted(scores, key=lambda x: (-x[0], x[1]['type'] != tool['type'], tools.index(x[1])))
    return [t for _, t in ranked[:3]]


def request_mailto(tool, lang):
    name = tool['name'][lang]
    subject = name + (' — richiesta plugin' if lang == 'it' else ' — plugin request')
    body = (f'Ciao Marco, mi interessa {name}. Vorrei utilizzarlo per:' if lang == 'it' else f"Hi Marco, I'm interested in {name}. I would like to use it for:")
    body += '\r\n\r\n\r\n' + HOST + tool['url'][lang]
    return 'mailto:marcoruisi@gmail.com?' + urlencode({'subject': subject, 'body': body}, quote_via=quote)


def feedback_cta(root, tool, lang):
    footer = (root / 'shared/footer.html').read_text(encoding='utf-8')
    emails = re.findall(r'href="mailto:([^"?]+)"', footer)
    if not emails or not re.fullmatch(r'[^\s@]+@[^\s@]+', emails[0]):
        raise ValueError('Email di contatto condivisa assente/non valida')
    name = tool['name'][lang]
    page = HOST + tool['url'][lang]
    body = (f'Tool: {name}\r\nPagina: {page}\r\n\r\nTipo di segnalazione: problema / suggerimento / altro\r\n\r\nDescrizione:\r\n\r\n\r\nBrowser e dispositivo (facoltativo):'
            if lang == 'it' else
            f'Tool: {name}\r\nPage: {page}\r\n\r\nFeedback type: bug / suggestion / other\r\n\r\nDescription:\r\n\r\n\r\nBrowser and device (optional):')
    mailto = 'mailto:' + emails[0] + '?' + urlencode({'subject': f'MRC — {name} — Feedback', 'body': body}, quote_via=quote)
    return template(root, f'tool-feedback.{lang}.html', {'feedback_mailto': html.escape(mailto, quote=True)})


def request_cta(root, tool, lang):
    it = lang == 'it'
    pick = lambda a, b: a if it else b
    quote = pick('Verificherò se la versione esistente è adatta al tuo caso. Se sono necessarie configurazioni, integrazioni o personalizzazioni, riceverai un preventivo prima di qualsiasi intervento.', 'I’ll check whether the existing version fits your case. If configuration, integration or customisation is required, I’ll send you a quote before any work begins.')
    ctx = {'heading': pick('Richiedi questo plugin →', 'Request this plugin →'), 'quote': quote, 'mailto': html.escape(request_mailto(tool, lang), quote=True)}
    return template(root, 'plugin-request.html', ctx)


def index_content(root, tools, tags, lang, everyday):
    it = lang == 'it'; pick = lambda a, b: a if it else b
    title = 'Everyday Tools' if everyday else pick('Tutti gli strumenti', 'All Tools')
    content = f'<h1>{title}</h1><p class="intro">' + (pick('Piccoli strumenti gratuiti. Scegli cosa vuoi fare.', 'Small, free tools. Choose what you need to do.') if everyday else pick('Strumenti, snippet e plugin nati da problemi reali. Gratuiti o su richiesta.', 'Tools, snippets and plugins born from real problems. Free or on request.')) + '</p>'
    if everyday:
        rows = ''.join(f'<li><a href="{t["url"][lang]}"><h2>{html.escape(t["action"][lang])}</h2><p>{html.escape(t["name"][lang])}</p><span aria-hidden="true">→</span></a></li>' for t in tools if 'everyday' in t['tags'])
        content += '<ul class="mrc-everyday-grid">' + rows + '</ul>'
        all_url = '/it/tools/tutti/' if it else '/tools/all/'
        content += '<section class="mrc-index-bridge"><h2>' + pick('Lavori con WordPress o cerchi qualcosa di più tecnico?', 'Work with WordPress or looking for something more technical?') + '</h2><p>' + pick('Ho raccolto snippet, plugin e strumenti nati da problemi reali.', 'I’ve collected snippets, plugins and tools born from real problems.') + f'</p><p><a href="{all_url}">' + pick('Esplora tutti gli strumenti →', 'Explore all tools →') + '</a></p></section>'
    else:
        dataset = dataset_checked(root)
        def controls(items):
            return ''.join(f'<button type="button" data-tool-filter="{f["value"]}" data-filter-field="{f["field"]}" aria-pressed="{"true" if f["value"] == "all" else "false"}" aria-controls="mrc-tools-list">{html.escape(f["label"][lang])}</button>' for f in items)
        buttons = '<div class="mrc-tool-views" role="group" aria-label="' + pick('Vista', 'View') + '">' + controls(dataset['views']) + '</div>'
        buttons += '<div class="mrc-tool-scopes" role="group" aria-label="' + pick('Ambito', 'Scope') + '">' + controls(dataset['filters']) + '</div>'
        rows = ''.join(f'<li class="mrc-tool-row" data-tool-tags="{" ".join(t["tags"])}" data-tool-type="{t["type"]}" data-tool-availability="{t["availability"]}"><h2>{link(t["url"][lang], t["name"][lang])}</h2><p>{html.escape(t["description"][lang])}</p>{status(t,tags,lang)}</li>' for t in tools)
        content += f'<div class="mrc-tool-filters" role="group" aria-label="{pick("Filtra gli strumenti", "Filter tools")}" hidden>{buttons}</div><p class="mrc-tool-filter-count" role="status" aria-live="polite" data-count-label="{pick("strumenti visibili", "tools shown")}" hidden></p><ul class="mrc-tools-list" id="mrc-tools-list">{rows}</ul>'
    contact = '/it/contatti/' if it else '/contact/'
    content += '<section class="mrc-index-bridge"><h2>' + pick('Hai un problema che questi strumenti non risolvono?', 'Have a problem these tools don’t solve?') + '</h2><p>' + pick('Questi strumenti nascono spesso da un problema concreto che vale la pena semplificare.', 'These tools usually start from a concrete problem worth simplifying.') + f'</p><p><a href="{contact}">' + pick('Raccontami il tuo →', 'Tell me yours →') + '</a></p></section>'
    return content


def plan_shared_ui(root=ROOT):
    dataset = dataset_checked(root); tools, tags = dataset['tools'], dataset['tags']
    files = list(page_files(root)); pairs = language_pairs(files, tools)
    tool_by_url = {t['url'][lang]: t for t in tools for lang in ('en', 'it')}
    # Reuse the existing property exactly once. This is a public beacon identifier, not a secret.
    home = (root / 'index.html').read_text(encoding='utf-8')
    analytics_matches = re.findall(r'<script\b[^>]*src="https://static\.cloudflareinsights\.com/beacon\.min\.js"[^>]*>\s*</script>', home, re.S)
    if len(analytics_matches) != 1: raise ValueError('Beacon Cloudflare home assente/duplicato')
    beacon = analytics_matches[0]
    planned = {}
    for path, original in files:
        text = original; url = route(path, root)
        lang_match = re.search(r'<html\b[^>]*\blang=["\'](en|it)["\']', text, re.I)
        if not lang_match: raise ValueError(f'Lingua non riconosciuta: {path}')
        lang = lang_match[1]; tool = tool_by_url.get(url); index = url in [v for p in INDEX_PAIRS for v in p]
        pair = pairs.get(url)
        text = metadata(text, url, pair, lang, tool, index)
        if tool or index:
            for css in ('/assets/tool-shell.css', '/assets/tools-content.css'):
                if f'href="{css}"' not in text: text = text.replace('</head>', f'<link rel="stylesheet" href="{css}">\n</head>')
            text = replace_block(text, 'TOOL HEADER', tool_header(root, lang, pair, url), r'<header class="tool-header"[^>]*>.*?</header>')
            if index:
                text = re.sub(r'<link\b[^>]*href="/assets/style.min.css"[^>]*>\s*', '', text)
                text = replace_block(text, 'INDEX', index_content(root, tools, tags, lang, url in INDEX_PAIRS[0]))
                if 'href="/assets/tools-index.css"' not in text: text = text.replace('</head>', '<link rel="stylesheet" href="/assets/tools-index.css">\n</head>')
                if url in INDEX_PAIRS[1] and 'src="/assets/tools-index.js"' not in text: text = text.replace('</body>', '<script src="/assets/tools-index.js" defer></script>\n</body>')
            else:
                if 'href="/assets/tool-feedback.css"' not in text: text = text.replace('</head>', '<link rel="stylesheet" href="/assets/tool-feedback.css">\n</head>')
                text = replace_block(text, 'TOOL FEEDBACK', feedback_cta(root, tool, lang))
                text = replace_block(text, 'TOOL STATUS', status(tool, tags, lang))
                # All standalone pages get one generated status immediately below the main opening.
                block = re.search(r'<!-- MRC SHARED TOOL STATUS START -->.*?<!-- MRC SHARED TOOL STATUS END -->', text, re.S)[0]
                text = text.replace(block, '')
                text = re.sub(r'(<main\b[^>]*>)\s*', lambda m: m[1] + '\n' + block + '\n', text, count=1)
                if tool['type'] == 'plugin' and tool['availability'] == 'free':
                    download = f'<section class="section"><h2>{"Scarica" if lang == "it" else "Download"}</h2><p><a href="{tool["download"]}" download>{"Scarica plugin ZIP" if lang == "it" else "Download plugin ZIP"} · {tool["version"]} ↓</a></p></section>'
                    text = replace_block(text, 'PLUGIN DOWNLOAD', download)
                if tool['type'] == 'snippet':
                    install = ('<h2>Come usarlo</h2><ol><li>Installa Code Snippets Free su WordPress.</li><li>Crea un nuovo snippet PHP.</li><li>Copia e incolla il codice.</li><li>Attivalo nell’ambito indicato.</li></ol><p>È un metodo semplice, non obbligatorio: puoi integrare il codice nel tuo plugin o nel punto appropriato. Per gli esempi Gravity Forms configura gli ID e gli eventuali provider prima di attivare.</p>' if lang == 'it' else '<h2>How to use it</h2><ol><li>Install Code Snippets Free in WordPress.</li><li>Create a new PHP snippet.</li><li>Copy and paste the code.</li><li>Activate it in the required scope.</li></ol><p>This is a simple option, not a requirement: experienced users can put the code in their own plugin or the appropriate location. Configure form IDs and any required providers before enabling Gravity Forms examples.</p>')
                    text = replace_block(text, 'SNIPPET INSTALL', '<section class="section">' + install + '</section>')
                    if 'src="/assets/snippet-copy.js"' not in text: text = text.replace('</body>', '<script src="/assets/snippet-copy.js" defer></script>\n</body>')
                if tool['availability'] == 'on-request':
                    text = remove_marked(text, 'TOOL AFTERWORD')
                    text = replace_block(text, 'PLUGIN REQUEST', request_cta(root, tool, lang))
                    text = re.sub(r'<script\b[^>]*src="/assets/plugin-request.js"[^>]*>\s*</script>\s*', '', text)
                    # A normal email link requires no form or JavaScript.
                    text = remove_marked(text, 'REQUEST CTA')
                else:
                    text = replace_block(text, 'TOOL AFTERWORD', template(root, f'tool-afterword.{lang}.html'))
                    if 'src="/assets/support.js"' not in text: text = text.replace('</body>', '<script src="/assets/support.js" defer></script>\n</body>')
                related = related_tools(tool, tools)
                content = '<section class="mrc-related"><h2>' + ('Strumenti correlati' if lang == 'it' else 'Related tools') + '</h2><ul>' + ''.join('<li>' + link(t['url'][lang], t['name'][lang]) + '</li>' for t in related) + '</ul></section>'
                text = replace_block(text, 'RELATED TOOLS', content)
        else:
            text = editorial_header(root, text, lang)
            menu = template(root, f'menu.{lang}.html')
            menu = re.sub(r'(<a\s+href="([^"]+)")', lambda m: m[1] + (' aria-current="page"' if m[2] == url else ''), menu)
            if '<!-- MRC POPUP MENU START -->' in text or '<!-- MRC SHARED MENU START -->' in text:
                text = replace_block(text, 'MENU', menu, r'<!-- MRC POPUP MENU START -->.*?<!-- MRC POPUP MENU END -->')
            else:
                end = '<!-- MRC SHARED SITE HEADER END -->'
                text = text.replace(end, end + '\n' + marked('MENU', menu))
            # One shared menu script, also on the home page.
            text = re.sub(r'<script\b[^>]*src="/assets/menu(?:\.min)?\.js"[^>]*>\s*</script>\s*', '', text)
            text = text.replace('</body>', '<script src="/assets/menu.js" defer></script>\n</body>')
        if 'href="/assets/shared-ui.css"' not in text: text = text.replace('</head>', '<link rel="stylesheet" href="/assets/shared-ui.css">\n</head>')
        text = replace_footer(text, template(root, 'footer.html'))
        if tool:
            # Order generated content independent of each page's legacy envelope.
            tail = []
            for name in ('PLUGIN DOWNLOAD', 'SNIPPET INSTALL', 'PLUGIN REQUEST', 'RELATED TOOLS', 'TOOL FEEDBACK', 'TOOL AFTERWORD', 'FOOTER'):
                match = re.search(re.escape(f'<!-- MRC SHARED {name} START -->') + r'.*?' + re.escape(f'<!-- MRC SHARED {name} END -->'), text, re.S)
                if match:
                    block = match[0]
                    text = text.replace(block, '')
                    if name in ('SNIPPET INSTALL', 'PLUGIN DOWNLOAD'):
                        text = text.replace('</main>', block + '\n</main>')
                    else: tail.append(block)
            text = text.replace('</main>', '</main>\n' + '\n'.join(tail))
        # Preserve the existing property's beacon and never duplicate it.
        existing = re.findall(r'<script\b[^>]*src="https://static\.cloudflareinsights\.com/beacon\.min\.js"[^>]*>\s*</script>', text, re.S)
        if len(existing) > 1: raise ValueError(f'Beacon duplicato: {path}')
        if not existing: text = text.replace('</body>', beacon + '\n</body>')
        if url in ('/', '/it/'):
            def website_name(match):
                data = json.loads(match[1])
                def visit(node):
                    if isinstance(node, dict):
                        if node.get('@type') == 'WebSite': node.update(name='Marco Ruisi', alternateName=['MRC', 'marcoruisi.pages.dev'], url=HOST + '/')
                        for child in node.values(): visit(child)
                    elif isinstance(node, list):
                        for child in node: visit(child)
                visit(data)
                return '<script type="application/ld+json">\n' + json.dumps(data, ensure_ascii=False, indent=2) + '\n</script>'
            text = re.sub(r'<script type="application/ld\+json">(.*?)</script>', website_name, text, flags=re.S)
        # Collapse only whitespace between generated blocks; avoids repeated removal leaving blank lines.
        text = re.sub(r'\n{3,}', '\n\n', text)
        if text != original: planned[path] = text
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
