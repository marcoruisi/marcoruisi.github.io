"""Formats and data handled by the existing MRC tools; used by build and search."""
FORMATS = {
 'webp-compressor': ('JPG, PNG, WEBP → WEBP', 'JPG, PNG, WEBP → WEBP'),
 'pdf-compressor': ('PDF', 'PDF'),
 'clean-wp-clipboard': ('Testo, HTML', 'Text, HTML'),
 'images-to-pdf': ('JPG, PNG, WEBP → PDF', 'JPG, PNG, WEBP → PDF'),
 'image-to-target-size': ('JPG, PNG, WEBP', 'JPG, PNG, WEBP'),
 'print-pdf-to-web': ('PDF', 'PDF'),
 'white-to-transparent': ('JPG, PNG, WEBP → PNG', 'JPG, PNG, WEBP → PNG'),
 'multiple-find-replace': ('Testo, HTML, CSV', 'Text, HTML, CSV'),
 'file-renamer': ('File di ogni formato; regole CSV / TSV', 'Any file format; CSV / TSV rules'),
 'list-filter': ('TXT, CSV, TSV', 'TXT, CSV, TSV'),
 'digital-crossword': ('Immagini, JSON', 'Images, JSON'),
 'puzzle-maker': ('Testo e parole', 'Text and words'),
 'gis-address-geocoding': ('Indirizzi, CSV', 'Addresses, CSV'),
 'gis-coordinate-converter': ('Coordinate', 'Coordinates'),
 'gis-map-coordinates': ('CSV, TXT, coordinate', 'CSV, TXT, coordinates'),
 'gis-point-extractor': ('CSV, TXT, JSON, GeoJSON, ZIP, GeoTIFF', 'CSV, TXT, JSON, GeoJSON, ZIP, GeoTIFF'),
 'gis-coordinate-formats': ('Coordinate DD / DMM / DMS', 'DD / DMM / DMS coordinates'),
 'file-inventory': ('Cartelle, file di ogni formato → CSV, TXT', 'Folders, any file format → CSV, TXT'),
 'csv-editor': ('CSV, TSV, TXT → CSV, ZIP', 'CSV, TSV, TXT → CSV, ZIP'),
 'watermark': ('JPG, PNG, WEBP, PDF', 'JPG, PNG, WEBP, PDF'),
}
def formats_for(tool, lang):
 if tool['id'] in FORMATS:return FORMATS[tool['id']][0 if lang=='it' else 1]
 if tool.get('type') in ('plugin','snippet'):return 'WordPress / PHP'
 return ''
