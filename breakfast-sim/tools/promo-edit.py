"""Monta el vídeo promocional editado a partir de las escenas grabadas.

Uso: python3 tools/promo-edit.py <carpeta-escenas> <salida.mp4>
Une jam → peel → latte → juice → acai → final con fundidos cortos,
genera la banda sonora sincronizada (tools/promo-audio.py) y codifica
en 1080×1920, 30 fps, H.264 + AAC, listo para Reels.
"""
import json
import os
import subprocess
import sys

ORDER = ['jam', 'peel', 'latte', 'juice', 'acai', 'final']
FPS = 30
X = 8  # fotogramas de fundido entre planos

src, out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))

clips, start = [], 0.0
for i, sc in enumerate(ORDER):
    ev = json.load(open(f'{src}/{sc}/events.json'))
    n = ev['frames']
    clips.append({'scene': sc, 'start': start, 'frames': n, 'events': ev['events']})
    start += (n - X) / FPS
dur = start + X / FPS

plan = {'fps': FPS, 'duration': dur, 'clips': clips}
json.dump(plan, open(f'{src}/plan.json', 'w'), indent=1)
subprocess.run([sys.executable, f'{here}/promo-audio.py', f'{src}/plan.json', f'{src}/audio.wav'], check=True)

args = ['ffmpeg', '-y', '-loglevel', 'error']
for c in clips:
    args += ['-framerate', str(FPS), '-i', f"{src}/{c['scene']}/%04d.png"]
args += ['-i', f'{src}/audio.wav']

# cadena de fundidos: cada plano entra suavemente sobre el anterior
fl, prev, acc = [], '[0:v]', clips[0]['frames'] / FPS
for i in range(1, len(clips)):
    off = acc - X / FPS
    lab = f'[v{i}]'
    fl.append(f'{prev}[{i}:v]xfade=transition=fade:duration={X / FPS:.4f}:offset={off:.4f}{lab}')
    prev = lab
    acc = off + clips[i]['frames'] / FPS
fl.append(f'{prev}format=yuv420p[vout]')
args += ['-filter_complex', ';'.join(fl), '-map', '[vout]', '-map', f'{len(clips)}:a',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-r', str(FPS),
         '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]
subprocess.run(args, check=True)
print(f'{out}: {dur:.2f} s')
