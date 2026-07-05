from pathlib import Path
import re

BASE = Path("/Users/mrc/Desktop/mrc/web")

STYLE_TAG = '<link rel="stylesheet" href="/assets/style.css">'
FAVICON_TAG = '<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">'

def clean_file(path: Path):
    text = path.read_text(encoding="utf-8")

    # Uniforma style.css
    text = re.sub(
        r'<link\s+rel=["\']stylesheet["\']\s+href=["\'](?:\.\./)*assets/style\.css["\']\s*/?>',
        STYLE_TAG,
        text,
        flags=re.IGNORECASE
    )

    # Rimuove print.css
    text = re.sub(
        r'\s*<link[^>]+print\.css[^>]*>\s*',
        '\n',
        text,
        flags=re.IGNORECASE
    )

    # Rimuove main.js
    text = re.sub(
        r'\s*<script[^>]+main\.js[^>]*></script>\s*',
        '\n',
        text,
        flags=re.IGNORECASE
    )

    # Rimuove eventuali favicon vecchie
    text = re.sub(
        r'\s*<link[^>]+rel=["\']icon["\'][^>]*>\s*',
        '\n',
        text,
        flags=re.IGNORECASE
    )

    # Aggiunge favicon dopo style.css
    if FAVICON_TAG not in text:
        text = text.replace(STYLE_TAG, STYLE_TAG + "\n    " + FAVICON_TAG)

    # Corregge src/href rimasti relativi per asset principali
    replacements = {
        'href="../assets/style.css"': 'href="/assets/style.css"',
        'href="../../assets/style.css"': 'href="/assets/style.css"',
        'src="../img/logo.svg"': 'src="/img/logo.svg"',
        'src="../../img/logo.svg"': 'src="/img/logo.svg"',
        'src="../img/stromboli.webp"': 'src="/img/stromboli.webp"',
        'src="../../img/stromboli.webp"': 'src="/img/stromboli.webp"',
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    path.write_text(text, encoding="utf-8")
    print("Updated:", path.relative_to(BASE))

for html in BASE.rglob("*.html"):
    clean_file(html)

print("\nDone.")