# Inglés para valientes

Libro de inglés de supervivencia (64 páginas, 6 × 9 pulgadas) para hispanohablantes de más de 50 años que se van a vivir a Tailandia, Vietnam o Filipinas.

## Archivos

| Archivo | Qué es |
|---|---|
| `libro.pdf` | El libro listo para imprenta (Amazon KDP, 6 × 9 pulgadas, sin sangrado) |
| `libro.html` | Vista previa del libro completo en el navegador |
| `contenido.py` | Todo el texto del libro. Aquí se corrige y se amplía |
| `build.py` | Diseño, ilustraciones, códigos QR y montaje de páginas |
| `pdf.js` | Comprueba que ninguna página se desborde y genera el PDF |
| `investigacion.md` | Resumen de la investigación, con lo que hay que comprobar antes de cada edición |

## Cómo regenerar el libro

Necesitas Python 3 con el paquete `qrcode`, y Node con Playwright.

```bash
pip install qrcode
```

```bash
python3 build.py
```

```bash
node pdf.js --pdf
```

`node pdf.js` sin opciones solo comprueba que todo cabe.

## Antes de imprimir

1. En `build.py`, cambia `DOMINIO = "TU-DOMINIO.com"` por tu dominio y vuelve a generar el libro. Los QR apuntan a `tu-dominio/audio/<número>`: el 0 es la bienvenida y del 1 al 10, un número por capítulo.
2. En `contenido.py`, sustituye `[Tu nombre]` (aparece en la carta y en la página final).
3. Pide que revisen la pronunciación y las palabras en tailandés y vietnamita (ver `investigacion.md`).
4. La contraportada de esta vista previa es orientativa. Para Amazon, la cubierta se sube aparte, como un único archivo con portada, lomo y contraportada.
