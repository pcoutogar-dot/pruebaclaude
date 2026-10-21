# Generar la versión Word de una muestra HTML

1. `measure.js`: se inyecta en el HTML y devuelve (tras cargar las fuentes) la posición de cada texto → `m.json`.
2. `hide.css`: se inyecta en el HTML para capturar con Chromium solo los gráficos (fondos `bg1.png`… a 3x).
3. `spec.py`: define los párrafos posicionados de cada página a partir de `m.json` (+ `corr.json`).
4. `build.js`: crea el .docx con la librería `docx` (texto nativo + fondos detrás + tabla nativa de `table.json`).
5. `calib.py --apply`: compara líneas base Word (LibreOffice) vs PDF y escribe `corr.json`; repetir 2 veces.
6. `embed.py out.docx final.docx`: incrusta Poppins y Lora para que se vea igual sin tenerlas instaladas.
