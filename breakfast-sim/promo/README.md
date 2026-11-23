# Vídeos promocionales

`gameplay-tostada-aguacate.mp4` — 5 s, 1080×1920, 30 fps, H.264 (listo para Reels/Stories).

Se graban desde el propio juego, fotograma a fotograma (modo grabación: `window.__record = true`),
así salen fluidos aunque el equipo sea lento. Para regenerarlo:

```bash
npm run build && npx vite preview --port 4173
node tools/record-promo.cjs <carpeta-salida>   # deja los PNG en <carpeta-salida>/frames
ffmpeg -framerate 30 -i <carpeta-salida>/frames/%04d.png -vf "format=yuv420p" -c:v libx264 -crf 17 -movflags +faststart promo/video.mp4
```

## gameplay-editado.mp4 (14 s, Reels)

Montaje de seis planos con fundidos: mermelada → pelar aguacate → latte →
zumo → bol de açaí → mesa final con logo. Banda sonora lo-fi con sonidos
sincronizados. Para regenerarlo (con `npx vite preview --port 4173` en marcha):

    for s in jam peel latte juice acai final; do node tools/promo-scenes.cjs $s /tmp/promo; done
    python3 tools/promo-edit.py /tmp/promo promo/gameplay-editado.mp4
