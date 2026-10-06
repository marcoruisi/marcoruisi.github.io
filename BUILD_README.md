# Build e pubblicazione MRC

La cartella Dropbox `/mrc/web` è la sorgente autorevole. Il sito rimane HTML/CSS/JavaScript statico. Il build usa solo Python 3 e la libreria standard: niente rete, CMS, pacchetti da installare o Git.

```bash
cd "/Users/mrc/Library/CloudStorage/Dropbox/mrc/web"
python3 build.py
python3 build.py
python3 test_build.py
```

Il secondo build deve riportare zero file aggiornati. La build verifica tutte le pagine del sito prima di scrivere: canonical, og:url, lingua, hreflang reciproci, JSON-LD, H1, ID, link/ancore, asset, discovery dalla home, download gratuiti e assenza di ZIP nelle pagine ON REQUEST. Host unico: `https://marcoruisi.pages.dev`.

## Sorgenti condivisi

- `shared/tools.json`: catalogo unico. `tags` definisce etichette e filtri; ogni tool ha `id`, `name`, `description`, coppia `url` EN/IT, `tags`, `type`, `availability`. Gli Everyday hanno anche `action` IT/EN. I plugin FREE hanno `download` e `version`. ON REQUEST non può avere download.
- `/tools/` e `/it/tools/`: Everyday, selezionati dal tag `everyday`, senza filtri.
- `/tools/all/` e `/it/tools/tutti/`: catalogo completo filtrabile single-select; HTML completo visibile senza JavaScript.
- `shared/tool-header.html`: navigazione breve Everyday / All Tools e switch sull'equivalente reale.
- `shared/plugin-request.html`: form unico per i quattro plugin ON REQUEST; ID, nome, URL e lingua sono generati dal catalogo.
- `shared/tool-afterword.en.html` e `.it.html`: supporto volontario e CTA professionale dei contenuti FREE.
- `shared/footer.html`, `shared/menu.en.html`, `.it.html`: footer e menu editoriali.
- `assets/tool-shell.css`, `assets/tools-content.css`, `assets/shared-ui.css`: stili comuni; il codice operativo dei tool resta locale.
- `assets/support.js`: unica definizione del Payment Link Stripe.

I blocchi `MRC SHARED … START/END` sono generati da `update_shared_ui.py`. Non modificarli manualmente. I contenuti specifici degli strumenti e il codice degli snippet restano negli HTML. I metadati dei tool derivano dal dataset. Il build normalizza anche metadata legacy del resto del sito senza riscrivere le pagine editoriali.

## Related tools

Massimo tre link, tool corrente escluso, ordine deterministico. Gravity Forms ed Elementor pesano più di CSV e Compressione, poi Immagini/PDF/HTML; Everyday e WordPress pesano meno. A parità si preferisce lo stesso tipo e infine l'ordine del catalogo. Nessun sort casuale o richiesta runtime.

## Richieste plugin: nessun endpoint online

Il progetto dispone solo di contatto email, nessun backend affidabile di invio e nessuna chiave Turnstile. Il form non simula un invio: valida email/URL e testo, richiede di completare la frase iniziale e prepara una bozza `mailto:`. L'utente deve aprirla, controllarla e inviarla nel proprio programma email. Nessun dato viene spedito dal sito, nessun dato finisce in analytics o URL HTTP.

Per abilitare un vero submit manca un endpoint HTTPS con POST JSON, ad esempio un Cloudflare Worker dedicato. Dovrà accettare email, website, message, plugin_id, plugin_name, source_url e language; validare questi ultimi rispetto a una allowlist server-side; applicare limiti di lunghezza, rate limiting/antispam; usare un servizio email configurato esclusivamente sul server; restituire errori e successo reali. Nessun endpoint, API key, secret o site key è stato inventato. L'unico comportamento corrente è definito in `assets/plugin-request.js`.

## Analytics

La build riutilizza esattamente il beacon Cloudflare già presente nella home, con la stessa property, una sola volta per pagina. Non crea property, non aggiunge piattaforme. Cloudflare Web Analytics attualmente non supporta eventi custom; nessuna API inventata per Copy/Download/Request. Vedi https://developers.cloudflare.com/web-analytics/faq/ .

## Flusso locale e MRC Publish

MRC Publish online rimane il metodo principale: Dropbox → GitHub main → Cloudflare Pages. `/mrc/mrc.command` offre preview locale dopo build e pubblicazione equivalente tramite `publish_local.py`.

Il comando locale esegue fetch, verifica main e l'assenza di conflitti, riallinea HEAD/indice a origin/main con `reset --mixed` se GitHub è avanti. Non fa pull/checkout/hard reset e non sostituisce file Dropbox. Se la cronologia diverge conserva prima un riferimento `mrc-history-before-sync-*`. Le differenze dei file locali rimangono modifiche da pubblicare. Poi esegue build, stage, commit se necessario, push senza force e controlla repository pulito e HEAD=origin/main. Un push rifiutato interrompe il flusso; i file e il commit restano disponibili per ritentare.

`test_build.py` verifica footer legacy/nuovo/marcato/assente, idempotenza e un ciclo reale Git su repository bare di test con avanzamento remoto, divergenza, modifiche non committate e file nuovi. Non accede alla rete né modifica il Git reale dell'utente.

La sitemap include soltanto documenti HTML completi, pubblici e self-canonical. Frammenti shared, 404, file di verifica Google e file di servizio sono esclusi. Nessuna data lastmod artificiale basata sul download/build.
## Verifica release Tools — 6 ottobre 2026

- Catalogo: 16 strumenti; 5 Everyday; 4 snippet; 2 plugin FREE; 4 plugin ON REQUEST (6 utility complessive).
- 32 pagine tool EN/IT e 4 indici: 72 controlli route/viewport a 390 e 1440 px, filtri, tastiera/focus, switch equivalente, Copy, download, richieste precompilate, assenza overflow e assenza errori JS.
- Build completa: 78 URL indicizzabili e 78 pagine raggiungibili; link/asset/canonical/hreflang/JSON-LD validati; zero orphan pubblici. Seconda build: zero aggiornamenti. Tre test di regressione superati.
- Tutti i 93 file modificati/creati sono stati salvati negli originali Dropbox e confrontati mediante content hash.
- Publish online tentato dalla UI esistente, dopo confronto completo: 8 file nuovi, 84 modificati, 0 cancellati. Il Worker ha restituito “Too many subrequests by single Worker invocation”. Non è stato confermato alcun commit/deploy; il sito pubblico continua a mostrare il catalogo precedente.
- Per concludere il deploy occorre correggere nel Worker MRC Publish la gestione del volume di richieste mantenendo la verifica della sorgente e il commit atomico, oppure usare il comando locale aggiornato su un Mac con accesso GitHub. Il sorgente del Worker non è presente in /mrc/web. Non è stato creato un sistema alternativo di deploy.
- Il ciclo locale build → commit → push è stato eseguito realmente contro un repository bare di test. Non è stato possibile eseguirlo sul Mac o sul Git di produzione dell'utente; non viene quindi dichiarato pulito/allineato il repository locale del Mac.
- Il beacon Cloudflare originale è preservato una sola volta per pagina. Il ricevimento di pageview sulle nuove pagine deve essere verificato dopo un deploy riuscito.

File modificati/creati, percorsi relativi a /mrc:

```text
mrc.command
web/sitemap.xml
web/BUILD_README.md
web/generate_sitemap.py
web/build.py
web/test_build.py
web/update_shared_ui.py
web/404.html
web/index.html
web/publish_local.py
web/principles/index.html
web/it/index.html
web/assets/tools-content.css
web/assets/tool-shell.css
web/assets/snippet-copy.js
web/assets/plugin-request.js
web/manifesto/index.html
web/why/index.html
web/contact/index.html
web/about/index.html
web/tools/index.html
web/shared/tools.json
web/shared/plugin-request.html
web/stories/index.html
web/ideas/index.html
web/work/index.html
web/colophon/index.html
web/field-notes/index.html
web/it/manifesto/index.html
web/it/tools/index.html
web/it/perche/index.html
web/it/idee/index.html
web/it/principi/index.html
web/it/colophon/index.html
web/it/chi-sono/index.html
web/it/contatti/index.html
web/it/taccuino/index.html
web/it/storie/index.html
web/it/lavoro/index.html
web/it/tools/directory-card-gravity-forms/index.html
web/it/tools/pdf-compressor/index.html
web/it/tools/immagini-in-pdf/index.html
web/it/tools/blocca-subscriber-wp-admin/index.html
web/it/tools/disabilita-commenti-wordpress/index.html
web/it/tools/mrc-gravity-forms-tools/index.html
web/it/tools/webp-compressor/index.html
web/it/tools/clean-wp-clipboard/index.html
web/it/tools/foto-entro-peso/index.html
web/it/tools/mrc-dynamic-content/index.html
web/it/tools/mrc-uploader/index.html
web/it/tools/tutti/index.html
web/it/tools/mrc-gf-debug/index.html
web/it/tools/autocomplete-gravity-forms/index.html
web/it/tools/bianco-trasparente/index.html
web/it/tools/before-after-shortcode/index.html
web/it/tools/pagina-provenienza-gravity-forms/index.html
web/it/storie/origine/index.html
web/it/storie/contesto/index.html
web/it/storie/adattabilita/index.html
web/it/storie/responsabilita/index.html
web/it/storie/misura/index.html
web/it/storie/ripetizione/index.html
web/it/storie/autonomia/index.html
web/it/storie/osservazione/index.html
web/it/storie/connessioni/index.html
web/it/storie/relazioni/index.html
web/tools/pdf-compressor/index.html
web/tools/mrc-gravity-forms-tools/index.html
web/tools/webp-compressor/index.html
web/tools/gravity-forms-autocomplete/index.html
web/tools/all/index.html
web/tools/clean-wp-clipboard/index.html
web/tools/mrc-dynamic-content/index.html
web/tools/mrc-uploader/index.html
web/tools/white-to-transparent/index.html
web/tools/images-to-pdf/index.html
web/tools/gf-cards-directory/index.html
web/tools/block-subscriber-wp-admin/index.html
web/tools/image-to-target-size/index.html
web/tools/mrc-gf-debug/index.html
web/tools/gravity-forms-source-page/index.html
web/tools/disable-wordpress-comments/index.html
web/tools/before-after-shortcode/index.html
web/stories/ownership/index.html
web/stories/source/index.html
web/stories/connections/index.html
web/stories/relationships/index.html
web/stories/context/index.html
web/stories/adaptability/index.html
web/stories/repetition/index.html
web/stories/autonomy/index.html
web/stories/observation/index.html
web/stories/measure/index.html
```
