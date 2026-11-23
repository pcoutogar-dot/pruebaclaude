# Vídeos promocionales

`gameplay-tostada-aguacate.mp4` — 5 s, 1080×1920, 30 fps, H.264 (listo para Reels/Stories).

Se graban desde el propio juego, fotograma a fotograma (modo grabación: `window.__record = true`),
así salen fluidos aunque el equipo sea lento. Para regenerarlo:

```bash
npm run build && npx vite preview --port 4173
node tools/record-promo.cjs <carpeta-salida>   # deja los PNG en <carpeta-salida>/frames
ffmpeg -framerate 30 -i <carpeta-salida>/frames/%04d.png -vf "format=yuv420p" -c:v libx264 -crf 17 -movflags +faststart promo/video.mp4
```
