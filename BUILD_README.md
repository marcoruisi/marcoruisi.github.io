# Build e pubblicazione MRC

## Stato corrente — 7 ottobre 2026

Header editoriale unico anche in home: MRC, Tools, lingua e menu. Template `shared/site-header.html` e `shared/header-utilities.html`; interazione in `assets/menu.js`; stili condivisi in `assets/shared-ui.css`. Il menu mantiene le voci esistenti. Su mobile il controllo menu mostra un'icona con nome accessibile e area di almeno 44 px.

I due percorsi della home mantengono testi e URL: tutta la superficie è cliccabile, separatore verticale desktop e orizzontale mobile, hover/focus sull'intera scelta e rispetto di reduced-motion.

All Tools: `views` (All/Everyday) separato visivamente da `filters` (WordPress, Images, PDF, HTML, Compression) in `shared/tools.json`. La selezione resta esclusiva tra tutti i controlli: scegliere un ambito sostituisce la vista Everyday, non la combina. I tag rimangono nei dati e nei Related Tools. Ogni voce mostra soltanto `TOOL / PLUGIN / SNIPPET · FREE / ON REQUEST`, senza una seconda fila di pill.

Verifiche di questa revisione: 129 controlli pagina/viewport per l'header editoriale (43 pagine a 320, 390 e 1440 px), 180 controlli Tools (36 route a 320, 390, 700, 701 e 1440 px), 46 controlli filtri/mailto/fallback senza JS. Controllate tastiera, focus, Escape del menu, click sull'intera area dei percorsi, link lingua equivalenti, Copy degli snippet e download. Corretta la larghezza minima dei select nel tool White to Transparent a 320 px tramite il CSS condiviso dalle due lingue, senza modifiche al codice operativo.

Build completa: 78 URL indicizzabili e raggiungibili dalla home; zero orphan; canonical/hreflang/sitemap/link/asset validati. Seconda build: zero aggiornamenti. Test Python: sette superati, uno Git intenzionalmente non eseguito. Nessun commit, push o publish in questa revisione.

### Regola di consegna

Il lavoro automatico termina con build, verifiche locali e salvataggio degli originali in Dropbox. Non avviare commit, push, deploy, MRC Publish o script di pubblicazione senza richiesta esplicita nello stesso incarico. La pubblicazione è manuale tramite `mrc.command`. Il test Git isolato è opt-in (`MRC_RUN_ISOLATED_GIT_TESTS=1`) e non viene eseguito nei controlli normali; i validator del sito restano attivi e invariati.

La cartella Dropbox `/mrc/web` è la sorgente autorevole. Il sito rimane HTML/CSS/JavaScript statico. Il build usa solo Python 3 e la libreria standard: niente rete, CMS, pacchetti da installare o Git.

```bash
cd "/Users/mrc/Library/CloudStorage/Dropbox/mrc/web"
python3 build.py
python3 build.py
python3 test_build.py
```

Il secondo build deve riportare zero file aggiornati. La build verifica tutte le pagine del sito prima di scrivere: canonical, og:url, lingua, hreflang reciproci, JSON-LD, H1, ID, link/ancore, asset, discovery dalla home, download gratuiti e assenza di ZIP nelle pagine ON REQUEST. Host unico: `https://marcoruisi.pages.dev`.

## Sorgenti condivisi

- `shared/site-header.html` e `shared/header-utilities.html`: header editoriale unico. Il generatore conserva gli equivalenti lingua, rende disponibile il menu anche in home e sceglie `/tools/` o `/it/tools/`. Link funzionali statici, menu in `assets/menu.js`.

- `shared/tools.json`: catalogo unico. `tags` definisce etichette e filtri; ogni tool ha `id`, `name`, `description`, coppia `url` EN/IT, `tags`, `type`, `availability`. Gli Everyday hanno anche `action` IT/EN. I plugin FREE hanno `download` e `version`. ON REQUEST non può avere download.
- `/tools/` e `/it/tools/`: Everyday, selezionati dal tag `everyday`, senza filtri.
- `/tools/all/` e `/it/tools/tutti/`: catalogo completo filtrabile single-select; HTML completo visibile senza JavaScript.
- `shared/tool-header.html`: navigazione breve Everyday / All Tools e switch sull'equivalente reale.
- `shared/plugin-request.html`: CTA email condivisa per i quattro plugin ON REQUEST; oggetto, messaggio e URL di provenienza sono generati dal catalogo, con encoding percentuale.
- `shared/tool-afterword.en.html` e `.it.html`: supporto volontario e CTA professionale dei contenuti FREE.
- `shared/footer.html`, `shared/menu.en.html`, `.it.html`: footer e menu editoriali.
- `assets/tool-shell.css`, `assets/tools-content.css`, `assets/shared-ui.css`: stili comuni; il codice operativo dei tool resta locale.
- `assets/support.js`: unica definizione del Payment Link Stripe.

I blocchi `MRC SHARED … START/END` sono generati da `update_shared_ui.py`. Non modificarli manualmente. I contenuti specifici degli strumenti e il codice degli snippet restano negli HTML. I metadati dei tool derivano dal dataset. Il build normalizza anche metadata legacy del resto del sito senza riscrivere le pagine editoriali.

## Related tools

### Correzioni finali Tools

Richieste ON REQUEST semplificate a un solo link email statico e modificabile nel client. Filtri aggiunti: Plugin (6), Snippet (4), Free (12), On request / Su richiesta (4). Verificati 62 controlli browser a 390/1440 px in EN/IT, tutti i filtri tramite tastiera, gli otto link mailto e il fallback senza JavaScript. Build: 78 URL pubblici raggiungibili, zero orphan; seconda esecuzione zero aggiornamenti; sei test di regressione superati. Nessuna pubblicazione avviata per questa correzione.

Massimo tre link, tool corrente escluso, ordine deterministico. Gravity Forms ed Elementor pesano più di CSV e Compressione, poi Immagini/PDF/HTML; Everyday e WordPress pesano meno. A parità si preferisce lo stesso tipo e infine l'ordine del catalogo. Nessun sort casuale o richiesta runtime.

## Richieste plugin: email diretta

La CTA apre direttamente un normale `mailto:marcoruisi@gmail.com`, indirizzo già usato nei Contatti. Oggetto e testo breve identificano il plugin e la lingua; il corpo include l'URL pubblico della pagina di provenienza. L'utente completa e invia il messaggio nel proprio programma email. Il sito non invia nulla e non richiede backend.

Il precedente form e tutti i passaggi di preparazione della bozza sono rimossi. `assets/plugin-request.js` resta soltanto un file di compatibilità inerte e non è caricato dalle pagine. La nota sul preventivo resta accanto alla CTA.

Viste e ambiti del catalogo sono definiti dagli array `views` e `filters` di `shared/tools.json`: ordine ed etichette IT/EN. Tipo e disponibilità sono metadati, non filtri pubblici. Gli HTML generati riportano gli attributi corrispondenti ai dati, mai dedotti dal testo visibile. Il comportamento resta single-select; senza JavaScript i 16 elementi sono tutti visibili.

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

### Correzione ritorno al sito principale

L'header shared mostra ora `← MRC`: `/` in EN, `/it/` in IT, nella stessa scheda. Everyday / All Tools / switch lingua restano invariati. Modificati `shared/tool-header.html`, `update_shared_ui.py`, `test_build.py` e rigenerati i 36 indici/pagine Tools. Verificati i quattro indici e un tool per lingua a 390 e 1440 px: 12 test di click/tastiera, nessuna apertura di nuove schede e nessun overflow. Build completa OK; seconda build zero aggiornamenti; quattro test di regressione superati. La release cumulativa comprende ora 94 file modificati/creati in /mrc (il file aggiuntivo è `web/shared/tool-header.html`).
