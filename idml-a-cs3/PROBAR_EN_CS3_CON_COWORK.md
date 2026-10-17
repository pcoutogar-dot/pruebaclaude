# Probar la herramienta en un CS3 de verdad (para pegar en Cowork)

La herramienta se ha probado con un InDesign simulado, pero **nunca en un CS3 real**. Esto es lo que hay que pedirle a
un asistente que tenga acceso al ordenador con CS3 (por ejemplo, Cowork o Claude Code en el ordenador principal, con
acceso remoto al viejo). Sirve igual si lo hace una persona: son los mismos pasos.

Pega el bloque de abajo tal cual:

```text
Necesito que pruebes una herramienta mía en el ordenador viejo con InDesign CS3, al que accedes de forma remota como en mis skills de InDesign CS3 (cartelera-cine-indesign y maquetar-esquelas-indesign-cs3): usa el mismo método de acceso y de transferencia de archivos que ya conoces de ahí.

CONTEXTO
La herramienta («IDML a CS3») convierte un documento de InDesign CS6 en un script que lo reconstruye en CS3. En ese ordenador la probé y no funcionó, pero no sé por qué. Tu trabajo NO es arreglarla ni editar nada: es averiguar exactamente qué pasa y traerme los textos tal cual los muestra InDesign.

ARCHIVO
Repositorio de GitHub pcoutogar-dot/pruebaclaude, rama claude/nifty-ritchie-xel9mp, carpeta idml-a-cs3/dist/, archivo ejemplo_para_CS3.zip (un documento de ejemplo ya convertido: contiene 0_comprobar_CS3.jsx, 1_reconstruir_en_CS3.jsx, una imagen y más). Bájalo en mi ordenador principal (en la web de GitHub: abre el archivo y pulsa «Download raw file»; o con git, si lo tienes) y pásalo al ordenador con CS3.

PASOS EN EL ORDENADOR CON CS3
1. Descomprime el zip en el Escritorio. Se crea la carpeta ejemplo_para_CS3.
2. Abre InDesign CS3. Si ya hay documentos abiertos, no los toques ni los cierres.
3. Menú Ventana > Automatización > Scripts. En el panel, clic derecho sobre «Usuario» > «Mostrar en el Explorador» (en Mac, «Finder»). Copia ahí 0_comprobar_CS3.jsx y 1_reconstruir_en_CS3.jsx. Vuelve a InDesign y comprueba que aparecen dentro de «Usuario» (si no, clic derecho > «Actualizar»).
4. Ejecuta 0_comprobar_CS3.jsx (doble clic sobre su nombre en el panel). Tarda unos segundos y sale un aviso. Haz una captura del aviso entero. El script deja además diagnostico_CS3.txt en el Escritorio.
5. Ejecuta 1_reconstruir_en_CS3.jsx. Si pregunta por las imágenes, responde Sí y elige la carpeta ejemplo_para_CS3. Al terminar sale un aviso: captúralo entero. El script deja también resultado_reconstruccion.txt en el Escritorio.
6. Mira el documento nuevo que ha creado: cuántas páginas tiene, si hay textos, imágenes y formas, si algo se ve raro. Haz una captura de las primeras páginas.
7. Si en cualquier momento sale una ventana de error de InDesign («Error de JavaScript», con número de error, línea y origen), copia el texto literal o haz una captura en la que se lea bien.
8. Cierra sin guardar el documento nuevo. No guardes nada.

QUÉ TRAERME (sin resumir ni interpretar)
- El contenido COMPLETO de diagnostico_CS3.txt y de resultado_reconstruccion.txt. Cópialos al ordenador principal con tu método de transferencia y pega aquí su texto. Si no puedes, ábrelos con el Bloc de notas y haz capturas en las que se lean todas las líneas.
- Los textos de los avisos y de cualquier ventana de error.
- Qué pasos funcionaron y cuáles no, y qué viste en pantalla.

LÍMITES
- No modifiques, guardes ni cierres ningún documento mío. No instales nada ni cambies configuraciones del ordenador. No edites los scripts.
- Si algo te pide confirmar una acción distinta de las de arriba, para y pregúntame.

Cuando termines, dámelo todo junto: yo lo pego en la sesión «Compatibilidad InDesign CS6 a CS3», que es la que corrige la herramienta.
```

## Si no hay acceso remoto

Los mismos pasos en el ordenador con CS3, a mano:

1. Con `dist/idml-a-cs3.html` convierte un `.idml` (o usa `dist/ejemplo_para_CS3.zip`, que ya viene hecho).
2. Ejecuta `0_comprobar_CS3.jsx` y después `1_reconstruir_en_CS3.jsx` desde el panel Scripts.
3. Envía el contenido de `diagnostico_CS3.txt` y `resultado_reconstruccion.txt` (los dos quedan en el Escritorio).

Para ver los errores con número de línea también sirve el *ExtendScript Toolkit* que acompaña a CS3: doble clic en el
`.jsx`, elegir «Adobe InDesign CS3» en el desplegable de arriba a la izquierda y pulsar ▶; los errores salen en su consola.
