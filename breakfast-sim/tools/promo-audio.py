"""Banda sonora del vídeo promocional: lo-fi suave + sonidos ASMR sincronizados.

Uso: python3 tools/promo-audio.py <plan.json> <salida.wav>
plan.json: {"fps": 30, "duration": s, "clips": [{"start": s, "events": [...], "frames": n}, ...]}
Cada evento: {"kind": "scrape_on|scrape_off|peel_on|peel_off|pour_on|pour_off|squeeze_on|
squeeze_off|sprinkle_on|sprinkle_off|pop|plop|chime", "f": fotograma dentro del clip}
"""
import json
import sys
import wave

import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))
    return e


def lowpass(x, cutoff):
    # filtro de un polo, suficiente para "redondear" ruidos
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def bandnoise(n, lo, hi):
    w = rng.standard_normal(n)
    return lowpass(w, hi) - lowpass(w, lo)


def tone(f, n, kind='sine'):
    t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    if kind == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(ph))
    return np.sin(ph)


def add(buf, sig, t0, gain=1.0):
    i = int(t0 * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def music(dur):
    out = np.zeros((int(dur * SR) + SR, 2))
    # Fmaj7 · Em7 · Dm9 · Cmaj7 — cálido, sin tensión
    chords = [[174.61, 220, 261.63, 329.63], [164.81, 196, 246.94, 293.66], [146.83, 220, 261.63, 329.63], [130.81, 196, 246.94, 329.63]]
    bar = 2.0  # 60 bpm-ish, dos segundos por acorde
    t = 0.0
    k = 0
    while t < dur:
        ch = chords[k % 4]
        n = int((bar + 1.2) * SR)
        for i, f in enumerate(ch):
            for det, pan in ((0.997, 0.35), (1.003, 0.65)):
                s = tone(f * det, n, 'tri') * 0.022
                e = np.minimum(1, np.arange(n) / (0.35 * SR)) * np.exp(-np.arange(n) / (2.6 * SR))
                s = s * e
                add(out[:, 0], s * (1 - pan), t + i * 0.03)
                add(out[:, 1], s * pan, t + i * 0.03)
        # bajo blandito
        b = tone(ch[0] / 2, int(1.6 * SR)) * env(int(1.6 * SR), 0.02, 0.6) * 0.07
        add(out[:, 0], b, t)
        add(out[:, 1], b, t)
        # campanitas (piano de juguete) en corcheas suaves
        for j, step in enumerate([0, 0.5, 1.0, 1.5]):
            if (k + j) % 3 == 2:
                continue
            f = ch[(j * 2 + k) % 4] * 4
            m = int(0.9 * SR)
            s = (tone(f, m) + 0.3 * tone(f * 2, m)) * env(m, 0.004, 0.35) * 0.028
            pan = 0.3 + 0.4 * ((j + k) % 2)
            add(out[:, 0], s * (1 - pan), t + step)
            add(out[:, 1], s * pan, t + step)
        # "vinilo" muy suave
        t += bar
        k += 1
    crackle = np.zeros(len(out))
    idx = rng.integers(0, len(out), int(dur * 18))
    crackle[idx] = rng.uniform(-0.05, 0.05, len(idx))
    crackle = lowpass(crackle, 3000) * 0.5
    hiss = lowpass(rng.standard_normal(len(out)), 4000) * 0.0025
    out[:, 0] += crackle + hiss
    out[:, 1] += crackle + hiss
    return out


def sfx_track(plan, n):
    fps = plan['fps']
    buf = np.zeros(n)
    for clip in plan['clips']:
        t0 = clip['start']
        ev = clip['events']
        opens = {}
        for e in ev:
            t = t0 + e['f'] / fps
            k = e['kind']
            if k.endswith('_on'):
                opens[k[:-3]] = t
            elif k.endswith('_off'):
                base = k[:-4]
                if base not in opens:
                    continue
                a = opens.pop(base)
                L = max(0.05, t - a)
                m = int(L * SR)
                if base == 'scrape':  # untar: cremoso, grave, con vaivén
                    s = bandnoise(m, 180, 900) * 0.5
                    wob = 0.6 + 0.4 * np.abs(np.sin(np.arange(m) / SR * np.pi * 5.5))
                    s *= wob
                elif base == 'peel':  # despegar: rasgado suave y húmedo
                    s = bandnoise(m, 900, 3200) * 0.35 * (0.5 + 0.5 * np.linspace(0, 1, m))
                elif base == 'pour':  # leche cayendo
                    s = bandnoise(m, 300, 1600) * 0.28
                    s *= 0.8 + 0.2 * np.sin(np.arange(m) / SR * 2 * np.pi * 7)
                elif base == 'squeeze':  # exprimir: jugoso
                    s = bandnoise(m, 250, 1400) * 0.35
                    s *= 0.5 + 0.5 * np.abs(np.sin(np.arange(m) / SR * np.pi * 3))
                else:  # espolvorear
                    s = np.zeros(m)
                    for q in rng.uniform(0, L, int(L * 40)):
                        g = int(0.02 * SR)
                        add(s, bandnoise(g, 2500, 7000) * env(g, 0.001, 0.008) * 0.6, q)
                fade = np.minimum(1, np.minimum(np.arange(m), m - np.arange(m)) / (0.05 * SR))
                add(buf, s * fade, a)
            elif k in ('pop', 'plop'):
                m = int(0.25 * SR)
                tt = np.arange(m) / SR
                f = (520 if k == 'pop' else 300) * np.exp(-tt * 9) + 160
                ph = 2 * np.pi * np.cumsum(f) / SR
                add(buf, np.sin(ph) * env(m, 0.003, 0.07) * 0.5, t)
            elif k == 'chime':
                for i, f in enumerate([659.25, 830.61, 987.77, 1318.5]):
                    m = int(1.6 * SR)
                    add(buf, (tone(f, m) + 0.25 * tone(f * 3, m)) * env(m, 0.01, 0.55) * 0.09, t + i * 0.08)
    return buf


def main():
    plan = json.load(open(sys.argv[1]))
    dur = plan['duration']
    mus = music(dur)
    n = int(dur * SR)
    mus = mus[:n]
    fx = sfx_track(plan, n)
    out = mus * 1.0
    out[:, 0] += fx * 0.8
    out[:, 1] += fx * 0.8
    # entrada y salida suaves
    f = int(0.4 * SR)
    out[:f] *= np.linspace(0, 1, f)[:, None]
    out[-int(0.8 * SR):] *= np.linspace(1, 0, int(0.8 * SR))[:, None]
    out /= max(1e-6, np.abs(out).max()) / 0.85
    data = (out * 32767).astype(np.int16)
    with wave.open(sys.argv[2], 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == '__main__':
    main()
