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

  // ---- screen shake: jolts both canvases via CSS transform, eased decay.
  // Exposed on the public API so weapons (dynamite) trigger it without
  // reaching into engine-owned DOM. Works identically in extension & desktop.
  let shakeStart = 0, shakeEnd = 0, shakeMag = 0, shakeRAF = 0;
  function shakeStep() {
    const now = performance.now();
    if (now >= shakeEnd) {
      canvas.style.transform = fx.style.transform = '';
      shakeRAF = 0;
      return;
    }
    const k = 1 - (now - shakeStart) / (shakeEnd - shakeStart); // 1 → 0
    const m = shakeMag * k * k;
    const t = 'translate(' + ((Math.random() * 2 - 1) * m).toFixed(1) + 'px,' +
              ((Math.random() * 2 - 1) * m).toFixed(1) + 'px)';
    canvas.style.transform = fx.style.transform = t;
    shakeRAF = requestAnimationFrame(shakeStep);
  }
  function shake(mag, dur) {
    shakeStart = performance.now();
    shakeEnd = shakeStart + dur;
    shakeMag = mag;
    if (!shakeRAF) shakeRAF = requestAnimationFrame(shakeStep);
  }

  // ---- audio (lazy: created on first hit to satisfy autoplay policies) ----
  // graph: tools → master (compressor) → masterGain (volume/mute) → destination
  let ac = null;
  let master = null;     // shared compressor: rapid clicks stack without clipping
  let masterGain = null; // volume + mute gate, after the compressor
  let loopStop = null;   // stop function of the active soundLoop, if any

  // persisted audio prefs (namespaced; per-origin in the extension — fine for a toy)
  let volume = 0.8, muted = false;
  try {
    const v = localStorage.getItem('ragequit.vol');
    if (v !== null) volume = Math.max(0, Math.min(1, parseFloat(v) || 0));
    muted = localStorage.getItem('ragequit.mute') === '1';
  } catch (e) {}
  function applyVolume() {
    if (masterGain) masterGain.gain.value = muted ? 0 : volume;
  }
  function persistAudio() {
    try {
      localStorage.setItem('ragequit.vol', String(volume));
      localStorage.setItem('ragequit.mute', muted ? '1' : '0');
    } catch (e) {}
  }

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) {
      ac = new AC();
      master = ac.createDynamicsCompressor();
      master.threshold.value = -14;
      master.ratio.value = 12;
      master.attack.value = 0.003;
      master.release.value = 0.15;
      masterGain = ac.createGain();
      master.connect(masterGain);
      masterGain.connect(ac.destination);
      applyVolume();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function playSound() {
    if (ensureAudio()) tool.sound(ac, master);
  }
  function startLoop() {
    if (!loopStop && tool.soundLoop && ensureAudio()) loopStop = tool.soundLoop(ac, master);
  }
  function stopLoop() {
    if (loopStop) { loopStop(); loopStop = null; }
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

  // speaker glyph: cone + waves (louder = more waves), or a red X when muted
  function drawSpeakerGlyph(g, size, level) {
    const s = size / 24;
    g.clearRect(0, 0, size, size);
    g.fillStyle = '#eee';
    g.beginPath();
    g.moveTo(3 * s, 9 * s); g.lineTo(7 * s, 9 * s); g.lineTo(11 * s, 5 * s);
    g.lineTo(11 * s, 19 * s); g.lineTo(7 * s, 15 * s); g.lineTo(3 * s, 15 * s);
    g.closePath();
    g.fill();
    g.lineCap = 'round';
    if (level <= 0) {
      g.strokeStyle = '#ff6a5a';
      g.lineWidth = 1.8 * s;
      g.beginPath();
      g.moveTo(15 * s, 9 * s); g.lineTo(21 * s, 15 * s);
      g.moveTo(21 * s, 9 * s); g.lineTo(15 * s, 15 * s);
      g.stroke();
    } else {
      g.strokeStyle = '#eee';
      g.lineWidth = 1.5 * s;
      g.beginPath(); g.arc(13 * s, 12 * s, 3 * s, -0.6, 0.6); g.stroke();
      if (level > 0.5) { g.beginPath(); g.arc(13 * s, 12 * s, 6 * s, -0.6, 0.6); g.stroke(); }
    }
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

  // audio: speaker = mute toggle; volume slider pops out to the right on hover
  const spkCanvas = makeCanvas(24, 24);
  const spkCtx = spkCanvas.getContext('2d');
  const drawSpeaker = () => drawSpeakerGlyph(spkCtx, 24, muted ? 0 : volume);

  const audioWrap = doc.createElement('div');
  audioWrap.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;width:30px;height:30px;';
  const spkBtn = doc.createElement('button');
  spkBtn.appendChild(spkCanvas);
  spkBtn.title = 'Mute (click) / volume (hover)';
  spkBtn.style.cssText = 'all:unset;cursor:pointer;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;';
  spkBtn.onclick = () => { muted = !muted; applyVolume(); persistAudio(); drawSpeaker(); };

  const sliderBox = doc.createElement('div');
  sliderBox.style.cssText =
    'position:absolute;left:30px;top:0;height:30px;display:flex;align-items:center;padding:0 6px;' +
    'background:rgba(20,20,28,0.92);border-radius:0 8px 8px 0;opacity:0;visibility:hidden;transition:opacity .12s ease;';
  const slider = doc.createElement('input');
  slider.type = 'range';
  slider.min = '0'; slider.max = '1'; slider.step = '0.01';
  slider.value = String(volume);
  slider.style.cssText = 'width:72px;accent-color:#e0472f;cursor:pointer;';
  slider.oninput = () => {
    volume = parseFloat(slider.value);
    if (volume > 0) muted = false; // dragging up unmutes
    applyVolume(); persistAudio(); drawSpeaker();
  };
  sliderBox.appendChild(slider);
  audioWrap.appendChild(spkBtn);
  audioWrap.appendChild(sliderBox);
  audioWrap.onmouseenter = () => { sliderBox.style.opacity = '1'; sliderBox.style.visibility = 'visible'; };
  audioWrap.onmouseleave = () => { sliderBox.style.opacity = '0'; sliderBox.style.visibility = 'hidden'; };
  bar.appendChild(audioWrap);
  drawSpeaker();

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
    if (shakeRAF) cancelAnimationFrame(shakeRAF);
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
    if (tool.soundLoop) startLoop(); // looping weapons roar continuously instead of per-hit
    else playSound();
    if (tool.frame) startFx();
  }

  function stopAuto() {
    stopLoop();
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
    else if (e.key === '0') { e.stopPropagation(); arm(9); } // 0 = 10th weapon
  }

  addEventListener('resize', resize);
  addEventListener('keydown', onKey, true);

  doc.documentElement.appendChild(canvas);
  doc.documentElement.appendChild(fx);
  doc.documentElement.appendChild(bar);
  arm(0);
  collapse();

  window.__SMASH__ = { quit: quit, reset: reset, shake: shake };
})();
