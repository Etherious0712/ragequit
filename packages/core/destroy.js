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
