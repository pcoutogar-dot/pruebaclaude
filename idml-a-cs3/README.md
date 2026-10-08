# De InDesign CS6 a CS3

InDesign CS3 no abre los archivos de CS6, y CS6 no puede "guardar como" una versión anterior.
Esta herramienta resuelve el problema por otro camino: **lee el documento exportado como IDML y genera un
script que lo reconstruye dentro de CS3**, junto con un informe y todos los textos.

> **Estado.** Probada con documentos IDML de ejemplo y con un InDesign simulado (ver [Cómo se ha probado](#cómo-se-ha-probado)).
> **No se ha podido probar con un InDesign CS3 real**, que es lo único que lo confirmaría. Si algo no sale bien,
> los textos exportados permiten rehacer el documento sin teclear.

## Uso rápido (sin instalar nada)

1. En **CS6**: abre el documento, `Archivo › Exportar…`, tipo **InDesign Markup (IDML)**.
2. Abre `dist/idml-a-cs3.html` en un navegador (doble clic; funciona sin internet y **el archivo no sale de tu ordenador**).
3. Suelta el `.idml` y pulsa **Descargar carpeta para CS3 (.zip)**.
4. En el ordenador con **CS3**:
   1. Copia el zip, descomprímelo y mete dentro las imágenes enlazadas (la carpeta `Links` del documento).
   2. Instala las fuentes que indica `informe.html`.
   3. `Ventana › Automatización › Scripts` → clic derecho en «Usuario» → «Mostrar en el Explorador/Finder» → copia ahí `1_reconstruir_en_CS3.jsx`.
   4. Doble clic sobre el script en el panel. Se crea un **documento nuevo**. Si no encuentra las imágenes, pide la carpeta.
   5. Compara con el informe y guarda como `.indd`.

### Qué contiene el zip

| Archivo | Para qué sirve |
|---|---|
| `1_reconstruir_en_CS3.jsx` | El script que recrea el documento en CS3. **Es el método recomendado.** |
| `2_EXPERIMENTAL_documento.inx` | Intento de conversión directa al formato de intercambio de CS3. Sin probar en CS3: puede no abrirse. |
| `informe.html` | Fuentes que hay que instalar, imágenes enlazadas, colores, avisos y un mapa de cada página. |
| `textos/` y `textos_con_formato/` | Todos los textos en `.txt` y en `.rtf` (con fuente, tamaño y color), por si hay que rehacer algo a mano. |
| `imagenes_incrustadas/` | Imágenes que estaban incrustadas en el documento (IDML las lleva dentro). |
| `LEEME.txt` | Estos pasos, en texto plano. |

## Línea de comandos

Necesita Node 18 o superior; no tiene dependencias.

```bash
node src/cli.js documento.idml                    # crea documento_para_CS3.zip
node src/cli.js documento.idml --dir salida/      # o una carpeta en vez de un zip
node src/cli.js documento.idml --sin-inx --sin-rtf
```

## Qué se conserva y qué no

**Se recrea:** tamaño de página, caras enfrentadas, sangrado y anotaciones (slug), márgenes y columnas por página,
páginas maestras (y los objetos de la maestra sustituidos en una página), capas, colores (CMYK, RGB, Lab, planos),
tonos y degradados, estilos de párrafo y de carácter (con tabuladores, filetes, viñetas y capitulares), textos con
todo su formato local, marcos de texto con sus columnas, márgenes internos y ajuste de texto, marcos enlazados,
números de página automáticos, rectángulos, óvalos, polígonos, líneas, grupos, rotaciones, esquinas, opacidad,
imágenes (posición y recorte) y tablas sencillas (contenido, anchos, altos y celdas combinadas).

**No se recrea, y se avisa en el informe:** sombras y efectos de CS5/CS6, notas al pie (quedan como un número
en superíndice; el texto va en los archivos de textos), hipervínculos, objetos interactivos y multimedia, texto
condicional, estilos anidados y GREP, numeración automática, objetos anclados dentro del texto, contornos
discontinuos, páginas de distinto tamaño, secciones con numeración especial, guías.

## Cómo funciona

```
documento.idml ──► lector de IDML ──► modelo normalizado ──┬─► script .jsx para CS3 (ES3, datos incrustados)
 (zip + XML,           src/idml.js     (páginas, objetos      ├─► INX experimental (versión rebajada a 5.0)
  sin dependencias)    src/xml.js       con geometría         └─► textos, informe HTML con mapas, LEEME
                       src/zip.js       ya resuelta,
                                        textos con rangos)
```

* **Geometría.** Cada objeto de IDML lleva una matriz `ItemTransform` y un trazado. Se componen (incluidos los grupos)
  y se pasan a las coordenadas «de pliego» con el origen arriba a la izquierda, que es lo que usa el scripting de
  InDesign con `RulerOrigin.SPREAD_ORIGIN`. Giros y reflejos se separan del tamaño; lo inclinado pasa a trazado libre.
* **Script.** El script (`src/runtime.jsx`) está escrito en ES3 (lo que entiende InDesign), con todos los datos
  incrustados y el texto en ASCII (`\uXXXX`) para evitar problemas de codificación. Cada paso va protegido: si CS3
  rechaza una propiedad, el script la anota y sigue. Al terminar muestra un resumen y guarda
  `resultado_reconstruccion.txt` en el escritorio.
* **Diferencias entre versiones.** El script resuelve las constantes de enumeración en mayúsculas (CS3) y en camelCase,
  y contempla lo que en CS3 es distinto: esquinas con una sola opción, `textWrapType`, tonos con el color como primer
  argumento, número de la primera página por sección, `pageBinding` de solo lectura…
* **INX.** El formato INX de CS3 no está documentado públicamente; se une el paquete IDML en un único `<Document>`,
  se rebaja `DOMVersion` a 5.0 y se retiran los elementos posteriores a CS3. Es un intento, no una garantía.

## Cómo se ha probado

```bash
npm test          # pruebas unitarias y de integración (Node, sin dependencias)
npm run test:ui   # reconstruye dist/ y prueba la página en Chromium con Playwright (opcional)
```

* **Documento de ejemplo** (`test/fixture.js`): un IDML sintético con la estructura de CS6 (págs. enfrentadas, maestra,
  capas, colores, estilos, textos enlazados, tabla, imágenes enlazadas e incrustadas, texto girado, grupos…).
* **InDesign simulado** (`test/mock-indesign.js`): ejecuta el script generado contra un modelo de objetos estricto
  (una propiedad inexistente lanza error, como en ExtendScript), en modo CS6 y en un modo CS3 con las diferencias que
  se han podido comprobar en la referencia del modelo de objetos de CS3.
* **Robustez**: cientos de IDML estropeados al azar (atributos o elementos que faltan, partes truncadas) no deben
  provocar ninguna excepción ni dejar el script sin terminar.
* **Navegador**: carga de un `.indd` (mensaje claro), conversión, descarga del zip y ausencia de desbordes en móvil y
  escritorio, en claro y en oscuro.

**Lo que no está comprobado:** que el script se ejecute sin sorpresas en un InDesign CS3 de verdad. El simulador refleja
lo que sé de su modelo de objetos, no es InDesign. Las partes con más riesgo son la creación de tablas, el giro de
objetos y las propiedades de estilo menos comunes; todas están protegidas para que un fallo no detenga el resto.

## Estructura

```
src/idml.js       lector de IDML y modelo          src/jsxgen.js   genera el script (.jsx)
src/runtime.jsx   script que corre dentro de CS3   src/inx.js      INX experimental
src/props.js      atributos IDML → propiedades CS3 src/report.js   textos, RTF, informe HTML, LEEME
src/geometry.js   matrices                         src/convert.js  une todo; src/cli.js línea de comandos
src/xml.js, zip.js  XML y ZIP sin dependencias     src/ui.html     interfaz; build.js la empaqueta en dist/
test/             pruebas, documento de ejemplo e InDesign simulado
```
