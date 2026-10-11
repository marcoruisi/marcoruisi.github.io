MRC GIS - release pilota, 11 ottobre 2026
==========================================

Tre nuovi Tools, in italiano e inglese:
1. /tools/coordinate-converter/ e /it/tools/convertitore-coordinate/
2. /tools/map-coordinates/ e /it/tools/punti-su-mappa/
3. /tools/point-extractor/ e /it/tools/estrazione-dati-punti/

Installazione: copiare le voci dello ZIP nella directory /mrc/web esistente,
mantenendo i percorsi. Non cancellare altri file. Non e' stato eseguito deploy.

CRS supportati in prima fase: 4326, 3857, 32632, 32633, 25832, 25833.
Ordine coordinate: X (lon/easting) e Y (lat/northing). Le conversioni
ETRS89/WGS84 senza griglie di datum sono approssimate.

Tool 2: click su OpenStreetMap, coordinate nel CRS scelto, copia, CSV e
link Google Maps al punto. Tile esterni OSM; Internet necessario.

Tool 3: fino a 500 punti; CSV/TXT con colonne x,y o longitude,latitude;
GeoJSON di punti con coordinate WGS84; vettori GeoJSON in WGS84 o
shapefile ZIP con .prj; campionamento GeoTIFF locale alla cella piu' vicina;
WMS GetFeatureInfo 1.1.1 EPSG:4326, formato text/plain, disponibile solo
se il server offre layer interrogabili, formato supportato e CORS.
Vettori: attributi della prima geometria poligonale contenente il punto
(o punto coincidente) e numero totale di corrispondenze; non associa
attributi di linee per prossimita'. GeoTIFF: la CRS deve essere selezionata
manualmente e non sono supportate tutte le georeferenziazioni speciali.
Output CSV, GeoJSON e shapefile ZIP WGS84. Shapefile DBF limita i nomi dei
campi a 10 caratteri e non e' adatto a testi WMS lunghi. CSV consigliato.

Librerie CDN usate: Proj4js, Leaflet, shpjs, geotiff.js, shp-write.
Nessun backend MRC. Caricamenti locali restano nel browser; chiamate WMS
verso servizi esterni possono trasmettere le coordinate ai rispettivi gestori.

TEST ESEGUITI:
- Node --check di tutti i JavaScript GIS: OK.
- Build locale MRC: 108 URL indicizzabili e raggiungibili: OK.
- Seconda build completata: OK (aggiornamenti condivisi residui).
- I test storici test_tool_flows/test_tool_header_flows falliscono anche su
  assunzioni non aggiornate (es. menu Games), non per i motori GIS. Serve
  aggiornamento separato dei test di regressione esistenti.

DA COLLAUDARE PRIMA DEL DEPLOY:
- Test interattivi su browser reale, mobile e desktop.
- Servizio WMS reale con GetFeatureInfo e CORS.
- Campioni GeoTIFF con CRS e celle noti; shapefile ZIP con .prj reale.
- Esportazione shapefile ZIP con attributi complessi/multilingua.
- Caricamento delle librerie CDN su rete aziendale.
