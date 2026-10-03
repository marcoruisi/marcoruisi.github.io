# Build locale MRC

Il sito rimane un insieme di HTML statici completi. Il build usa soltanto Python 3 e la sua libreria standard: non installa pacchetti, non usa la rete e non esegue Git o pubblicazioni.

```bash
cd "/Users/mrc/Library/CloudStorage/Dropbox/mrc/web"
python3 build.py
python3 -m http.server 8000
```

Aprire `http://localhost:8000/`. Dopo la revisione, la pubblicazione resta manuale tramite MRC Publish: Dropbox → GitHub main → Cloudflare Pages. Nessuno script qui apre o invoca il Worker.

## Sorgenti condivisi

- `shared/footer.html`: footer globale, incluso il link amministrativo Publish. Modificare questo file, non i footer generati nelle pagine.
- `shared/menu.en.html` e `shared/menu.it.html`: menu popup editoriale, già HTML; il build assegna `aria-current` secondo la pagina.
- `shared/tool-header.html`: navigazione Tools e switch verso la pagina equivalente.
- `shared/tool-afterword.en.html` e `.it.html`: supporto volontario e CTA professionale, separati.
- `shared/tools.json`: dataset unico con `tools` (nomi, brevi descrizioni, URL IT/EN e ID dei tag) e `tags` (etichette IT/EN e visibilità nella barra dei filtri). Genera la lista compatta nei due indici e i link nell'header Tools. I tag sono multidimensionali: uno strumento può averne più di uno. Nessuna numerazione pubblica.
- `assets/tools-index.css` e `.js`: lista editoriale compatta e filtro singolo accessibile. Senza JavaScript tutti gli strumenti restano visibili, mentre i controlli inattivi sono nascosti. Nessun filtro modifica URL o canonical.
- `assets/shared-ui.css` e `assets/tool-shell.css`: stili degli elementi comuni. Il CSS operativo dei singoli strumenti resta locale.

La configurazione Stripe rimane esclusivamente in `assets/support.js`, invariata. Nessun URL Stripe nei frammenti.

## Esecuzione

`build.py` pianifica prima i blocchi condivisi, verifica canonical, hreflang, link HTML e raggiungibilità dalla home, prepara la sitemap e poi scrive solo i file realmente cambiati. Marcatori `MRC SHARED … START/END` delimitano le parti generate. I footer non vengono caricati via JavaScript.

`update_shared_ui.py` può essere eseguito da solo; `generate_sitemap.py` può rigenerare soltanto la sitemap. Normalmente usare `build.py` per includere anche i controlli. Due build consecutivi devono riportare zero cambiamenti nel secondo.

La sitemap comprende i documenti HTML completi con canonical sul proprio URL e senza noindex. Esclude frammenti sorgente, 404 e file di verifica Google. Non usa date di download/build come `lastmod`: erano prive di una storia affidabile delle modifiche editoriali. Non genera priority o changefreq artificiali.

## Nuove pagine

Copiare una pagina dello stesso tipo, modificare contenuto e metadata, mantenere i marcatori condivisi e usare canonical/hreflang corretti. Per una nuova Tool creare entrambe le pagine monolingua e aggiungere un record in `shared/tools.json` → `tools`, con i tag presenti in `tags`. Per introdurre un tag definirne una sola volta le etichette IT/EN e se mostrarlo come filtro. Il build fallisce se un tag, target o pagina importante non è valido; non ignora silenziosamente errori.

Lo switch editoriale resta specifico della pagina, perché gli slug tradotti non sono una sostituzione automatica di prefisso. Gli algoritmi dei tre strumenti originali sono conservati; le loro nuove pagine IT contengono stringhe runtime tradotte. Quando si modifica un algoritmo inline, propagare l'intervento IT/EN e testare entrambe le versioni. Images to PDF condivide già lo stesso JS operativo per entrambe le lingue.
