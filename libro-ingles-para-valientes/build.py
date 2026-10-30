"""Genera «Inglés para valientes» en HTML (vista previa) y PDF (imprenta, 6 x 9 pulgadas).

Uso:
    python3 build.py            -> libro.html
    node pdf.js                 -> libro.pdf (necesita Playwright)

El contenido vive en contenido.py; aquí solo están el diseño y los componentes.
"""
import html
import io
import re
import sys
from pathlib import Path

import qrcode
import qrcode.image.svg

# Mientras sea True, las anécdotas personales llevan en la vista previa la etiqueta «Borrador».
# Ponlo a False cuando las hayas revisado y adaptado a tu experiencia real.
BORRADOR = True

# Cambia esto por tu dominio real antes de imprimir: los QR apuntan a DOMINIO/audio/<pista>.
DOMINIO = "TU-DOMINIO.com"

AQUI = Path(__file__).parent

# ---------------------------------------------------------------- paleta
J, JD, M, H, MINT, INK, W, SKIN = "#0E5A52", "#0A403A", "#F4B63F", "#C93D6A", "#E7F2EC", "#17302C", "#FFFFFF", "#F2C9A5"

CSS = r"""
/* Layout: mesa de maquetación con las páginas del libro en fila (papel fijo, siempre claro);
   dentro de cada página todo escala con su ancho (cqw), igual que en el PDF de 6 x 9 pulgadas. */
:root {
  --bg: #EEF3EF; --fg: #1C2B28; --muted: #56655F; --rule: #CBD8D1;
  --jade: #0E5A52; --jade-deep: #0A403A; --mango: #F4B63F; --mango-soft: #FDEFCB;
  --hibiscus: #C93D6A; --hibiscus-soft: #FBE3EB; --ink: #17302C; --ink-soft: #4A5E58;
  --paper: #FFFFFF; --mint: #E7F2EC;
  --display: "Bricolage Grotesque", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  --body: "Atkinson Hyperlegible", Verdana, "Segoe UI", system-ui, sans-serif;
  --hand: "Caveat", "Segoe Script", cursive;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #101816; --fg: #E4ECE8; --muted: #9DB0A9; --rule: #2A3935; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #101816; --fg: #E4ECE8; --muted: #9DB0A9; --rule: #2A3935; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font-family: var(--body); }
.wrap { max-width: 1400px; margin: 0 auto; padding-block: 36px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 28px; }
.intro { display: grid; gap: 8px; max-width: 70ch; }
.intro .eyebrow { font: 700 12px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.intro h1 { font: 800 clamp(28px, 4vw, 42px)/1.05 var(--display); margin: 0; letter-spacing: -.01em; }
.intro p { margin: 0; font-size: 15.5px; line-height: 1.55; color: var(--muted); }
.jump { display: flex; flex-wrap: wrap; gap: 8px; }
.jump a { font: 700 13px/1 var(--body); color: var(--fg); text-decoration: none; border: 1px solid var(--rule); border-radius: 99px; padding: 8px 12px; }
.jump a:hover, .jump a:focus-visible { border-color: var(--fg); outline: none; }
.desk { display: flex; flex-wrap: wrap; gap: 32px 24px; justify-content: center; }
.slot { display: grid; gap: 8px; width: min(100%, 400px); min-width: 0; scroll-margin-top: 16px; }
.slot .lbl { font-size: 12.5px; color: var(--muted); }

/* ---------- página ---------- */
.page { container-type: inline-size; position: relative; width: 100%; aspect-ratio: 2 / 3; background: var(--paper); color: var(--ink); border-radius: 3px; overflow: hidden; box-shadow: 0 1px 2px rgba(10,40,35,.12), 0 12px 32px -12px rgba(10,40,35,.35); }
.in { position: absolute; inset: 0; padding: 7cqw 8cqw 5.5cqw; display: flex; flex-direction: column; gap: 2.6cqw; }
.run { margin-top: auto; display: flex; justify-content: space-between; gap: 3cqw; font: 400 2.6cqw/1 var(--body); color: var(--ink-soft); border-top: .25cqw solid var(--mint); padding-top: 2.4cqw; }
.run b { font-weight: 700; color: var(--jade); }
.page h3 { margin: 0; font: 800 7cqw/1 var(--display); color: var(--jade); text-wrap: balance; }
.page h4 { margin: 0; font: 800 5cqw/1.05 var(--display); color: var(--jade); text-wrap: balance; }
.page h4.pink { color: var(--hibiscus); }
.page p { margin: 0; font-size: 3.45cqw; line-height: 1.42; }
.page p.soft { color: var(--ink-soft); font-size: 3.2cqw; }
.page em { color: var(--jade); }
.page strong { color: var(--jade-deep); }

/* portada */
.cover { background: var(--jade); color: #fff; }
.cover .art { position: absolute; inset: 0; width: 100%; height: 100%; }
.cover .in { padding: 9cqw 8cqw 8cqw; gap: 0; }
.cover .kicker { position: relative; font: 700 3.1cqw/1.2 var(--body); letter-spacing: .14em; text-transform: uppercase; color: var(--mango); }
.cover h2 { position: relative; margin: 4cqw 0 0; font: 800 13.5cqw/.9 var(--display); letter-spacing: -.02em; }
.cover h2 span { display: block; color: var(--mango); }
.cover .sub { position: relative; margin: 5cqw 0 0; font: 400 4.4cqw/1.3 var(--body); max-width: 60cqw; color: #fff; }
.cover .perks { position: relative; margin-top: 4.2cqw; display: flex; flex-wrap: wrap; gap: 1.6cqw; }
.cover .perks span { background: #fff; color: var(--jade-deep); font: 700 2.9cqw/1 var(--body); padding: 1.8cqw 2.6cqw; border-radius: 10cqw; }
.cover .countries { position: absolute; left: 8cqw; bottom: 6.5cqw; font: 700 2.8cqw/1.45 var(--body); letter-spacing: .16em; text-transform: uppercase; color: var(--mango); }
.back { background: var(--jade-deep); color: #fff; }
.back .in { padding: 10cqw 9cqw 8cqw; gap: 4cqw; }
.back h3 { color: var(--mango); font-size: 8cqw; }
.back p { color: #fff; font-size: 3.6cqw; line-height: 1.5; }
.back ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 2cqw; }
.back li { font: 700 3.6cqw/1.3 var(--body); padding-left: 5cqw; position: relative; }
.back li::before { content: ""; position: absolute; left: 0; top: 1.1cqw; width: 2.4cqw; height: 2.4cqw; border-radius: 50%; background: var(--mango); }
.back .bar { margin-top: auto; display: flex; justify-content: space-between; align-items: end; gap: 4cqw; }
.back .bar .price { font: 800 6cqw/1 var(--display); color: var(--mango); }
.back .isbn { width: 34cqw; height: 18cqw; background: #fff; border-radius: 1cqw; display: grid; place-items: center; color: var(--ink-soft); font: 400 2.4cqw/1.2 var(--body); text-align: center; }

/* carta */
.letter { gap: 2cqw; }
.letter h3 { margin: 0 0 1cqw; font-size: 8cqw; }
.letter p { font-size: 3.5cqw; line-height: 1.45; }
.letter .said { font: 700 4.6cqw/1.25 var(--display); color: var(--hibiscus); padding-left: 3.4cqw; border-left: .8cqw solid var(--mango); }
.ph { background: var(--mango-soft); border-radius: .8cqw; padding: 0 .8cqw; }
.letter .cups { width: 100%; height: auto; margin-top: auto; }
.promise { display: grid; gap: .8cqw; background: var(--mint); border-radius: 2.4cqw; padding: 3.4cqw 4cqw; font: 700 4.3cqw/1.2 var(--display); color: var(--jade); }
.promise span:last-child { color: var(--hibiscus); }
.sign { display: grid; gap: .4cqw; }
.sign small { font-size: 3.3cqw; color: var(--ink-soft); }
.sign .ph { justify-self: start; font: 600 8cqw/1 var(--hand); color: var(--jade); background: none; padding: 0; }

/* índice */
.toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 1.15cqw; }
.toc li { display: grid; grid-template-columns: 7cqw 1fr auto; align-items: baseline; gap: 2cqw; font-size: 3.45cqw; line-height: 1.15; }
.toc li .n { font: 800 3.6cqw/1 var(--display); color: var(--mango); -webkit-text-stroke: .15cqw var(--jade); }
.toc li .t { min-width: 0; }
.toc li .t small { display: block; font-size: 2.7cqw; color: var(--ink-soft); margin-top: .4cqw; }
.toc li .p { font-variant-numeric: tabular-nums; color: var(--ink-soft); font-size: 3.2cqw; }
.toc li.extra .n { color: var(--hibiscus); -webkit-text-stroke: 0; }

/* apertura de capítulo */
.opener .band { margin: -7cqw -8cqw 0; background: var(--mint); padding: 6cqw 8cqw 4cqw; display: grid; grid-template-columns: 1fr 34cqw; gap: 3cqw; align-items: end; }
.opener .band .num { font: 800 16cqw/.8 var(--display); color: var(--mango); -webkit-text-stroke: .35cqw var(--jade); }
.opener .band h3 { font-size: 8.4cqw; margin-top: 2cqw; }
.opener .band .en { display: block; font: italic 400 3.4cqw/1.3 var(--body); color: var(--ink-soft); margin-top: 1.4cqw; }
.opener .band svg { width: 34cqw; height: 28cqw; }
.learn { display: grid; gap: 1.4cqw; }
.learn .k { font: 700 2.6cqw/1 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-soft); }
.learn ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 1.3cqw; }
.learn li { font-size: 3.45cqw; line-height: 1.3; padding-left: 5cqw; position: relative; }
.learn li::before { content: ""; position: absolute; left: .4cqw; top: 1.1cqw; width: 2.2cqw; height: 2.2cqw; border-radius: 50%; background: var(--mango); }

/* anécdota personal */
.story { position: relative; background: var(--mango-soft); border-radius: 2.4cqw; padding: 2.8cqw 3.6cqw 3cqw; display: grid; gap: 1cqw; }
.story .who { font: 600 6cqw/1 var(--hand); color: var(--hibiscus); }
.story p { font-size: 3.3cqw; line-height: 1.42; }
.story .draft { position: absolute; top: -2.2cqw; right: 3cqw; font: 700 2.2cqw/1 var(--body); letter-spacing: .06em; text-transform: uppercase; background: var(--ink); color: #fff; padding: 1cqw 1.6cqw; border-radius: 1cqw; }
@media print { .story .draft { display: none; } }

/* no eres la única */
.feel { display: grid; gap: 1.6cqw; }
.feel div { display: grid; gap: .6cqw; padding-bottom: 1.6cqw; border-bottom: .2cqw solid var(--mint); }
.feel q { font: 700 3.9cqw/1.25 var(--display); color: var(--hibiscus); quotes: "«" "»"; }
.feel span { font-size: 3.2cqw; line-height: 1.38; }

/* cabecera de sección dentro del capítulo */
.sec { display: flex; align-items: center; gap: 3cqw; }
.sec .txt { min-width: 0; }
.sec .txt small { display: block; font: italic 400 3.2cqw/1.3 var(--body); color: var(--ink-soft); margin-top: .8cqw; }
.sec svg { margin-left: auto; flex: none; width: 16cqw; height: 13cqw; }

/* frases */
.phr { display: grid; border-top: .3cqw solid var(--jade); }
.row { display: grid; grid-template-columns: 1fr auto; gap: .3cqw 3cqw; padding: 1.25cqw 0; border-bottom: .2cqw solid var(--mint); align-items: center; }
.row .en { font: 700 3.95cqw/1.15 var(--body); color: var(--ink); min-width: 0; }
.row .es { grid-column: 1; font-size: 3cqw; color: var(--ink-soft); line-height: 1.25; }
.row .say { grid-row: 1 / span 2; grid-column: 2; background: var(--mango-soft); color: var(--jade-deep); font: 700 3.1cqw/1.15 var(--body); padding: 1.3cqw 2.2cqw; border-radius: 1.6cqw; text-align: right; max-width: 38cqw; }
.phr.small .row { padding: .95cqw 0; }
.phr.small .row .en { font-size: 3.6cqw; }
.phr.small .row .es { font-size: 2.85cqw; }
.phr.small .row .say { font-size: 2.9cqw; padding: 1cqw 2cqw; }
.legend { display: flex; gap: 3cqw; font: 700 2.2cqw/1 var(--body); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); justify-content: space-between; }
.legend span:last-child { background: var(--mango-soft); color: var(--jade-deep); padding: .8cqw 1.6cqw; border-radius: 1cqw; }

/* vocabulario en dos columnas */
.voc { display: grid; grid-template-columns: 1fr 1fr; gap: 0 4cqw; border-top: .3cqw solid var(--jade); }
.voc div { display: grid; gap: .2cqw; padding: 1.1cqw 0; border-bottom: .2cqw solid var(--mint); min-width: 0; }
.voc b { font: 700 3.5cqw/1.15 var(--body); }
.voc i { font: normal 700 2.75cqw/1.15 var(--body); color: var(--jade-deep); background: var(--mango-soft); justify-self: start; padding: .3cqw 1cqw; border-radius: .8cqw; }
.voc span { font-size: 2.85cqw; color: var(--ink-soft); line-height: 1.2; }
.voc.num3 { grid-template-columns: 1fr 1fr 1fr; gap: 0 3cqw; }
.voc.num3 div { padding: .9cqw 0; }
.voc.num3 b { font-size: 3.3cqw; }

/* así lo oirás */
.hear .top { display: grid; grid-template-columns: 1fr 20cqw; gap: 3cqw; align-items: center; }
.hear .top svg { width: 20cqw; height: 20cqw; }
.hear p.k { margin: 1cqw 0 0; font-size: 3.15cqw; line-height: 1.38; color: var(--ink-soft); }
.pairs { display: grid; gap: 1.3cqw; margin-top: 1.6cqw; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 2.4cqw; align-items: center; }
.pair .heard { background: var(--hibiscus-soft); color: var(--ink); font: 700 3.5cqw/1.2 var(--body); padding: 1.7cqw 2.4cqw; border-radius: 1.6cqw 1.6cqw 1.6cqw .3cqw; }
.pair .means { font-size: 3.25cqw; line-height: 1.25; color: var(--ink); }
.pair .means::before { content: "→ "; color: var(--hibiscus); font-weight: 700; }

/* diálogo */
.dlg { background: var(--mint); border-radius: 2.4cqw; padding: 3cqw 3.4cqw; display: grid; gap: 1.3cqw; }
.dlg h4 { color: var(--hibiscus); font-size: 4.6cqw; }
.dlg .l { display: grid; grid-template-columns: 15cqw 1fr; gap: 2cqw; font-size: 3.35cqw; line-height: 1.28; }
.dlg .who { font: 700 2.4cqw/1.5 var(--body); letter-spacing: .07em; text-transform: uppercase; color: var(--ink-soft); }
.dlg .me .who { color: var(--jade); }
.dlg .me .t { font-weight: 700; }
.dlg .t small { display: block; font-weight: 400; font-style: italic; color: var(--jade); font-size: 2.85cqw; }
.dlg .t span.es { display: block; font-weight: 400; color: var(--ink-soft); font-size: 2.8cqw; }

/* truco y cajas */
.tip { display: grid; grid-template-columns: auto 1fr; gap: 2.6cqw; align-items: start; border: .35cqw solid var(--mango); border-radius: 2.4cqw; padding: 2.6cqw 3.2cqw; }
.tip .badge { font: 800 2.9cqw/1 var(--display); background: var(--mango); color: var(--jade-deep); padding: 1.3cqw 1.9cqw; border-radius: 1cqw; text-transform: uppercase; letter-spacing: .04em; }
.tip p { font-size: 3.2cqw; line-height: 1.38; }
.tip p b { display: block; font-size: 3.7cqw; color: var(--jade); }
.tip.pink { border-color: var(--hibiscus); }
.tip.pink .badge { background: var(--hibiscus); color: #fff; }
.box { background: var(--mint); border-radius: 2.4cqw; padding: 3cqw 3.4cqw; display: grid; gap: 1.4cqw; }
.box h4 { font-size: 4.4cqw; }
.box p { font-size: 3.2cqw; }
.facts { display: grid; gap: .9cqw; }
.facts div { display: grid; grid-template-columns: 1fr auto; gap: 2cqw; font-size: 3.2cqw; line-height: 1.25; border-bottom: .2cqw solid #fff; padding-bottom: .9cqw; }
.facts div b { font: 800 4cqw/1 var(--display); color: var(--hibiscus); font-variant-numeric: tabular-nums; }
.bul { margin: 0; padding: 0; list-style: none; display: grid; gap: 1.3cqw; }
.bul li { font-size: 3.3cqw; line-height: 1.35; padding-left: 4.6cqw; position: relative; }
.bul li::before { content: ""; position: absolute; left: .3cqw; top: 1.2cqw; width: 2cqw; height: 2cqw; border-radius: 50%; background: var(--mango); }
.bul li b { color: var(--jade-deep); }

/* audio */
.audio { display: flex; align-items: center; gap: 3cqw; background: var(--mint); border-radius: 2cqw; padding: 2.2cqw 3cqw; }
.audio svg { width: 12.5cqw; height: 12.5cqw; flex: none; background: #fff; border-radius: .8cqw; padding: .6cqw; box-sizing: border-box; }
.audio p { font-size: 2.95cqw; line-height: 1.35; }
.audio b { color: var(--jade); }
.audio code { font: 700 2.8cqw/1 var(--body); color: var(--jade-deep); }

/* palabras locales */
.local { display: grid; border-top: .3cqw solid var(--hibiscus); }
.local div { display: grid; grid-template-columns: 1fr auto; gap: .3cqw 3cqw; padding: 1.1cqw 0; border-bottom: .2cqw solid var(--hibiscus-soft); align-items: center; }
.local b { font: 700 3.7cqw/1.15 var(--body); }
.local span { grid-column: 1; font-size: 2.9cqw; color: var(--ink-soft); }
.local i { grid-row: 1 / span 2; grid-column: 2; font: normal 700 3cqw/1.15 var(--body); background: var(--hibiscus-soft); color: var(--ink); padding: 1cqw 2cqw; border-radius: 1.4cqw; }

/* tarjetas */
.cut { border: .5cqw dashed var(--ink-soft); border-radius: 3cqw; padding: 4.4cqw 4.6cqw 3.4cqw; position: relative; display: grid; gap: 2cqw; }
.cut::before { content: "\2702"; position: absolute; top: -3.4cqw; left: 6cqw; background: var(--paper); padding: 0 1.6cqw; font-size: 5cqw; line-height: 1; color: var(--ink-soft); }
.cut .hd { display: flex; justify-content: space-between; align-items: center; gap: 3cqw; background: var(--hibiscus); color: #fff; margin: -1cqw -1cqw .6cqw; padding: 2.4cqw 3.2cqw; border-radius: 1.8cqw; }
.cut .hd.jade { background: var(--jade); }
.cut .hd strong { font: 800 5cqw/1 var(--display); letter-spacing: .02em; color: #fff; }
.cut .hd span { font: 400 2.7cqw/1.2 var(--body); text-align: right; }
.field { display: grid; gap: .4cqw; }
.field .lab { font: 700 3.3cqw/1.1 var(--body); }
.field .lab small { font-weight: 400; color: var(--ink-soft); font-size: 2.7cqw; margin-left: 1.4cqw; }
.field .line { border-bottom: .3cqw solid var(--ink-soft); height: 3.2cqw; }
.ask { display: grid; gap: 1.2cqw; }
.ask div { background: var(--mango-soft); border-radius: 1.4cqw; padding: 1.6cqw 2.4cqw; font: 700 3.3cqw/1.2 var(--body); }
.ask div small { display: block; font-weight: 400; font-size: 2.7cqw; color: var(--ink-soft); }

/* diccionario */
.dict { columns: 2; column-gap: 5cqw; font-size: 2.75cqw; line-height: 1.22; }
.dict div { break-inside: avoid; padding: .3cqw 0; border-bottom: .15cqw solid var(--mint); }
.dict b { font-size: 3cqw; }
.dict i { font-style: normal; color: var(--jade-deep); background: var(--mango-soft); padding: 0 .6cqw; border-radius: .5cqw; margin-left: .6cqw; }
.dict span { display: block; color: var(--ink-soft); }
.dict .letter-h { font: 800 3.6cqw/1 var(--display); color: var(--hibiscus); border: 0; padding: .8cqw 0 .2cqw; }

/* comprobación */
.check { display: grid; gap: 1.2cqw; margin: 0; padding: 0; list-style: none; }
.check li { display: grid; grid-template-columns: 4.4cqw 1fr; gap: 2.4cqw; font-size: 3.3cqw; line-height: 1.3; align-items: start; }
.check li::before { content: ""; width: 3.6cqw; height: 3.6cqw; border: .45cqw solid var(--jade); border-radius: .9cqw; margin-top: .1cqw; }
.check li small { display: block; color: var(--ink-soft); font-size: 2.8cqw; }

/* sonidos */
.snd { display: grid; gap: 1.3cqw; }
.snd div { display: grid; grid-template-columns: 13cqw 1fr; gap: 3cqw; align-items: center; padding-bottom: 1.3cqw; border-bottom: .2cqw solid var(--mint); }
.snd b { font: 800 5.4cqw/1 var(--display); color: var(--jade); text-align: center; background: var(--mango-soft); border-radius: 1.6cqw; padding: 1.4cqw 0; }
.snd p { font-size: 3.15cqw; line-height: 1.35; }

.notes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px 28px; border-top: 1px solid var(--rule); padding-top: 24px; }
.notes div { display: grid; gap: 6px; min-width: 0; }
.notes h2 { margin: 0; font: 700 16px/1.25 var(--display); }
.notes p { margin: 0; font-size: 14.5px; line-height: 1.5; color: var(--muted); }

@media print {
  @page { size: 6in 9in; margin: 0; }
  body { background: #fff; }
  .wrap { display: block; padding: 0; max-width: none; }
  .intro, .notes, .slot .lbl { display: none; }
  .desk { display: block; }
  .slot { display: block; width: 6in; }
  .page { width: 6in; height: 9in; aspect-ratio: auto; border-radius: 0; box-shadow: none; break-after: page; }
}
"""

FUENTES = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
           '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
           '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400'
           '&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Caveat:wght@600&display=swap">')


def e(t):
    """Escapa texto, pero deja pasar <b>, <em>, <strong>, <br> y <span class="ph"> escritos a mano en el contenido."""
    t = html.escape(t, quote=False)
    return re.sub(r"&lt;(/?(?:b|em|strong|br|i|small)|span class=&quot;ph&quot;|span class=\"ph\"|/span)&gt;",
                  lambda m: "<" + html.unescape(m.group(1)) + ">", t)


def nb(t):
    """La pronunciación no se parte por «s-» ni por guiones: usa un guion que no rompe línea."""
    return t.replace("-", "\u2011")


# ---------------------------------------------------------------- ilustraciones (viewBox 0 0 34 28)
def _palm(x, y, s=1.0, c=J):
    leaves = "".join(
        f'<path d="M{x} {y} C{x-2.2*s} {y-1.4*s} {x-4*s} {y-1*s} {x-4.8*s} {y+.4*s} C{x-3.2*s} {y-.3*s} {x-1.7*s} {y-.2*s} {x} {y} Z"/>'
        f'<path d="M{x} {y} C{x+2.2*s} {y-1.6*s} {x+3.8*s} {y-1.1*s} {x+4.6*s} {y+.2*s} C{x+3*s} {y-.4*s} {x+1.6*s} {y-.3*s} {x} {y} Z"/>'
        f'<path d="M{x} {y} C{x-.8*s} {y-2.2*s} {x-2.4*s} {y-3*s} {x-3.6*s} {y-2.8*s} C{x-2*s} {y-2.1*s} {x-1*s} {y-1.4*s} {x} {y} Z"/>'
        f'<path d="M{x} {y} C{x+1*s} {y-2.2*s} {x+2.6*s} {y-3*s} {x+3.8*s} {y-2.6*s} C{x+2.2*s} {y-2*s} {x+1.1*s} {y-1.3*s} {x} {y} Z"/>'
        for _ in [0])
    return (f'<path d="M{x-.7*s} {y+9*s} Q{x-1.2*s} {y+4*s} {x} {y}" stroke="{c}" stroke-width="{1*s}" fill="none" stroke-linecap="round"/>'
            f'<g fill="{c}">{leaves}</g>')


SPOTS = {
    "hola": f'''<rect x="2" y="3" width="19" height="11" rx="3" fill="{J}"/><path d="M6 13.6 L4.5 18 L10 13.8 Z" fill="{J}"/>
      <text x="11.5" y="10.6" text-anchor="middle" font-family="Bricolage Grotesque, system-ui, sans-serif" font-weight="800" font-size="5.4" fill="#fff">Hello!</text>
      <rect x="13" y="13" width="19" height="10" rx="3" fill="{M}"/><path d="M27 22.6 L29.5 26.5 L24 22.8 Z" fill="{M}"/>
      <text x="22.5" y="19.9" text-anchor="middle" font-family="Bricolage Grotesque, system-ui, sans-serif" font-weight="800" font-size="5" fill="{JD}">¡Hola!</text>''',
    "avion": f'''<rect x="4" y="8" width="13" height="18" rx="1.6" fill="{J}"/><circle cx="10.5" cy="15" r="3.4" fill="none" stroke="#fff" stroke-width=".7"/>
      <path d="M7.1 15 H13.9 M10.5 11.6 C8.6 13 8.6 17 10.5 18.4 C12.4 17 12.4 13 10.5 11.6" stroke="#fff" stroke-width=".5" fill="none"/>
      <rect x="7" y="21" width="7" height=".9" rx=".45" fill="{M}"/><rect x="8" y="23" width="5" height=".9" rx=".45" fill="#fff"/>
      <path d="M15 7 C20 1.5 26 1 30 3.5" stroke="{J}" stroke-width=".7" stroke-dasharray="1.6 1.6" fill="none"/>
      <path d="M29.4 1.4 L33.5 3.6 L29.2 5.4 L30.2 3.5 Z" fill="{H}"/>''',
    "casa": f'''<circle cx="26" cy="7" r="5" fill="{M}"/><rect x="6" y="4" width="15" height="22" rx="1" fill="{MINT}" stroke="{J}" stroke-width="1"/>
      <g fill="{J}"><rect x="8.5" y="7" width="3.2" height="2.6"/><rect x="15.3" y="7" width="3.2" height="2.6"/><rect x="8.5" y="12" width="3.2" height="2.6"/><rect x="15.3" y="12" width="3.2" height="2.6"/><rect x="8.5" y="17" width="3.2" height="2.6"/></g>
      <rect x="15.3" y="17" width="3.2" height="2.6" fill="{H}"/><rect x="11.8" y="21.5" width="3.4" height="4.5" fill="{J}"/>
      <rect x="0" y="26" width="34" height="1.2" rx=".6" fill="{MINT}"/>''' + _palm(28.5, 15, 1, J),
    "dinero": f'''<rect x="2.5" y="8" width="21" height="12" rx="1.6" fill="{J}"/><rect x="4.2" y="9.7" width="17.6" height="8.6" rx="1" fill="none" stroke="#fff" stroke-width=".5"/>
      <circle cx="13" cy="14" r="3" fill="{M}"/><text x="13" y="15.6" text-anchor="middle" font-family="Bricolage Grotesque, system-ui, sans-serif" font-weight="800" font-size="4.2" fill="{JD}">$</text>
      <g fill="{M}" stroke="{JD}" stroke-width=".5"><ellipse cx="27" cy="24" rx="5" ry="1.8"/><ellipse cx="27" cy="21.6" rx="5" ry="1.8"/><ellipse cx="27" cy="19.2" rx="5" ry="1.8"/><ellipse cx="27" cy="16.8" rx="5" ry="1.8"/></g>
      <rect x="0" y="26" width="34" height="1.2" rx=".6" fill="{MINT}"/>''',
    "clinica": f'''<rect x="0" y="26" width="34" height="1.2" rx=".6" fill="{MINT}"/>
      <rect x="6" y="8" width="20" height="18" rx="1.5" fill="{MINT}" stroke="{J}" stroke-width="1"/><rect x="4.5" y="6" width="23" height="3" rx="1" fill="{J}"/>
      <rect x="14.5" y="10.5" width="3" height="8" rx=".5" fill="{H}"/><rect x="12" y="13" width="8" height="3" rx=".5" fill="{H}"/>
      <rect x="13.5" y="20.5" width="5" height="5.5" fill="{J}"/>
      <rect x="8.2" y="12" width="3" height="3" fill="#fff" stroke="{J}" stroke-width=".6"/><rect x="20.8" y="12" width="3" height="3" fill="#fff" stroke="{J}" stroke-width=".6"/>''' + _palm(31, 17, .9, J),
    "farmacia": f'''<rect x="0" y="26" width="34" height="1.2" rx=".6" fill="{MINT}"/>
      <rect x="5" y="9" width="11" height="17" rx="2" fill="{J}"/><rect x="6" y="5.5" width="9" height="4" rx="1" fill="{H}"/>
      <rect x="6.8" y="13" width="7.4" height="7" rx="1" fill="#fff"/><rect x="9.8" y="14" width="1.4" height="5" fill="{H}"/><rect x="8" y="15.8" width="5" height="1.4" fill="{H}"/>
      <g transform="rotate(-30 25 18)"><rect x="19" y="15" width="12" height="6" rx="3" fill="{M}"/><path d="M25 15 H28 A3 3 0 0 1 28 21 H25 Z" fill="{H}"/></g>''',
    "tuktuk": f'''<rect x="0" y="26" width="34" height="1.2" rx=".6" fill="{MINT}"/>
      <rect x="5" y="5" width="21" height="3.2" rx="1.2" fill="{H}"/><rect x="6.5" y="8" width="1.2" height="7" fill="{H}"/><rect x="18" y="8" width="1.2" height="7" fill="{H}"/>
      <path d="M4 22 V14.5 H21 L28 18.5 L30 22 Z" fill="{J}"/><rect x="9" y="16" width="7" height="3" rx="1" fill="{M}"/>
      <circle cx="9" cy="23" r="3" fill="{INK}"/><circle cx="9" cy="23" r="1" fill="{MINT}"/><circle cx="25.5" cy="23" r="3" fill="{INK}"/><circle cx="25.5" cy="23" r="1" fill="{MINT}"/>''',
    "comida": f'''<path d="M10 5 C9 3.5 11 2.5 10 1 M15 5 C14 3.5 16 2.5 15 1 M20 5 C19 3.5 21 2.5 20 1" stroke="#9DB0A9" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <path d="M4 12 C8 9 12 13 16 10 S24 12 30 9.5" stroke="{M}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M22 1.5 L28.5 12 M25 1 L30.5 11" stroke="{INK}" stroke-width=".9" stroke-linecap="round"/>
      <path d="M3 13 H31 C31 20.5 25.5 25 17 25 C8.5 25 3 20.5 3 13 Z" fill="{H}"/><path d="M5 15.5 H29" stroke="#fff" stroke-width=".6" stroke-dasharray="1.4 1.4"/>
      <rect x="0" y="26" width="34" height="1.2" rx=".6" fill="{MINT}"/>''',
    "segura": f'''<path d="M17 2.5 L28.5 6.8 V14 C28.5 20.6 23.4 24.6 17 26.4 C10.6 24.6 5.5 20.6 5.5 14 V6.8 Z" fill="{J}"/>
      <path d="M17 5.2 L26 8.6 V14 C26 19.2 22 22.4 17 23.8 Z" fill="{JD}"/>
      <path d="M11.5 14.6 L15.4 18.4 L22.8 10.6" stroke="{M}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>''',
    "amigos": f'''<rect x="2" y="26" width="30" height="1.2" rx=".6" fill="{MINT}"/>
      <path d="M4 12 H15 V19 C15 22 13 24 9.5 24 C6 24 4 22 4 19 Z" fill="{J}"/><path d="M15 14 C18 14 18 19.5 15 19.5" stroke="{J}" stroke-width="1.1" fill="none"/>
      <path d="M19 13 H30 V19.5 C30 22.3 28 24 24.5 24 C21 24 19 22.3 19 19.5 Z" fill="{H}"/><path d="M30 15 C33 15 33 20 30 20" stroke="{H}" stroke-width="1.1" fill="none"/>
      <path d="M17 9.6 C15.6 7.4 13 7.6 13 9.8 C13 11.8 17 13.6 17 13.6 C17 13.6 21 11.8 21 9.8 C21 7.6 18.4 7.4 17 9.6 Z" fill="{M}"/>''',
    "movil": f'''<rect x="10" y="1.5" width="14" height="25" rx="2.2" fill="{INK}"/><rect x="11.4" y="4" width="11.2" height="19" rx=".8" fill="{MINT}"/>
      <rect x="12.4" y="6" width="7.5" height="4" rx="1.4" fill="{J}"/><rect x="14.2" y="11.6" width="7.5" height="4" rx="1.4" fill="{M}"/><rect x="12.4" y="17.2" width="6" height="4" rx="1.4" fill="{H}"/>
      <circle cx="17" cy="24.8" r=".8" fill="{MINT}"/>
      <text x="4.5" y="9" text-anchor="middle" font-family="Bricolage Grotesque, system-ui, sans-serif" font-weight="800" font-size="6" fill="{H}">A</text>
      <text x="29.5" y="21" text-anchor="middle" font-family="Bricolage Grotesque, system-ui, sans-serif" font-weight="800" font-size="6" fill="{J}">?</text>''',
    "pagoda": f'''<rect x="0" y="26" width="34" height="1.2" rx=".6" fill="{MINT}"/><circle cx="24" cy="12" r="7" fill="{M}"/>
      <g fill="{J}"><rect x="7" y="22" width="16" height="4"/><rect x="9" y="19.4" width="12" height="2.6"/><path d="M10.5 19.4 Q15 6 19.5 19.4 Z"/><rect x="13.9" y="10" width="2.2" height="1.4"/><path d="M14.3 10 L15 1.5 L15.7 10 Z"/></g>''',
    "farolillos": f'''<path d="M2 3 Q17 8 32 3" stroke="{INK}" stroke-width=".5" fill="none"/>
      <g><line x1="8" y1="4.6" x2="8" y2="8" stroke="{INK}" stroke-width=".4"/><ellipse cx="8" cy="13" rx="4.2" ry="5.4" fill="{H}"/><rect x="6.4" y="7.4" width="3.2" height="1.2" fill="{M}"/><rect x="6.4" y="17.6" width="3.2" height="1.2" fill="{M}"/><line x1="8" y1="18.8" x2="8" y2="22" stroke="{M}" stroke-width=".6"/></g>
      <g><line x1="17" y1="5.5" x2="17" y2="10" stroke="{INK}" stroke-width=".4"/><ellipse cx="17" cy="15.4" rx="4.6" ry="5.8" fill="{M}"/><rect x="15.3" y="9.4" width="3.4" height="1.2" fill="{H}"/><rect x="15.3" y="20.4" width="3.4" height="1.2" fill="{H}"/><line x1="17" y1="21.6" x2="17" y2="25.4" stroke="{H}" stroke-width=".6"/></g>
      <g><line x1="26" y1="4.6" x2="26" y2="8" stroke="{INK}" stroke-width=".4"/><ellipse cx="26" cy="13" rx="4.2" ry="5.4" fill="{J}"/><rect x="24.4" y="7.4" width="3.2" height="1.2" fill="{M}"/><rect x="24.4" y="17.6" width="3.2" height="1.2" fill="{M}"/><line x1="26" y1="18.8" x2="26" y2="22" stroke="{M}" stroke-width=".6"/></g>''',
    "isla": f'''<circle cx="9" cy="9" r="5.5" fill="{M}"/><path d="M0 23 C6 21 10 25 17 23 S28 21 34 23 V28 H0 Z" fill="{J}" opacity=".25"/>
      <path d="M8 23.5 C11 17.5 23 17.5 27 23.5 Z" fill="{M}" opacity=".85"/>''' + _palm(19, 10, 1.25, J),
}


def spot(name, cls=""):
    return f'<svg class="{cls}" viewBox="0 0 34 28" aria-hidden="true">{SPOTS[name]}</svg>'


def qr_svg(pista):
    url = f"https://{DOMINIO}/audio/{pista}"
    img = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=1)
    buf = io.BytesIO()
    img.save(buf)
    svg = buf.getvalue().decode()
    svg = re.sub(r"<\?xml[^>]*>", "", svg)
    svg = re.sub(r'width="[^"]*" height="[^"]*"', 'aria-hidden="true"', svg, count=1)
    return svg.replace('fill="#000000"', f'fill="{JD}"')


# ---------------------------------------------------------------- bloques
def chap_opener(n, titulo, en, ilus, aprenderas, escena=None):
    li = "".join(f"<li>{e(x)}</li>" for x in aprenderas)
    esc = historia(escena) if escena else ""
    aud = audio(n, "Todas las frases del capítulo, grabadas.")
    return ("opener", f'''<div class="band"><div><div class="num">{n}</div><h3>{e(titulo)}</h3><span class="en">{e(en)}</span></div>{spot(ilus)}</div>
      <div class="learn"><span class="k">En este capítulo</span><ul>{li}</ul></div>{esc}{aud}''')


def historia(texto, titulo="Me pasó a mí"):
    tag = '<span class="draft">Borrador: adáptalo a tu experiencia real</span>' if BORRADOR else ""
    return f'<div class="story">{tag}<span class="who">{e(titulo)}</span><p>{e(texto)}</p></div>'


def sec(titulo, sub=None, ilus=None):
    s = f"<small>{e(sub)}</small>" if sub else ""
    return f'<div class="sec"><div class="txt"><h4>{e(titulo)}</h4>{s}</div>{spot(ilus) if ilus else ""}</div>'


def p(t, cls=""):
    return f'<p class="{cls}">{e(t)}</p>'


def frases(filas, small=False, legend=False):
    rows = "".join(f'<div class="row"><span class="en">{e(en)}</span><span class="say">{e(nb(say))}</span><span class="es">{e(es)}</span></div>'
                   for en, say, es in filas)
    lg = '<div class="legend"><span>Inglés y traducción</span><span>Se dice</span></div>' if legend else ""
    return f'{lg}<div class="phr{" small" if small else ""}">{rows}</div>'


def vocab(items):
    return '<div class="voc">' + "".join(f"<div><b>{e(en)}</b><i>{e(nb(say))}</i><span>{e(es)}</span></div>" for en, say, es in items) + "</div>"


def vocab3(items):
    return '<div class="voc num3">' + "".join(f"<div><b>{e(en)}</b><i>{e(say)}</i></div>" for en, say, es in items) + "</div>"


def oiras(titulo, intro, pares, ilus=None):
    pr = "".join(f'<div class="pair"><span class="heard">«{e(a)}»</span><span class="means">{e(b)}</span></div>' for a, b in pares)
    art = DOCTORA if ilus == "doctora" else (spot(ilus) if ilus else "")
    head = f'<div class="top"><div><h4 class="pink">{e(titulo)}</h4><p class="k">{e(intro)}</p></div>{art}</div>' if art else f'<h4 class="pink">{e(titulo)}</h4><p class="k">{e(intro)}</p>'
    return f'<div class="hear">{head}<div class="pairs">{pr}</div></div>'


def dialogo(titulo, lineas):
    out = []
    for ln in lineas:
        who, txt = ln[0], ln[1]
        me = who.lower() == "tú"
        extra = ""
        if len(ln) > 2 and ln[2]:
            extra = f"<small>{e(ln[2])}</small>" if me else f'<span class="es">{e(ln[2])}</span>'
        out.append(f'<div class="l{" me" if me else ""}"><span class="who">{e(who)}</span><span class="t">{e(txt)}{extra}</span></div>')
    return f'<div class="dlg"><h4>{e(titulo)}</h4>{"".join(out)}</div>'


def truco(en, texto, badge="Truco", pink=False):
    b = f"<b>{e(en)}</b>" if en else ""
    return f'<div class="tip{" pink" if pink else ""}"><span class="badge">{e(badge)}</span><p>{b}{e(texto)}</p></div>'


def caja(titulo, cuerpo):
    return f'<div class="box"><h4>{e(titulo)}</h4>{cuerpo}</div>'


def datos(filas):
    return '<div class="facts">' + "".join(f"<div><span>{e(a)}</span><b>{e(b)}</b></div>" for a, b in filas) + "</div>"


def lista(items):
    return '<ul class="bul">' + "".join(f"<li>{e(x)}</li>" for x in items) + "</ul>"


def audio(pista, texto="Escanea el código con el móvil y repite cada frase en voz alta, sin prisa."):
    return f'<div class="audio">{qr_svg(pista)}<p><b>Escúchalo.</b> {e(texto)}<br><code>{DOMINIO}/audio/{pista}</code></p></div>'


def locales(items):
    return '<div class="local">' + "".join(f"<div><b>{e(a)}</b><i>{e(b)}</i><span>{e(c)}</span></div>" for a, b, c in items) + "</div>"


def sonidos(items):
    return '<div class="snd">' + "".join(f"<div><b>{e(a)}</b><p>{e(b)}</p></div>" for a, b in items) + "</div>"


def checklist(items):
    return '<ul class="check">' + "".join(f"<li><span>{e(a)}<small>{e(b)}</small></span></li>" for a, b in items) + "</ul>"


def raw(h):
    return h


DOCTORA = f'''<svg viewBox="0 0 44 44" aria-hidden="true">
  <path d="M6 44 C6 34 13 30 22 30 C31 30 38 34 38 44 Z" fill="{MINT}"/><path d="M19 30.4 L22 36 L25 30.4 Z" fill="{J}"/>
  <path d="M17.5 30.8 L22 39 L26.5 30.8" stroke="{J}" stroke-width=".8" fill="none"/><rect x="19.5" y="25" width="5" height="6" fill="#C98E68"/>
  <path d="M16.2 31.2 C15 38 19.5 40.6 22.2 40.6" stroke="{INK}" stroke-width=".8" fill="none" stroke-linecap="round"/><circle cx="22.8" cy="40.6" r="1.4" fill="{INK}"/>
  <circle cx="22" cy="7.6" r="3.1" fill="#1F2A2E"/><ellipse cx="22" cy="18" rx="7.5" ry="8.5" fill="#D9A07A"/>
  <path d="M14.3 18 C14 10.5 18 8.5 22 8.5 C26 8.5 30 10.5 29.7 18 C28 13.6 25 12.6 22 12.6 C19 12.6 16 13.6 14.3 18 Z" fill="#1F2A2E"/>
  <path d="M15.6 18.6 H28.4 V23.4 C28.4 26 25.4 27.4 22 27.4 C18.6 27.4 15.6 26 15.6 23.4 Z" fill="#BFE3EF" stroke="#7FB8CC" stroke-width=".5"/>
  <path d="M16 21 H28 M16.4 23.6 H27.6" stroke="#7FB8CC" stroke-width=".4"/>
  <path d="M18 16.3 q1.2 -1.3 2.4 0 M23.6 16.3 q1.2 -1.3 2.4 0" stroke="{INK}" stroke-width=".65" fill="none" stroke-linecap="round"/>
  <rect x="30" y="1.5" width="13" height="9.5" rx="3" fill="#FBE3EB"/><path d="M33 10.6 L30.4 14.2 L36 10.8 Z" fill="#FBE3EB"/>
  <text x="36.5" y="9.2" text-anchor="middle" font-family="Bricolage Grotesque, system-ui, sans-serif" font-weight="800" font-size="7.4" fill="{H}">?</text>
</svg>'''


# ---------------------------------------------------------------- montaje
def montar(paginas, titulo_web, intro_html, notas_html):
    slots = []
    for i, pg in enumerate(paginas, start=1):
        kind, body, run = pg["kind"], pg["body"], pg.get("run")
        if kind == "raw":
            inner = body
        else:
            footer = f'<div class="run"><span>{e(run)}</span><b>{i}</b></div>' if run else ""
            cls = "in " + pg.get("cls", "")
            inner = f'<div class="page"><div class="{cls}">{body}{footer}</div></div>'
        anchor = f' id="{pg["id"]}"' if pg.get("id") else ""
        slots.append(f'<div class="slot"{anchor}>{inner}<span class="lbl">Página {i}{" | " + e(pg["lbl"]) if pg.get("lbl") else ""}</span></div>')
    return f'''<title>{e(titulo_web)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
{FUENTES}
<style>{CSS}</style>
<div class="wrap">
{intro_html}
<section class="desk" aria-label="Páginas del libro">
{"".join(slots)}
</section>
{notas_html}
</div>'''


if __name__ == "__main__":
    sys.path.insert(0, str(AQUI))
    import contenido  # noqa: E402
    salida = montar(contenido.paginas(), contenido.TITULO_WEB, contenido.INTRO, contenido.NOTAS)
    (AQUI / "libro.html").write_text(salida, encoding="utf8")
    print("libro.html:", len(contenido.paginas()), "páginas")
