// Graba una escena del vídeo promocional fotograma a fotograma (modo grabación).
// Uso: node tools/promo-scenes.cjs <escena> <carpeta-salida>
// Escenas: jam, peel, latte, juice, acai, final
// Deja PNG 1080×1920 en <salida>/<escena>/ y un events.json con los momentos
// (para sincronizar los sonidos).
const { chromium } = require('playwright');
const fs = require('fs');

const SCENE = process.argv[2], OUT = `${process.argv[3]}/${SCENE}`;
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:4173/';

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.__record = true; });
  await p.goto(URL);
  await p.waitForFunction(() => window.__bs, null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => document.fonts.ready);

  const step = (n = 1) => p.evaluate((n) => { for (let i = 0; i < n; i++) window.__bs.step(1 / 30); }, n);
  const go = (id) => p.evaluate((id) => window.__bs.selectStation(window.__bs.STATIONS.golden.find((s) => s.id === id)), id);
  const chip = (name) => p.evaluate((name) => [...document.querySelectorAll('.chip')].find((c) => c.textContent.includes(name)).click(), name);
  // punto del mundo (expresión JS que devuelve un Vector3) → pantalla
  const scr = (expr) => p.evaluate(`(()=>{const bs=window.__bs;const V=bs.camera.position.constructor;const v=(${expr}).clone().project(bs.camera);return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}})()`);
  const toastPt = (x, y) => scr(`(()=>{const t=bs.sets.golden.toast;return t.group.localToWorld(new V(${x},t.topY,${-y}))})()`);
  const ev = (type, q, id = 7) => p.evaluate(([type, x, y, id]) => document.querySelector('#app canvas').dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerType: 'touch' })), [type, q.x, q.y, id]);
  const tap = async (q, hold = 1) => { await ev('pointerdown', q); await step(hold); await ev('pointerup', q); };
  const ease = (t) => t * t * (3 - 2 * t);

  // ---- captura: lienzo + dedo + rótulo, todo en un mismo paso ----
  let frame = 0;
  const events = [];
  const mark = (kind, extra = {}) => events.push({ kind, f: frame, ...extra });
  const finger = { x: 270, y: 640, o: 0, pressed: false };
  let caption = null, capT = 0, logo = 0, zoom = null;
  const shot = async () => {
    const data = await p.evaluate(([f, cap, capT, logo, zoom]) => {
      const bs = window.__bs;
      if (zoom !== null) bs.free.zoom = zoom;
      bs.step(1 / 30);
      const src = document.querySelector('#app canvas');
      const c = window.__comp || (window.__comp = document.createElement('canvas'));
      c.width = 1080;
      c.height = 1920;
      const x = c.getContext('2d'), k = 1080 / innerWidth;
      x.drawImage(src, 0, 0, 1080, 1920);
      // viñeta suave
      const v = x.createRadialGradient(540, 860, 600, 540, 860, 1450);
      v.addColorStop(0, 'rgba(90,60,30,0)');
      v.addColorStop(1, 'rgba(90,60,30,0.2)');
      x.fillStyle = v;
      x.fillRect(0, 0, 1080, 1920);
      if (f.o > 0.01) {
        const r = 23 * k * (f.pressed ? 0.82 : 1);
        x.save();
        x.globalAlpha = f.o;
        x.shadowColor = 'rgba(70,40,20,0.35)';
        x.shadowBlur = 14 * k;
        x.shadowOffsetY = 4 * k;
        x.fillStyle = 'rgba(255,255,255,0.55)';
        x.beginPath();
        x.arc(f.x * k, f.y * k, r, 0, 7);
        x.fill();
        x.shadowColor = 'transparent';
        x.lineWidth = 3 * k;
        x.strokeStyle = 'rgba(255,255,255,0.95)';
        x.stroke();
        x.restore();
      }
      const pill = (text, sub, y, a, scale, rot) => {
        x.save();
        x.globalAlpha = a;
        x.translate(540, y);
        x.rotate(rot);
        x.scale(scale, scale);
        x.font = '800 58px "Baloo 2", system-ui';
        const w = x.measureText(text).width + 90, h = sub ? 150 : 112;
        const rr = (yy) => { x.beginPath(); x.roundRect(-w / 2, yy - h / 2, w, h, 56); };
        x.fillStyle = '#4a2f27'; rr(10); x.fill();
        x.fillStyle = sub ? '#ffd66b' : '#fff8ec'; rr(0); x.fill();
        x.lineWidth = 6; x.strokeStyle = '#4a2f27'; x.stroke();
        x.fillStyle = '#4a2f27'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(text, 0, sub ? -18 : 4);
        if (sub) {
          x.font = '700 32px "Baloo 2", system-ui';
          x.fillStyle = '#6b4a3a';
          x.fillText(sub, 0, 40);
        }
        x.restore();
      };
      if (cap) {
        // entra con un saltito y se queda
        const t = Math.min(1, capT / 8), pop = 1 + 0.12 * Math.sin(Math.min(1, capT / 10) * Math.PI);
        pill(cap, null, 330, t, (0.7 + 0.3 * t) * pop, -0.035);
      }
      if (logo > 0) pill('🍳 Breakfast Simulator', 'cozy breakfast game · pronto en iOS', 1560, Math.min(1, logo), 0.8 + 0.2 * Math.min(1, logo), -0.03);
      return c.toDataURL('image/png');
    }, [{ ...finger }, caption, capT, logo, zoom]);
    fs.writeFileSync(`${OUT}/${String(frame).padStart(4, '0')}.png`, Buffer.from(data.split(',')[1], 'base64'));
    frame++;
    capT++;
  };
  // mueve el "dedo" hacia un punto, suavemente
  const fingerTo = (q, k = 0.45) => { finger.x += (q.x - finger.x) * k; finger.y += (q.y - finger.y) * k; };
  const setCap = (t) => { caption = t; capT = 0; };

  // ---- preparación común ----
  await p.evaluate(() => {
    const bs = window.__bs, a = bs.avoPrep;
    if (a.item) { a.physics.remove(a.item); a.item = null; }
    bs.toasterProc.state = 'skipped';
    const t = bs.sets.golden.toast;
    for (let i = 0; i < 4; i++) t.toasterHeat(0.22);
  });

  if (SCENE === 'jam') {
    await go('toast');
    await step(70);
    zoom = 0.62;
    await p.evaluate(() => { window.__bs.free.zoom = 0.62; });
    await step(30);
    await chip('Mermelada');
    await p.evaluate(() => { const k = window.__bs.knifeLoad; k.kind = 'jam'; k.amount = 1; });
    setCap('pequeños rituales ☀️');
    const path = [];
    for (const [y, dir] of [[0.12, 1], [0.0, -1], [-0.12, 1]]) for (let i = 0; i <= 12; i++) path.push([dir > 0 ? -0.38 + i * 0.06 : 0.34 - i * 0.06, y + Math.sin(i * 0.8) * 0.012]);
    // el dedo entra
    for (let f = 0; f < 6; f++) { fingerTo(await toastPt(-0.3, 0.1)); finger.o = Math.min(0.55, finger.o + 0.12); await shot(); }
    finger.pressed = true; finger.o = 1;
    let q = await toastPt(-0.3, 0.1);
    await ev('pointerdown', q);
    mark('plop');
    for (let f = 0; f < 6; f++) { await shot(); }
    await ev('pointerup', q);
    // tres pasadas
    let i = 0;
    for (const seg of [path.slice(0, 13), path.slice(13, 26), path.slice(26)]) {
      q = await toastPt(...seg[0]);
      fingerTo(q, 1);
      await ev('pointerdown', q);
      mark('scrape_on');
      for (const pt of seg) { q = await toastPt(...pt); fingerTo(q, 1); await ev('pointermove', q); await shot(); i++; }
      await ev('pointerup', q);
      mark('scrape_off');
      finger.pressed = false;
      await shot();
      finger.pressed = true;
    }
    finger.pressed = false;
    for (let f = 0; f < 10; f++) { finger.o *= 0.6; zoom -= 0.004; await shot(); }
  }

  if (SCENE === 'peel') {
    await p.evaluate(() => {
      const a = window.__bs.avoPrep;
      a.holder.position.copy(a.homeC());
      a.holder.quaternion.identity();
      a.state = 'pitless';
      a.openT = 1;
      a.A.pit.visible = false;
      a.pose();
    });
    await go('avocado');
    for (let k = 0; k < 90; k++) { await step(1); if (await p.evaluate(() => window.__bs.avoPrep.flipT >= 1)) break; }
    await step(40);
    zoom = 0.7;
    await step(20);
    setCap('sin prisa 🥑');
    const P = (x, z) => scr(`bs.avoPrep.A.wrap.localToWorld(new V(${x}, -0.3, ${z}))`);
    for (let f = 0; f < 6; f++) { fingerTo(await P(0.12, 0.22)); finger.o = Math.min(0.55, finger.o + 0.12); await shot(); }
    // una tira larga, despacio (ancha), y luego otra
    for (const [z0, z1] of [[0.22, 0.05], [-0.2, -0.05]]) {
      let q = await P(0.12, z0);
      fingerTo(q, 1);
      finger.pressed = true; finger.o = 1;
      await ev('pointerdown', q);
      mark('peel_on');
      for (let i = 1; i <= 22; i++) {
        const t = ease(i / 22);
        q = await P(0.12 + t * 0.78, z0 + (z1 - z0) * t);
        q.y -= t * 30;
        fingerTo(q, 1);
        await ev('pointermove', q);
        await shot();
      }
      await ev('pointerup', q);
      mark('peel_off');
      finger.pressed = false;
      for (let f = 0; f < 8; f++) await shot();
    }
    for (let f = 0; f < 8; f++) { finger.o *= 0.6; await shot(); }
  }

  if (SCENE === 'latte') {
    await p.evaluate(() => {
      const c = window.__bs.coffeeProc;
      c.turns = 4; c.brew = 0.42; c.brewed = true; c.brewReady = true; c.dripLift = 1; c.foam = 0.7;
      c.milk = 0.215; c.setMix(1); c.applyLevel(); // casi llena: el dibujo sale enseguida
    });
    await go('coffee');
    for (let k = 0; k < 140; k++) { await step(1); if (await p.evaluate(() => window.__bs.station.stepIdx === 3 && window.__bs.settled())) break; }
    await step(30);
    zoom = 0.78;
    await step(30);
    setCap('tu café, tu dibujo ☕');
    // el dedo marca dónde va la jarra: justo encima del centro de la taza
    const cup = await scr(`bs.sets.golden.mug.position.clone().setY(${0.7 * 1.05 + 0.55})`);
    finger.x = cup.x; finger.y = cup.y + 40;
    for (let f = 0; f < 5; f++) { finger.o = Math.min(0.55, finger.o + 0.12); await shot(); }
    finger.pressed = true; finger.o = 1;
    let q = { x: cup.x, y: cup.y + 40 };
    await ev('pointerdown', q);
    mark('pour_on');
    // vierte meciendo la jarra y al final "corta" hacia arriba
    for (let i = 0; i < 52; i++) {
      // base del corazón: mecer en el centro; luego el "corte" hacia delante
      q = { x: cup.x + Math.sin(i * 1.1) * 7, y: cup.y - 22 + i * 0.25 };
      if (i > 42) q = { x: cup.x, y: cup.y - 12 + (i - 42) * 7 };
      fingerTo(q, 1);
      await ev('pointermove', q);
      await shot();
    }
    await ev('pointerup', q);
    mark('pour_off');
    finger.pressed = false;
    for (let f = 0; f < 14; f++) { finger.o *= 0.65; await shot(); }
  }

  if (SCENE === 'juice') {
    await go('juice');
    for (let k = 0; k < 120; k++) { await step(1); if (await p.evaluate(() => window.__bs.settled())) break; }
    await step(20);
    // (sin grabar) coger una naranja y partirla
    let q = await scr(`bs.juiceProc.fruits[0].obj.position`);
    await tap(q);
    await step(40);
    const w = await scr(`bs.juiceProc.whole.obj.position`);
    await ev('pointerdown', { x: w.x - 70, y: w.y });
    for (let i = 0; i <= 6; i++) { await ev('pointermove', { x: w.x - 70 + i * 24, y: w.y }); await step(1); }
    await ev('pointerup', { x: w.x + 74, y: w.y });
    await step(30);
    zoom = 0.62;
    await step(20);
    setCap('recién exprimido 🍊');
    const hf = await scr(`bs.juiceProc.halves[0].obj.position`);
    finger.x = hf.x; finger.y = hf.y;
    for (let f = 0; f < 5; f++) { finger.o = Math.min(0.55, finger.o + 0.12); await shot(); }
    finger.pressed = true; finger.o = 1;
    await ev('pointerdown', hf);
    mark('plop');
    for (let f = 0; f < 14; f++) await shot();
    const c = await scr(`bs.juiceProc.reamer.position.clone().add(new V(0,0.3,0))`);
    mark('squeeze_on');
    for (let i = 0; i <= 66; i++) {
      const a = i / 6;
      q = { x: c.x + Math.cos(a) * 60, y: c.y + Math.sin(a) * 60 };
      fingerTo(q, 1);
      await ev('pointermove', q);
      await shot();
      if (!(await p.evaluate(() => window.__bs.juiceProc.onReamer))) break;
    }
    await ev('pointerup', q);
    mark('squeeze_off');
    mark('chime');
    finger.pressed = false;
    for (let f = 0; f < 14; f++) { finger.o *= 0.65; await shot(); }
  }

  if (SCENE === 'acai') {
    await go('bowl');
    for (let k = 0; k < 120; k++) { await step(1); if (await p.evaluate(() => window.__bs.settled())) break; }
    // (sin grabar) servir el açaí
    await chip('Açaí');
    const bw = await scr(`bs.sets.golden.bowl.localToWorld(new V(0,0.3,0))`);
    // servir el açaí directamente (el gesto de verter no sale en cámara)
    await p.evaluate(() => {
      const y = window.__bs.sets.golden.yogurt, V2 = window.__bs.camera.position.constructor;
      const A = { c: ['#6a2c70', '#7a3582', '#5c2463'], h: '#47194d' };
      for (let i = 0; i < 200; i++) y.ribbon({ x: 0.5 + Math.sin(i / 5) * 0.2 * Math.min(1, i / 60), y: 0.5 + Math.cos(i / 6) * 0.17 * Math.min(1, i / 60) }, 1 / 30, A);
    });
    await step(40);
    zoom = 0.6;
    await step(25);
    setCap('decora a tu manera 🍓');
    const B = (x, z) => scr(`bs.sets.golden.bowl.localToWorld(new V(${x},0.33,${z}))`);
    finger.o = 0;
    const rows = [
      ['Plátano', [[-0.22, -0.2], [-0.07, -0.21], [0.08, -0.2], [0.23, -0.18]]],
      ['Fresa', [[-0.24, 0.0], [-0.08, 0.01], [0.08, 0.0], [0.24, 0.01]]],
      ['Arándanos', [[-0.2, 0.18], [-0.12, 0.2], [-0.03, 0.19], [0.06, 0.2], [0.15, 0.19], [0.23, 0.17]]],
    ];
    for (const [tool, pts] of rows) {
      await chip(tool);
      for (const [x, z] of pts) {
        const q = await B(x, z);
        for (let f = 0; f < 2; f++) { fingerTo(q, 0.7); finger.o = 0.6; await shot(); }
        finger.pressed = true; finger.o = 1;
        await ev('pointerdown', q);
        mark('pop');
        await shot();
        await ev('pointerup', q);
        finger.pressed = false;
        await shot();
      }
    }
    await chip('Coco');
    let q = await B(-0.28, 0.1);
    finger.pressed = true;
    await ev('pointerdown', q);
    mark('sprinkle_on');
    for (let i = 0; i <= 10; i++) { q = await B(-0.28 + i * 0.055, 0.1 + Math.sin(i) * 0.04); fingerTo(q, 1); await ev('pointermove', q); await shot(); }
    await ev('pointerup', q);
    mark('sprinkle_off');
    finger.pressed = false;
    for (let f = 0; f < 12; f++) { finger.o *= 0.6; await shot(); }
  }

  if (SCENE === 'final') {
    // (sin grabar) montar un desayuno bonito en la mesa
    await go('toast');
    await step(70);
    await chip('Mermelada');
    await p.evaluate(() => { const k = window.__bs.knifeLoad; k.kind = 'jam'; k.amount = 1; });
    let q = await toastPt(-0.25, 0.1);
    await tap(q, 2);
    for (const y of [0.16, 0.04, -0.08, -0.2]) {
      await p.evaluate(() => { const k = window.__bs.knifeLoad; k.kind = 'jam'; k.amount = Math.max(k.amount, 0.7); });
      q = await toastPt(-0.4, y);
      await ev('pointerdown', q);
      for (let i = 0; i <= 12; i++) { q = await toastPt(-0.4 + i * 0.065, y); await ev('pointermove', q); await step(1); }
      await ev('pointerup', q);
    }
    await chip('Fresa');
    for (const [x, y] of [[-0.18, 0.06], [0.0, 0.1], [0.18, 0.04], [0.06, -0.1]]) { await tap(await toastPt(x, y)); await step(6); }
    await chip('Menta');
    await tap(await toastPt(0.1, -0.02));
    await step(10);
    await go('bowl');
    await step(70);
    await chip('Açaí');
    const bw = await scr(`bs.sets.golden.bowl.localToWorld(new V(0,0.3,0))`);
    // servir el açaí directamente (el gesto de verter no sale en cámara)
    await p.evaluate(() => {
      const y = window.__bs.sets.golden.yogurt, V2 = window.__bs.camera.position.constructor;
      const A = { c: ['#6a2c70', '#7a3582', '#5c2463'], h: '#47194d' };
      for (let i = 0; i < 200; i++) y.ribbon({ x: 0.5 + Math.sin(i / 5) * 0.2 * Math.min(1, i / 60), y: 0.5 + Math.cos(i / 6) * 0.17 * Math.min(1, i / 60) }, 1 / 30, A);
    });
    await step(20);
    const B = (x, z) => scr(`bs.sets.golden.bowl.localToWorld(new V(${x},0.33,${z}))`);
    await chip('Plátano');
    for (const x of [-0.2, -0.05, 0.1, 0.24]) { await tap(await B(x, -0.18)); await step(3); }
    await chip('Arándanos');
    for (const x of [-0.18, -0.08, 0.02, 0.12, 0.22]) { await tap(await B(x, 0.16)); await step(3); }
    await p.evaluate(() => {
      const bs = window.__bs, gl = bs.juiceTip;
      gl.level = 0.88; gl.empty = false;
      bs.juiceProc.applyLevel();
      const c = bs.coffeeProc;
      c.brew = 0.42; c.brewed = true; c.dripLift = 1; c.milk = 0.4; c.setMix(1); c.applyLevel();
    });
    await go('table');
    for (let k = 0; k < 120; k++) { await step(1); if (await p.evaluate(() => window.__bs.settled())) break; }
    await step(20);
    // plano final: acercamiento lento + nombre del juego
    zoom = 1.08;
    for (let f = 0; f < 84; f++) {
      zoom = 1.08 - 0.2 * ease(f / 83);
      logo = Math.max(0, (f - 30) / 12);
      if (f === 30) mark('chime');
      await shot();
    }
  }

  fs.writeFileSync(`${OUT}/events.json`, JSON.stringify({ frames: frame, events }, null, 1));
  console.log(SCENE, 'fotogramas:', frame, errs.length ? 'ERRORES: ' + errs.join(' | ') : 'sin errores');
  await b.close();
})();
