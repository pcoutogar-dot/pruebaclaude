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
    this.noise = buf;
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
      o.connect(g).connect(ctx.destination);
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
    o.connect(g).connect(ctx.destination);
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
    n.connect(hp).connect(g).connect(ctx.destination);
    n.start(t);
    n.stop(t + 0.4);
    [2637, 3520, 4186, 3136, 4699].forEach((f, i) => {
      const o = ctx.createOscillator(), og = ctx.createGain(), tt = t + 0.03 + i * 0.045 + Math.random() * 0.03;
      o.frequency.value = f * (0.95 + Math.random() * 0.1);
      og.gain.setValueAtTime(0.05, tt);
      og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.25);
      o.connect(og).connect(ctx.destination);
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
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.2);
  }
}
