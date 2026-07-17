// Weapon: hammer — click = one smash. Registers into the global tool registry
// (this file is concatenated BEFORE the engine by scripts/sync.js).
(function () {
  'use strict';

  // Draws a hammer at 0,0 in a `size`-box, head pointing up-left (impact corner).
  // `swing` rotates it as if mid-strike.
  function drawHammer(ctx, size, swing) {
    const s = size / 32; // designed on a 32px grid
    ctx.save();
    ctx.translate(16 * s, 16 * s);
    ctx.rotate(swing ? -0.9 : -0.35);
    // handle
    ctx.fillStyle = '#8a5a2b';
    ctx.strokeStyle = '#5c3a18';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.roundRect(-2 * s, -4 * s, 4 * s, 18 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
    // head
    ctx.fillStyle = '#9aa3ab';
    ctx.strokeStyle = '#5f6870';
    ctx.beginPath();
    ctx.roundRect(-9 * s, -12 * s, 18 * s, 8 * s, 2 * s);
    ctx.fill();
    ctx.stroke();
    // head highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-8 * s, -11 * s, 16 * s, 2 * s);
    ctx.restore();
  }

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'hammer',

    icon(ctx, size) {
      drawHammer(ctx, size, false);
    },

    // Returns {idle, swung} data-URL cursors, hotspot at the hammer head (6,6).
    cursor(makeCanvas) {
      const urls = [false, true].map((swing) => {
        const c = makeCanvas(32, 32);
        drawHammer(c.getContext('2d'), 32, swing);
        return c.toDataURL();
      });
      return { idle: 'url(' + urls[0] + ') 6 6, auto', swung: 'url(' + urls[1] + ') 6 6, auto' };
    },

    // One dent: dark radial bruise + jagged radiating cracks + white glints.
    hit(ctx, x, y) {
      const rand = (a, b) => a + Math.random() * (b - a);
      const R = rand(22, 34); // dent radius
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand(0, Math.PI * 2));

      // bruise
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, 'rgba(10,10,14,0.85)');
      g.addColorStop(0.5, 'rgba(20,20,28,0.45)');
      g.addColorStop(1, 'rgba(20,20,28,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();

      // cracks: 6-10 jagged random-walk lines radiating out
      const n = 6 + (Math.random() * 5 | 0);
      for (let i = 0; i < n; i++) {
        const baseAngle = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
        const len = rand(R * 0.9, R * 2.2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        let px = 0, py = 0, a = baseAngle;
        const steps = 3 + (Math.random() * 3 | 0);
        for (let s = 1; s <= steps; s++) {
          a += rand(-0.5, 0.5);
          const d = len / steps;
          px += Math.cos(a) * d;
          py += Math.sin(a) * d;
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(15,15,20,' + rand(0.5, 0.85).toFixed(2) + ')';
        ctx.lineWidth = rand(0.8, 2.2);
        ctx.stroke();
        // glint along the first segment
        ctx.beginPath();
        ctx.moveTo(1, 1);
        ctx.lineTo(Math.cos(baseAngle) * len * 0.4 + 1, Math.sin(baseAngle) * len * 0.4 + 1);
        ctx.strokeStyle = 'rgba(255,255,255,' + rand(0.15, 0.35).toFixed(2) + ')';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      ctx.restore();
    },

    // Thunk: noise burst through a lowpass + fast-decaying low sine. Random pitch.
    sound(ac) {
      const t = ac.currentTime;
      const out = ac.createGain();
      out.gain.setValueAtTime(0.5, t);
      out.connect(ac.destination);

      // noise burst
      const len = ac.sampleRate * 0.12 | 0;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const noise = ac.createBufferSource();
      noise.buffer = buf;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300 + Math.random() * 250;
      noise.connect(lp).connect(out);
      noise.start(t);

      // body thud
      const osc = ac.createOscillator();
      const og = ac.createGain();
      osc.frequency.setValueAtTime(70 + Math.random() * 50, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      og.gain.setValueAtTime(0.8, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(og).connect(out);
      osc.start(t);
      osc.stop(t + 0.16);
    },
  });
})();

// smash engine — canvas destruction overlay. Idempotent: injecting a second
// time tears the first instance down (extension toolbar button = toggle).
// Tools register into window.__SMASH_TOOLS__ before this file runs (see scripts/sync.js).
(function () {
  'use strict';

  if (window.__SMASH__) { window.__SMASH__.quit(); return; }

  const tools = window.__SMASH_TOOLS__ || [];
  if (!tools.length) { console.warn('smash: no tools registered'); return; }
  let tool = tools[0]; // ponytail: single armed tool; toolbar picker arrives with weapon #2 (F7)

  const Z = 2147483647;
  const doc = document;

  // ---- overlay canvas (fixed to the viewport — damage sticks to the "glass") ----
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:' + Z + ';cursor:crosshair;';
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels; damage wipes on resize (fine for a toy)
  }
  resize();

  // ---- cursors ----
  const makeCanvas = (w, h) => Object.assign(doc.createElement('canvas'), { width: w, height: h });
  const cursors = tool.cursor(makeCanvas);
  canvas.style.cursor = cursors.idle;
  let swingTimer = 0;

  // ---- audio (lazy: created on first hit to satisfy autoplay policies) ----
  let ac = null;
  function thunk() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ac) ac = new AC();
    if (ac.state === 'suspended') ac.resume();
    tool.sound(ac);
  }

  // ---- controls pill ----
  const pill = doc.createElement('div');
  pill.style.cssText =
    'position:fixed;top:10px;right:10px;z-index:' + Z + ';display:flex;gap:4px;' +
    'background:rgba(20,20,28,0.75);border-radius:999px;padding:4px;' +
    'font:16px/1 system-ui,sans-serif;user-select:none;';
  function pillBtn(label, title, onClick) {
    const b = doc.createElement('button');
    b.textContent = label;
    b.title = title;
    b.style.cssText =
      'all:unset;cursor:pointer;color:#eee;width:28px;height:28px;text-align:center;' +
      'border-radius:50%;line-height:28px;';
    b.onmouseenter = () => (b.style.background = 'rgba(255,255,255,0.15)');
    b.onmouseleave = () => (b.style.background = 'none');
    b.onclick = onClick;
    pill.appendChild(b);
    return b;
  }
  // char codes, not literals: a host page's charset can't garble ASCII-only source
  pillBtn(String.fromCharCode(0x21ba), 'Reset (R)', reset);
  pillBtn(String.fromCharCode(0x2715), 'Quit (Esc)', quit);

  // ---- actions ----
  function reset() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  function quit() {
    removeEventListener('resize', resize);
    removeEventListener('keydown', onKey, true);
    canvas.remove();
    pill.remove();
    clearTimeout(swingTimer);
    if (ac) ac.close();
    delete window.__SMASH__;
    delete window.__SMASH_TOOLS__; // concat re-registers tools on next injection
    // desktop app: quitting the toy quits the app (bridge set by desktop preload)
    const d = window.__SMASH_DESKTOP__;
    if (d) d.quit ? d.quit() : window.close();
  }

  // ---- input ----
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    tool.hit(ctx, e.clientX, e.clientY);
    thunk();
    canvas.style.cursor = cursors.swung;
    clearTimeout(swingTimer);
    swingTimer = setTimeout(() => (canvas.style.cursor = cursors.idle), 100);
  });

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); quit(); }
    else if (e.key === 'r' || e.key === 'R') { e.stopPropagation(); reset(); }
  }

  addEventListener('resize', resize);
  addEventListener('keydown', onKey, true);

  doc.documentElement.appendChild(canvas);
  doc.documentElement.appendChild(pill);

  window.__SMASH__ = { quit: quit, reset: reset };
})();
