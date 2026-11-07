# Inglés para valientes

Dos productos para hispanohablantes de más de 50 años que se van a vivir a Tailandia, Vietnam o Filipinas:

- **Inglés para valientes** (78 páginas, 6 × 9 pulgadas): el libro con todo el contenido.
- **Inglés para valientes: Cuaderno de ejercicios** (36 páginas, 6 × 9 pulgadas): dos páginas de juegos por capítulo, audios para escuchar y repetir, test final, soluciones y certificado. Cada página de práctica indica en qué página del libro está la teoría.

## Archivos

| Archivo | Qué es |
|---|---|
| `libro.pdf` / `cuaderno.pdf` | Cada producto completo, con cubiertas: para revisar y para vender en PDF |
| `libro-interior.pdf` / `cuaderno-interior.pdf` | Solo el interior, sin cubiertas: es lo que se sube a Amazon KDP (6 × 9 pulgadas, sin sangrado) |
| `libro.html` / `cuaderno.html` | Vista previa de cada producto en el navegador |
| `contenido.py` | Todo el texto de los dos productos. Aquí se corrige y se amplía |
| `build.py` | Diseño, ilustraciones, códigos QR, juegos y montaje de páginas |
| `pdf.js` | Comprueba que ninguna página se desborde y genera los PDF |
| `investigacion.md` | Resumen de la investigación, con lo que hay que comprobar antes de cada edición |

## Cómo regenerar los dos productos

Necesitas Python 3 con el paquete `qrcode`, y Node con Playwright.

```bash
pip install qrcode
```

```bash
python3 build.py
```

```bash
node pdf.js libro --pdf
```

```bash
node pdf.js cuaderno --pdf
```

Sin `--pdf`, `pdf.js` solo comprueba que todo cabe. Si cambias el libro, regenera también el cuaderno: sus referencias a las páginas del libro se calculan solas.

## Antes de imprimir

1. En `build.py`, cambia `DOMINIO = "TU-DOMINIO.com"` por tu dominio y vuelve a generar. Los QR apuntan a `tu-dominio/audio/<número>`: el 0 es la bienvenida y del 1 al 11, un número por capítulo (el libro y el cuaderno usan los mismos audios).
2. En `contenido.py`, sustituye `[Tu nombre]` (carta al lector y créditos de los dos productos).
3. Revisa las anécdotas «Me pasó a mí» (una al principio de cada capítulo del libro): son borradores en tu voz. Cuando estén listas, pon `BORRADOR = False` en `build.py` para quitar la etiqueta de la vista previa (en el PDF no aparece).
4. Pide que revisen la pronunciación y las palabras en tailandés y vietnamita (ver `investigacion.md`).
5. Cada producto necesita su propio ISBN y su propia cubierta para Amazon (portada, lomo y contraportada en un solo archivo).
