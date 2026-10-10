MRC — ESPANSIONE GIOCHI E CREAZIONE SFIDE | 10 ottobre 2026

INSTALLAZIONE
Sovrapporre le cartelle dello ZIP alla copia piu recente di /mrc/web.
Il pacchetto e un aggiornamento differenziale successivo a:
MRC_2048_timer_continuo_fine_partita_2026-10-10.zip
Non comprende ne sostituisce gli altri file del sito.
Nessun commit, push o deploy effettuato.

NUOVI GIOCHI
/games/codebreaker/  /it/giochi/codice-segreto/
/games/sequences/    /it/giochi/sequenze/
/games/wordsearch/   /it/giochi/trova-parole/

TOOL DI CREAZIONE
/tools/puzzle-maker/  /it/tools/crea-sfida/
Tipi: Sudoku con generatore e controllo di soluzione unica;
Codice segreto (4 cifre 1-6); sequenza numerica aritmetica;
Trova le parole (3-16 parole in lettere A-Z).

CONDIVISIONE
Dopo Verifica sfida, scegliere Scarica JSON o Condividi.
Link di sfida tramite dati incorporati nel parametro URL (nessun server MRC).
Tasti diretti WhatsApp, Telegram e X e Web Share se presente.
Per file grandi inviare il JSON manualmente.
IMPORTANTE: poiche la sfida e pubblicata interamente nell'URL o nel JSON,
chi la riceve puo esaminarne i dati e anche scoprirne la risposta.
Non sono previste classifiche ne certificazione del risultato.

VERIFICHE
- Sintassi JavaScript con node --check
- Sudoku generati con una sola soluzione (5 test automatici)
- Build locale MRC: 102 URL indicizzabili e raggiungibili dalla Home
- Test interattivo in Chromium locale NON completato (ambiente blocca
  l'apertura di URL localhost e file). Eseguire verifica nel proprio browser.
- Per test social, usare l'URL HTTPS pubblicato; link creati da localhost
  non sono accessibili ai destinatari esterni.

DA VERIFICARE NEL BROWSER
- Doppia lingua e navigazione verso i giochi
- Inserimento/cancellazione numeri in sudoku maker
- Creazione, esportazione e importazione JSON per ogni gioco
- Apertura via URL condiviso IT e EN
- Layout mobile 320 px, dark mode, accessibilita tastiera
- Timer condiviso nei giochi e assente nella pagina Tool maker
- Compilazione della sfida senza perdere il progetto utente esistente
