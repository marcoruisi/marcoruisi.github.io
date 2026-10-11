MRC | Crea una sfida - bordo Sudoku, collegamenti e condivisione

Patch incrementale su /mrc/web. Non applica commit, push o deploy.
- Bordo esterno del generatore Sudoku ripristinato (ultima colonna).
- Crea una sfida: link diretto al gioco selezionato; selezione tramite ?game=.
- Giochi Sudoku, Codice segreto, Sequenze e Trova le parole: collegamento
  a Crea una sfida con gioco pre-selezionato e invito a condividere la sfida.
- Il pulsante condivide il puzzle corrente; se troppo lungo, usa il JSON.
- Nel Trova le parole si condivide l'elenco di parole, non la disposizione
  casuale delle lettere: il destinatario genera una propria griglia.
- Verificare con browser su localhost, sia mobile sia desktop.
