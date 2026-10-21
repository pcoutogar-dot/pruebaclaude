# Generar la versión Word de una muestra HTML

1. `measure.js`: se inyecta en el HTML y devuelve (tras cargar las fuentes) la posición de cada texto → `m.json`.
2. `hide.css`: se inyecta en el HTML para capturar con Chromium solo los gráficos (fondos `bg1.png`… a 3x).
3. `spec.py`: define los párrafos posicionados de cada página a partir de `m.json` (+ `corr.json`).
4. `build.js`: crea el .docx con la librería `docx` (texto nativo + fondos detrás + tabla nativa de `table.json`).
5. `calib.py --apply`: compara líneas base Word (LibreOffice) vs PDF y escribe `corr.json`; repetir 2 veces.
6. `embed.py out.docx final.docx`: incrusta Poppins y Lora para que se vea igual sin tenerlas instaladas.

## Versión para Google Docs (`build_gdocs.js`)

Google Docs no admite imágenes detrás del texto ni interlineados exactos fiables, así que esta versión
va todo en flujo: portada como imagen a página completa (sección con márgenes 0), titular y barra de
título como tablas con fondo, línea de tiempo como tabla (bolitas = imágenes en línea; la línea es el
borde entre dos columnas) y capítulos como texto resaltado. Deja holgura al final de cada página porque
Docs maqueta algo distinto que Word/LibreOffice.

### v2 (`build_gdocs2.js`)
- Portada editable: bandas de personas en la cabecera/pie de la primera página (sección con márgenes 0) y texto real en el centro.
- Formas redondeadas (titular, píldoras, chips, «ESTRUCTURA», barra de título) como formas DrawingML en línea:
  Google Docs las convierte en dibujos con texto editable (doble clic). `gd_sizes.json` = anchos medidos con Poppins.

### v7 (`build_gdocs3.js`) — reglas aprendidas de Google Docs
- Docs ignora interlineado «exacto» (lo trata como múltiplo) y los tabuladores: usar interlineado sencillo y espacios.
- Docs coloca mal imágenes flotantes dentro de tablas: la línea de tiempo va sin tabla (bolitas y línea = fondos por párrafo).
- Fondos «detrás del texto» anclados al propio párrafo, posición horizontal respecto a la PÁGINA, sin espacio «antes».
