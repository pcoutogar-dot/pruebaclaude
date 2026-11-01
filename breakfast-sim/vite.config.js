import { defineConfig } from 'vite';
// base relativa: el build funciona dentro de Capacitor (iOS) sin servidor.
// Las texturas se incrustan en el bundle: un solo archivo, sin peticiones extra.
export default defineConfig({ base: './', build: { assetsInlineLimit: 100_000_000 } });
