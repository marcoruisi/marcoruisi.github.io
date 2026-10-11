MRC GIS - Estrazione dati per punti - sorgenti multiple

Applicare i file allo stesso percorso relativo a /mrc/web.

- Vettore: aggiunta di piu file GeoJSON o ZIP shapefile, simultanei o successivi.
- Raster: aggiunta di piu GeoTIFF con CRS scelto prima del caricamento, mantenuto per ogni sorgente.
- WMS: aggiunta di piu layer/servizi, visualizzati sulla mappa e interrogati singolarmente se abilitati.
- Lista sorgenti indipendente con pulsante Rimuovi; i dati estratti saranno ricalcolati alla prossima estrazione.
- Colonne di risultato prefissate con un ID stabile della sorgente (es. v1_, r2_, w3_) per evitare omonimie.
- CSV/GeoJSON mantengono nomi colonna completi. Lo Shapefile usa nomi DBF unici ridotti a 10 caratteri, con possibili troncamenti dei valori lunghi.

Limiti precedenti tuttora validi: i vettori GeoJSON sono considerati WGS84; shapefile richiede .prj; raster supporta georeferenziazione affine standard; WMS richiede CORS e GetFeatureInfo interrogabile. I layer WMS non forniscono necessariamente dati raster numerici. I raster grandi possono richiedere molta memoria nel browser.

Verificato: sintassi JavaScript, presenza dei controlli IT/EN e integrita ZIP. Da testare nel browser con sorgenti reali, in particolare su mobile e con grandi dataset.
Nessun commit, push o deploy.
