# Breakfast Simulator — prototipo estético

Primer prototipo en three.js centrado en la **estética cozy**: una cocina con luz de mañana,
el desayuno "cutre" (piso compartido) frente al "bonito" (mañana dorada) y el gesto de
**untar con el dedo** sobre la tostada.

Todo es procedural (texturas en canvas, sonido sintetizado): no hay assets externos todavía.

```bash
npm install
npm run dev
```

- Desliza sobre la tostada para untar (aguacate / margarina).
- Arrastra fuera de la tostada para girar un poco la cámara.
- Arriba a la derecha cambias entre "Piso compartido" y "Mañana dorada".

El build (`npm run build`) usa rutas relativas para empaquetarlo luego con Capacitor para iOS.
