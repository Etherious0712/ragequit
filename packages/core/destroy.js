// ragequit engine — canvas destruction overlay. Idempotent: injecting a second
// time tears the first instance down (extension toolbar button = toggle).
// Tools register into window.__SMASH_TOOLS__ before this file runs (see scripts/sync.js).
(function () {
  'use strict';

  if (window.__SMASH__) { window.__SMASH__.quit(); return; }

  const tools = window.__SMASH_TOOLS__ || [];
  if (!tools.length) { console.warn('ragequit: no tools registered'); return; }

  const Z = 2147483647;
  const doc = document;

  // ---- overlay canvas (fixed to the viewport — damage sticks to the "glass") ----
  // plus an fx canvas above it: cleared every frame, for transient animation
  // (casings, particles) driven by tools' optional frame(fxCtx, dt, w, h).
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:' + Z + ';';
  const ctx = canvas.getContext('2d');
  const fx = doc.createElement('canvas');
  fx.style.cssText = 'position:fixed;inset:0;z-index:' + Z + ';pointer-events:none;';
  const fxCtx = fx.getContext('2d');

  function sizeCanvas(c, c2d) {
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    c.style.width = innerWidth + 'px';
    c.style.height = innerHeight + 'px';
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  }
  function resize() {
    sizeCanvas(canvas, ctx); // damage wipes on resize (fine for a toy)
    sizeCanvas(fx, fxCtx);
  }
  resize();

  // ---- fx loop: runs only while some tool still has live particles ----
  let fxRunning = false;
  let fxLast = 0;
  function fxTick(t) {
    const dt = Math.min((t - fxLast) / 1000, 0.05);
    fxLast = t;
    fxCtx.clearRect(0, 0, innerWidth, innerHeight);
    let live = false;
    for (const tl of tools) if (tl.frame && tl.frame(fxCtx, dt, innerWidth, innerHeight)) live = true;
    if (live && fxRunning) requestAnimationFrame(fxTick);
    else { fxRunning = false; fxCtx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function startFx() {
    if (fxRunning) return;
    fxRunning = true;
    fxLast = performance.now();
    requestAnimationFrame(fxTick);
  }

  // ---- audio (lazy: created on first hit to satisfy autoplay policies) ----
  let ac = null;
  let master = null; // shared compressor: rapid clicks stack without clipping
  function playSound() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ac) {
      ac = new AC();
      master = ac.createDynamicsCompressor();
      master.threshold.value = -14;
      master.ratio.value = 12;
      master.attack.value = 0.003;
      master.release.value = 0.15;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    tool.sound(ac, master);
  }

  // ---- weapon arming ----
  const makeCanvas = (w, h) => Object.assign(doc.createElement('canvas'), { width: w, height: h });
  let tool = null;
  let cursors = null;
  let swingTimer = 0;
  const weaponBtns = [];

  function arm(i) {
    if (!tools[i]) return;
    stopAuto(); // switching weapons mid-burst stops the burst
    tool = tools[i];
    cursors = tool.cursor(makeCanvas);
    canvas.style.cursor = cursors.idle;
    weaponBtns.forEach((b, j) => (b.style.background = j === i ? 'rgba(255,255,255,0.25)' : 'none'));
  }

  // ---- toolbar: auto-hiding left strip (weapons on top, reset/quit below) ----
  const bar = doc.createElement('div');
  bar.style.cssText =
    'position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:' + Z + ';' +
    'display:flex;flex-direction:column;align-items:center;gap:4px;' +
    'background:rgba(20,20,28,0.8);padding:8px 5px;border-radius:0 12px 12px 0;' +
    'transition:margin-left .15s ease;font:15px/1 system-ui,sans-serif;user-select:none;';

  function barBtn(content, title, onClick) {
    const b = doc.createElement('button');
    if (typeof content === 'string') b.textContent = content;
    else b.appendChild(content);
    b.title = title;
    b.style.cssText =
      'all:unset;cursor:pointer;color:#eee;width:30px;height:30px;border-radius:8px;' +
      'display:flex;align-items:center;justify-content:center;';
    b.onclick = onClick;
    bar.appendChild(b);
    return b;
  }

  tools.forEach((t, i) => {
    const icon = makeCanvas(24, 24);
    t.icon(icon.getContext('2d'), 24);
    weaponBtns.push(barBtn(icon, t.name + ' (' + (i + 1) + ')', () => arm(i)));
  });

  const divider = doc.createElement('div');
  divider.style.cssText = 'width:22px;height:1px;background:rgba(255,255,255,0.25);margin:3px 0;';
  bar.appendChild(divider);
  barBtn(String.fromCharCode(0x21ba), 'Reset (R)', reset);
  barBtn(String.fromCharCode(0x2715), 'Quit (Esc)', quit);

  // auto-hide: collapse to a 6px sliver, peek out on hover
  const collapse = () => (bar.style.marginLeft = 6 - bar.offsetWidth + 'px');
  bar.onmouseenter = () => (bar.style.marginLeft = '0px');
  bar.onmouseleave = collapse;

  // ---- actions ----
  function reset() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    tools.forEach((t) => t.reset && t.reset());
  }

  function quit() {
    removeEventListener('resize', resize);
    removeEventListener('keydown', onKey, true);
    removeEventListener('mouseup', stopAuto);
    removeEventListener('blur', stopAuto);
    stopAuto();
    fxRunning = false;
    canvas.remove();
    fx.remove();
    bar.remove();
    clearTimeout(swingTimer);
    if (ac) ac.close();
    tools.forEach((t) => t.reset && t.reset());
    delete window.__SMASH__;
    delete window.__SMASH_TOOLS__; // concat re-registers tools on next injection
    // desktop app: quitting the toy quits the app (bridge set by desktop preload)
    const d = window.__SMASH_DESKTOP__;
    if (d) d.quit ? d.quit() : window.close();
  }

  // ---- input ----
  let mx = 0, my = 0;      // tracked cursor for auto-fire follow
  let autoTimer = 0;       // interval id while holding an auto weapon

  function fireOnce(x, y) {
    tool.hit(ctx, x, y);
    playSound();
    if (tool.frame) startFx();
  }

  function stopAuto() {
    if (!autoTimer) return;
    clearInterval(autoTimer);
    autoTimer = 0;
    if (cursors) canvas.style.cursor = cursors.idle;
  }

  canvas.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    mx = e.clientX; my = e.clientY;
    fireOnce(mx, my);
    canvas.style.cursor = cursors.swung;
    if (tool.auto) {
      // hold = keep firing at the cursor until release
      autoTimer = setInterval(() => fireOnce(mx, my), tool.auto);
    } else {
      clearTimeout(swingTimer);
      swingTimer = setTimeout(() => (canvas.style.cursor = cursors.idle), 100);
    }
  });

  addEventListener('mouseup', stopAuto);
  addEventListener('blur', stopAuto);

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); quit(); }
    else if (e.key === 'r' || e.key === 'R') { e.stopPropagation(); reset(); }
    else if (e.key >= '1' && e.key <= '9') { e.stopPropagation(); arm(+e.key - 1); }
  }

  addEventListener('resize', resize);
  addEventListener('keydown', onKey, true);

  doc.documentElement.appendChild(canvas);
  doc.documentElement.appendChild(fx);
  doc.documentElement.appendChild(bar);
  arm(0);
  collapse();

  window.__SMASH__ = { quit: quit, reset: reset };
})();
