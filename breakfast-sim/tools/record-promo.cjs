// Graba un clip de 5 s (30 fps, 1080×1920) de la tostada de aguacate, paso a paso.
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2], FPS = 30, N = 150, DT = 1 / FPS;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.__record = true; });
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => window.__bs, null, { timeout: 120000 });
  await p.waitForTimeout(3000); // texturas
  // interfaz fuera; un puntito marca el dedo; sello del juego al final
  await p.addStyleTag({ content: `
    #hud,#bottom,#hub,#ghost,#msg,#bubble,#holdRing,#spin{display:none!important}
    #finger{position:fixed;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
      background:rgba(255,255,255,.55);border:3px solid rgba(255,255,255,.95);box-shadow:0 4px 14px rgba(70,40,20,.35);
      pointer-events:none;opacity:0;transition:none}
    #tag{position:fixed;left:50%;bottom:86px;transform:translateX(-50%) rotate(-2deg);padding:12px 22px 8px;
      font:800 27px/1 "Baloo 2",system-ui;color:#4a2f27;background:#ffd66b;border:3px solid #4a2f27;border-radius:999px;
      box-shadow:0 5px 0 #4a2f27;opacity:0;white-space:nowrap}
    #tag small{display:block;font:700 15px/1.2 "Baloo 2",system-ui;text-align:center;margin-top:2px;color:#6b4a3a}` });
  await p.evaluate(() => {
    const f = document.createElement('div'); f.id = 'finger'; document.body.appendChild(f);
    const t = document.createElement('div'); t.id = 'tag'; t.innerHTML = '🍳 Breakfast Simulator<small>desayunos bonitos, a tu manera</small>'; document.body.appendChild(t);
  });
  await p.evaluate(() => document.fonts.ready);
  const step = (n = 1) => p.evaluate((n) => { for (let i = 0; i < n; i++) window.__bs.step(1 / 30); }, n);

  // ---- preparación (no se graba) ----
  await p.evaluate(() => {
    const bs = window.__bs, a = bs.avoPrep;
    if (a.item) { a.physics.remove(a.item); a.item = null; }
    a.state = 'peeled'; a.openT = 1;
    bs.toasterProc.state = 'skipped';
    const t = bs.sets.golden.toast;
    for (let i = 0; i < 4; i++) t.toasterHeat(0.22); // dorado clarito
    bs.selectStation(bs.STATIONS.golden.find((s) => s.id === 'toast'));
    bs.free.zoom = 0.92;
  });
  const t0 = Date.now();
  await step(75); // viaje de cámara + que todo se asiente
  console.log('preparación (s):', ((Date.now() - t0) / 1000).toFixed(1));
  await p.evaluate(() => {
    const bs = window.__bs;
    bs.knifeLoad.kind = 'avocado'; bs.knifeLoad.amount = 1;
    [...document.querySelectorAll('.chip')].find((c) => c.textContent.includes('Aguacate')).click();
  });
  await step(10);

  // ---- utilidades ----
  const toastPt = (x, y) => p.evaluate(([x, y]) => {
    const bs = window.__bs, t = bs.sets.golden.toast;
    const v = t.group.localToWorld(new (bs.camera.position.constructor)(x, t.topY, -y)).project(bs.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }, [x, y]);
  let pressed = false, fx = 270, fy = 700, fo = 0;
  const ev = (type, x, y) => p.evaluate(([type, x, y]) => {
    const el = document.querySelector('#app canvas');
    el.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerType: 'touch' }));
  }, [type, x, y]);
  const pickTool = (name) => p.evaluate((name) => [...document.querySelectorAll('.chip')].find((c) => c.textContent.includes(name)).click(), name);
  const ease = (t) => t * t * (3 - 2 * t);

  // ---- guion por fotograma ----
  // zigzag de untar: filas de izquierda a derecha y vuelta
  const rows = [0.32, 0.18, 0.04, -0.1, -0.22];
  const zig = [];
  rows.forEach((y, i) => { const a = i % 2 ? 0.46 : -0.46; zig.push([a, y], [-a, y - 0.02]); });
  const plan = [];
  for (let f = 0; f < N; f++) plan.push({});
  // 0-6: el dedo entra; 6-60: unta
  for (let f = 0; f <= 54; f++) {
    const u = (f / 54) * (zig.length - 1), k = Math.floor(u), r = u - k;
    const A = zig[Math.min(k, zig.length - 1)], B = zig[Math.min(k + 1, zig.length - 1)];
    plan[6 + f] = { tool: f === 0 ? null : undefined, act: f === 0 ? 'down' : f === 54 ? 'up' : 'move', at: [A[0] + (B[0] - A[0]) * ease(r), A[1] + (B[1] - A[1]) * ease(r)] };
  }
  plan[64] = { tool: 'Huevo' };
  plan[67] = { act: 'down', at: [-0.2, 0.08] }; plan[68] = { act: 'up', at: [-0.2, 0.08] };
  plan[79] = { act: 'down', at: [0.2, -0.06] }; plan[80] = { act: 'up', at: [0.2, -0.06] };
  plan[92] = { tool: 'Chile' };
  for (let f = 0; f <= 14; f++) plan[95 + f] = { act: f === 0 ? 'down' : f === 14 ? 'up' : 'move', at: [-0.42 + f * 0.06, 0.24 - f * 0.028 + Math.sin(f) * 0.03] };
  plan[112] = { tool: 'Sésamo' };
  for (let f = 0; f <= 12; f++) plan[114 + f] = { act: f === 0 ? 'down' : f === 12 ? 'up' : 'move', at: [0.38 - f * 0.065, -0.2 + f * 0.022] };

  for (let f = 0; f < N; f++) {
    const s = plan[f];
    if (s.tool) await pickTool(s.tool);
    if (s.act) {
      const q = await toastPt(...s.at);
      fx = q.x; fy = q.y;
      if (s.act === 'down') { pressed = true; await ev('pointerdown', fx, fy); }
      else if (s.act === 'move') await ev('pointermove', fx, fy);
      else { await ev('pointerup', fx, fy); pressed = false; }
    } else if (f < 6) {
      // el dedo aparece y se acerca al primer punto
      const q = await toastPt(...zig[0]);
      fx += (q.x - fx) * 0.35; fy += (q.y - fy) * 0.35;
    }
    fo += ((pressed ? 1 : f < 140 && f > 2 ? 0.55 : 0) - fo) * 0.35;
    // acercamiento lento de cámara durante todo el clip
    const z = 0.92 - 0.16 * ease(f / (N - 1));
    const tagO = Math.max(0, Math.min(1, (f - 126) / 8));
    const data = await p.evaluate(([z, fx, fy, fo, pr, tagO]) => {
      window.__bs.free.zoom = z;
      window.__bs.step(1 / 30);
      const src = document.querySelector('#app canvas');
      const c = window.__comp || (window.__comp = document.createElement('canvas'));
      c.width = src.width; c.height = src.height;
      const x = c.getContext('2d'), k = src.width / innerWidth;
      x.drawImage(src, 0, 0);
      // viñeta suave como en el juego
      const v = x.createRadialGradient(c.width / 2, c.height * 0.45, c.width * 0.55, c.width / 2, c.height * 0.45, c.height * 0.75);
      v.addColorStop(0, 'rgba(90,60,30,0)'); v.addColorStop(1, 'rgba(90,60,30,0.16)');
      x.fillStyle = v; x.fillRect(0, 0, c.width, c.height);
      // dedo
      if (fo > 0.01) {
        const r = 23 * k * (pr ? 0.82 : 1);
        x.save(); x.globalAlpha = fo;
        x.shadowColor = 'rgba(70,40,20,0.35)'; x.shadowBlur = 14 * k; x.shadowOffsetY = 4 * k;
        x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.arc(fx * k, fy * k, r, 0, 7); x.fill();
        x.shadowColor = 'transparent'; x.lineWidth = 3 * k; x.strokeStyle = 'rgba(255,255,255,0.95)'; x.stroke();
        x.restore();
      }
      // sello del juego al final
      if (tagO > 0.01) {
        x.save(); x.globalAlpha = tagO;
        x.translate(c.width / 2, c.height - 120 * k);
        x.rotate(-0.035); x.scale(0.8 + 0.2 * tagO, 0.8 + 0.2 * tagO);
        x.font = `800 ${27 * k}px "Baloo 2", system-ui`;
        const t1 = '🍳 Breakfast Simulator', w = x.measureText(t1).width + 44 * k, h = 74 * k;
        const rr = (yy) => { x.beginPath(); x.roundRect(-w / 2, yy - h / 2, w, h, h / 2); };
        x.fillStyle = '#4a2f27'; rr(5 * k); x.fill();
        x.fillStyle = '#ffd66b'; rr(0); x.fill();
        x.lineWidth = 3 * k; x.strokeStyle = '#4a2f27'; x.stroke();
        x.fillStyle = '#4a2f27'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(t1, 0, -9 * k);
        x.font = `700 ${15 * k}px "Baloo 2", system-ui`; x.fillStyle = '#6b4a3a';
        x.fillText('desayunos bonitos, a tu manera', 0, 19 * k);
        x.restore();
      }
      return c.toDataURL('image/png');
    }, [z, fx, fy, fo, pressed, tagO]);
    require('fs').writeFileSync(`${out}/frames/${String(f).padStart(4, '0')}.png`, Buffer.from(data.split(',')[1], 'base64'));
    if (f % 15 === 0) console.log('fotograma', f);
  }
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
