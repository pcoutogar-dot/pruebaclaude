// Sonido sintetizado (sin archivos): el "rasss" de untar y un "ding" suave al terminar.
// El sonido es medio juego en un cozy game: aquí solo es un esbozo.
export class Sfx {
  constructor() {
    this.on = true;
    this.ctx = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = (this.ctx = new C());
    // bus de salida: compresor suave + un poco de reverberación de habitación
    // (todo suena más redondo y cálido, nada pincha)
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(comp);
    const rev = ctx.createConvolver(), irLen = ctx.sampleRate * 1.4;
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    rev.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    this.out.connect(rev).connect(wet).connect(comp);
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.04 * w) / 1.04;
      d[i] = last * 3 + w * 0.15;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    this.noise = buf;
    src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = 1400;
    this.filter.Q.value = 0.8;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    src.connect(this.filter).connect(this.gain).connect(this.out);
    src.start();
  }

  // rascado: "creamy" (untar) suena grave y aterciopelado; normal, más agudo
  scrape(speed, creamy = false) {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    this.filter.type = creamy ? 'lowpass' : 'bandpass';
    this.gain.gain.setTargetAtTime(Math.min(creamy ? 0.3 : 0.2, speed * (creamy ? 7 : 5)), now, 0.05);
    this.filter.frequency.setTargetAtTime(creamy ? 420 + Math.min(speed, 0.1) * 5000 : 900 + Math.min(speed, 0.1) * 30000, now, 0.06);
  }

  // crujido de pan tostado: chasquidos cortos y secos
  crunch(vol = 1) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.012 + Math.random() * 0.025);
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.noise;
      f.type = 'bandpass';
      f.frequency.value = 2200 + Math.random() * 2800;
      f.Q.value = 1.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.35 * vol, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.03);
      src.connect(f).connect(g).connect(this.out);
      src.start(t, Math.random() * 1.5);
      src.stop(t + 0.07);
    }
  }

  // golpecito según el material: madera "tok", cerámica "tin", cristal "tiiin",
  // fruta "pat" (sordo), blando "puf"
  tap(mat = 'soft', vol = 1) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const P = {
      wood: [[620, 0.12, 0.06], [1240, 0.03, 0.03]],
      ceramic: [[1180, 0.07, 0.25], [2950, 0.025, 0.18], [4100, 0.012, 0.12]],
      glass: [[2100, 0.05, 0.4], [3300, 0.03, 0.3], [5200, 0.015, 0.2]],
      fruit: [[170, 0.16, 0.09], [260, 0.05, 0.06]],
      soft: [[300, 0.08, 0.07]],
    }[mat] || [[300, 0.08, 0.07]];
    const det = 0.94 + Math.random() * 0.12;
    for (const [f, g0, dec] of P) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * det * (mat === 'fruit' || mat === 'soft' ? 1.4 : 1), t);
      o.frequency.exponentialRampToValueAtTime(f * det, t + 0.03);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(g0 * vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
    // un poco de "cuerpo" de ruido en lo blando y la fruta
    if (mat === 'fruit' || mat === 'soft') {
      const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.noise;
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      g.gain.setValueAtTime(0.25 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(lp).connect(g).connect(this.out);
      src.start(t, Math.random());
      src.stop(t + 0.08);
    }
  }

  // ---- ambiente: acordes lo-fi muy suaves y algún pajarito por la ventana ----
  ambient(on, birds = true) {
    if (!this.ctx) return;
    this.birds = birds;
    if (!this.amb) {
      const ctx = this.ctx;
      this.amb = ctx.createGain();
      this.amb.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1100;
      this.amb.connect(lp).connect(this.out);
      this.ambLp = lp;
      this.chord = 0;
      this.nextChord = 0;
      this.nextBird = ctx.currentTime + 6;
      this.ambTimer = setInterval(() => this.ambientTick(), 250);
    }
    const want = on && this.on ? 1 : 0;
    this.amb.gain.setTargetAtTime(want, this.ctx.currentTime, 1.2);
    this.ambOn = !!want;
  }

  ambientTick() {
    if (!this.ambOn || !this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    // Fmaj7 → Em7 → Dm9 → Cmaj7: cálido y sin tensión
    const CH = [
      [174.61, 220, 261.63, 329.63],
      [164.81, 196, 246.94, 293.66],
      [146.83, 220, 261.63, 329.63],
      [130.81, 196, 246.94, 329.63],
    ];
    if (t >= this.nextChord) {
      const notes = CH[this.chord++ % CH.length], dur = 7.5;
      this.nextChord = t + dur - 1.5;
      notes.forEach((f, i) => {
        for (const det of [-4, 4]) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          o.detune.value = det + (Math.random() - 0.5) * 3;
          const st = t + i * 0.12;
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.012, st + 2.2);
          g.gain.setValueAtTime(0.012, st + dur - 2.5);
          g.gain.linearRampToValueAtTime(0.0001, st + dur);
          o.connect(g).connect(this.amb);
          o.start(st);
          o.stop(st + dur + 0.1);
        }
      });
      // una notita de piano arriba, de vez en cuando
      if (Math.random() < 0.6) {
        const f = notes[(Math.random() * 4) | 0] * 4;
        const o = ctx.createOscillator(), g = ctx.createGain(), st = t + 1 + Math.random() * 3;
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.linearRampToValueAtTime(0.018, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 2.4);
        o.connect(g).connect(this.amb);
        o.start(st);
        o.stop(st + 2.5);
      }
    }
    if (this.birds && t >= this.nextBird) {
      this.nextBird = t + 7 + Math.random() * 12;
      const base = 2600 + Math.random() * 1400, n = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), st = t + i * 0.13;
        o.frequency.setValueAtTime(base, st);
        o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), st + 0.05);
        o.frequency.exponentialRampToValueAtTime(base * 0.9, st + 0.09);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.linearRampToValueAtTime(0.012, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.1);
        o.connect(g).connect(this.amb);
        o.start(st);
        o.stop(st + 0.12);
      }
    }
  }

  // chisporroteo al tostar
  sizzle(on) {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(on ? 0.05 + Math.random() * 0.05 : 0, now, 0.02);
    this.filter.frequency.setTargetAtTime(4200, now, 0.05);
  }

  stop() {
    if (!this.ctx) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
  }

  chime() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const t = t0 + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 1.5);
    });
  }

  // notitas de marimba: cada cosa que colocas sube un escalón de la escala
  note(i = 0, vol = 1) {
    if (!this.ctx || !this.on) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
    const f = scale[i % scale.length] * (i >= scale.length ? 2 : 1);
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [mult, g0, dec] of [[1, 0.09, 0.45], [4, 0.02, 0.12]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(g0 * vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }

  // "boing" blandito al tocar algo
  boing(pitch = 1) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(260 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(420 * pitch, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(300 * pitch, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.3);
  }

  // cristal roto: golpe de ruido agudo + tintineos
  crash() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = this.noise;
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(hp).connect(g).connect(this.out);
    n.start(t);
    n.stop(t + 0.4);
    [2637, 3520, 4186, 3136, 4699].forEach((f, i) => {
      const o = ctx.createOscillator(), og = ctx.createGain(), tt = t + 0.03 + i * 0.045 + Math.random() * 0.03;
      o.frequency.value = f * (0.95 + Math.random() * 0.1);
      og.gain.setValueAtTime(0.05, tt);
      og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.25);
      o.connect(og).connect(this.out);
      o.start(tt);
      o.stop(tt + 0.3);
    });
  }

  plop(vol = 1, pitch = 1) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(420 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(140 * pitch, t + 0.12);
    g.gain.setValueAtTime(0.12 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.2);
  }
}
