MRC - Fix contrasto Tools/Giochi e tastiera Cruciverba (2026-10-11)

Sostituire i file mantenendo la struttura relativa a /mrc/web.
- assets/tool-shell.css: tema chiaro stabile anche in Chrome anonimo con preferenza scura.
- assets/games/games.css e games-shell.css: contrasto coerente per Giochi.
- assets/games/crossword-mobile.css: pulsante tastiera visibile in modalita mobile.
- it/tools/cruciverba/index.html e tools/crossword/index.html: il Tool non apre piu la tastiera al tap; pulsante Scrivi / Type.
- it/giochi/cruciverba/index.html e games/crossword/index.html: rilevamento responsive per iOS/Chrome piu robusto.

Controlli: sintassi JS HTML, integrita ZIP. Test reale su Chrome iOS ancora necessario.
Nessun deploy.
