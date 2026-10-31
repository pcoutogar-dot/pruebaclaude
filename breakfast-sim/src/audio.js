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
    src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = 1400;
    this.filter.Q.value = 0.8;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    src.connect(this.filter).connect(this.gain).connect(ctx.destination);
    src.start();
  }

  scrape(speed) {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(Math.min(0.22, speed * 5), now, 0.04);
    this.filter.frequency.setTargetAtTime(900 + Math.min(speed, 0.1) * 30000, now, 0.06);
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
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1.5);
    });
  }

  plop() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.2);
  }
}
