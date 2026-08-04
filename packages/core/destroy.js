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
  // The guts canvas sits UNDER the damage layer: hardware (LCD, backlight, PCB,
  // chassis) is painted into it only where a weapon breaches, so holes in the
  // damage art reveal the innards instead of a flat black core.
  // Stack, bottom → top: page/screenshot → guts → damage → fx.
  const guts = doc.createElement('canvas');
  guts.style.cssText = 'position:fixed;inset:0;z-index:' + Z + ';pointer-events:none;';
  const gutsCtx = guts.getContext('2d');
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:' + Z + ';';
  const ctx = canvas.getContext('2d');
  const fx = doc.createElement('canvas');
  fx.style.cssText = 'position:fixed;inset:0;z-index:' + Z + ';pointer-events:none;';
  const fxCtx = fx.getContext('2d');

  // Viewport can read 0 if we're injected into a hidden/throttled/oddly-embedded
  // page; fall back so the canvases are never born 0x0 (they'd stay blank forever).
  const vw = () => innerWidth || doc.documentElement.clientWidth || 1280;
  const vh = () => innerHeight || doc.documentElement.clientHeight || 800;

  function sizeCanvas(c, c2d) {
    const dpr = window.devicePixelRatio || 1;
    const w = vw(), h = vh();
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  }

  // ---- depth grid: how deep each cell has been chewed (0 = pristine glass) ----
  // 16px cells: small enough that narrow weapons (bullets, laser) still register
  // on the cell they actually hit. ~8k floats at 1080p — nothing.
  const CELL = 16;
  let depth = null, gw = 0, gh = 0;
  function sizeDepth() {
    gw = Math.ceil(vw() / CELL) + 1;
    gh = Math.ceil(vh() / CELL) + 1;
    depth = new Float32Array(gw * gh);
  }
  function depthAt(x, y) {
    const i = (Math.floor(y / CELL) * gw + Math.floor(x / CELL));
    return depth && i >= 0 && i < depth.length ? depth[i] : 0;
  }
  // Raise depth over a disc, returning the deepest value reached.
  function addDepth(x, y, radius, amount) {
    if (!depth) return 0;
    let deepest = 0;
    // The cell you actually hit always takes the full bite, even if its centre
    // falls outside a narrow breach radius — otherwise pinpoint weapons could
    // pound one spot forever without ever digging.
    const hi = Math.floor(y / CELL) * gw + Math.floor(x / CELL);
    if (hi >= 0 && hi < depth.length) {
      depth[hi] = Math.min(5, depth[hi] + amount);
      deepest = depth[hi];
    }
    const c0 = Math.max(0, Math.floor((x - radius) / CELL));
    const c1 = Math.min(gw - 1, Math.floor((x + radius) / CELL));
    const r0 = Math.max(0, Math.floor((y - radius) / CELL));
    const r1 = Math.min(gh - 1, Math.floor((y + radius) / CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * gw + c;
        if (i === hi) continue; // already took the full bite above
        const dx = (c + 0.5) * CELL - x, dy = (r + 0.5) * CELL - y;
        const d = Math.hypot(dx, dy);
        if (d > radius) continue;
        // full bite at the centre, tapering to nothing at the rim
        depth[i] = Math.min(5, depth[i] + amount * (1 - d / radius));
        if (depth[i] > deepest) deepest = depth[i];
      }
    }
    return deepest;
  }

  function resize() {
    sizeCanvas(guts, gutsCtx); // damage wipes on resize (fine for a toy)
    sizeCanvas(canvas, ctx);
    sizeCanvas(fx, fxCtx);
    sizeDepth();
    // the strata art is gone with the pixels — drop the remembered breaches too,
    // or flicker/glitch would keep firing at coordinates that no longer have holes
    if (window.__SMASH_GUTS__) window.__SMASH_GUTS__.reset();
  }
  resize();

  // ---- fx loop: runs only while some tool still has live particles ----
  let fxRunning = false;
  let fxLast = 0;
  function fxTick(t) {
    const dt = Math.min((t - fxLast) / 1000, 0.05);
    fxLast = t;
    fxCtx.clearRect(0, 0, vw(), vh());
    let live = false;
    for (const tl of tools) if (tl.frame && tl.frame(fxCtx, dt, vw(), vh())) live = true;
    // guts animation (sparks, falling shards, dangling cables, flicker) shares the loop
    const g = window.__SMASH_GUTS__;
    if (g && g.frame(fxCtx, gutsCtx, dt, vw(), vh())) live = true;
    if (live && fxRunning) requestAnimationFrame(fxTick);
    else { fxRunning = false; fxCtx.clearRect(0, 0, vw(), vh()); }
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
      canvas.style.transform = fx.style.transform = guts.style.transform = '';
      shakeRAF = 0;
      return;
    }
    const k = 1 - (now - shakeStart) / (shakeEnd - shakeStart); // 1 → 0
    const m = shakeMag * k * k;
    const t = 'translate(' + ((Math.random() * 2 - 1) * m).toFixed(1) + 'px,' +
              ((Math.random() * 2 - 1) * m).toFixed(1) + 'px)';
    canvas.style.transform = fx.style.transform = guts.style.transform = t;
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

  // camera glyph for the save button
  function drawCameraGlyph(g, size) {
    const s = size / 24;
    g.clearRect(0, 0, size, size);
    g.fillStyle = '#eee';
    g.beginPath();
    g.roundRect(3 * s, 8 * s, 18 * s, 12 * s, 2 * s);
    g.fill();
    g.fillRect(8.5 * s, 5.5 * s, 5 * s, 3 * s); // top bump
    g.fillStyle = '#1a1a20';
    g.beginPath();
    g.arc(12 * s, 14 * s, 4 * s, 0, Math.PI * 2); // lens
    g.fill();
    g.fillStyle = '#7db4ff';
    g.beginPath();
    g.arc(12 * s, 14 * s, 2.1 * s, 0, Math.PI * 2); // lens glint
    g.fill();
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
  const camIcon = makeCanvas(24, 24);
  drawCameraGlyph(camIcon.getContext('2d'), 24);
  barBtn(camIcon, 'Save a screenshot', save);
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
    ctx.clearRect(0, 0, vw(), vh());
    gutsCtx.clearRect(0, 0, vw(), vh());
    if (depth) depth.fill(0); // screen is pristine glass again
    if (window.__SMASH_GUTS__) window.__SMASH_GUTS__.reset();
    tools.forEach((t) => t.reset && t.reset());
  }

  // Save the carnage: composite the backdrop (from the host, if any) + the
  // persistent damage canvas into one PNG, and offer it in a preview modal.
  // Host contract: window.__SMASH_HOST__.capture() → Promise<dataURL|null>,
  // returning the clean backdrop WITHOUT our overlays (desktop = the frozen
  // screenshot; extension = captureVisibleTab of the page). UI is excluded by
  // hiding our canvases/toolbar while the host captures.
  let saving = false;
  let previewDim = null; // the open save-preview modal, if any (tracked so Esc/quit handle it)
  async function save() {
    if (saving) return;
    saving = true;
    try {
      const host = window.__SMASH_HOST__;
      let backdrop = null;
      if (host && host.capture) {
        const hide = [bar, fx, canvas, guts];
        const prev = hide.map((el) => el.style.display);
        hide.forEach((el) => (el.style.display = 'none'));
        try {
          // setTimeout (not rAF) so the hide still lands even if rendering is throttled
          await new Promise((r) => setTimeout(r, 32));
          backdrop = await host.capture();
        } catch (e) { backdrop = null; }
        hide.forEach((el, i) => (el.style.display = prev[i]));
      }

      const W = canvas.width, H = canvas.height;
      const out = makeCanvas(W, H);
      const octx = out.getContext('2d');
      let noteBackdropMissing = !!(host && host.capture) && !backdrop;
      // same stacking order as on screen: backdrop → guts → damage
      const layers = () => { octx.drawImage(guts, 0, 0); octx.drawImage(canvas, 0, 0); };
      if (backdrop) {
        await new Promise((res) => {
          const img = new Image();
          img.onload = () => { octx.drawImage(img, 0, 0, W, H); layers(); res(); };
          img.onerror = () => { noteBackdropMissing = true; layers(); res(); };
          img.src = backdrop;
        });
      } else {
        layers();
      }
      showPreview(out, noteBackdropMissing);
    } finally {
      saving = false; // never let the button dead-lock, even on an error
    }
  }

  function showPreview(outCanvas, backdropMissing) {
    const dim = doc.createElement('div');
    dim.style.cssText =
      'position:fixed;inset:0;z-index:' + Z + ';background:rgba(0,0,0,0.75);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'font:14px/1.4 system-ui,sans-serif;color:#eee;';
    const img = doc.createElement('img');
    img.src = outCanvas.toDataURL('image/png');
    img.style.cssText = 'max-width:80vw;max-height:66vh;border:1px solid rgba(255,255,255,0.2);box-shadow:0 8px 40px rgba(0,0,0,0.6);';
    dim.appendChild(img);
    if (backdropMissing) {
      const note = doc.createElement('div');
      note.textContent = "Couldn't capture the page — saved the damage layer only.";
      note.style.opacity = '0.85';
      dim.appendChild(note);
    }
    const row = doc.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;';
    const close = () => { dim.remove(); previewDim = null; };
    const mkBtn = (label, bg, onClick) => {
      const b = doc.createElement('button');
      b.textContent = label;
      b.style.cssText = 'all:unset;cursor:pointer;padding:9px 18px;border-radius:8px;background:' + bg + ';color:#fff;font-weight:600;';
      b.onclick = onClick;
      return b;
    };
    row.appendChild(mkBtn('Download', '#e0472f', () => {
      outCanvas.toBlob((blob) => {
        const a = doc.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ragequit.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        close();
      }, 'image/png');
    }));
    row.appendChild(mkBtn('Cancel', 'rgba(255,255,255,0.15)', close));
    dim.appendChild(row);
    doc.documentElement.appendChild(dim);
    previewDim = dim;
  }

  function quit() {
    removeEventListener('resize', resize);
    removeEventListener('keydown', onKey, true);
    removeEventListener('mouseup', stopAuto);
    removeEventListener('blur', stopAuto);
    stopAuto();
    fxRunning = false;
    if (shakeRAF) cancelAnimationFrame(shakeRAF);
    guts.remove();
    canvas.remove();
    fx.remove();
    bar.remove();
    if (window.__SMASH_GUTS__) window.__SMASH_GUTS__.reset();
    if (previewDim) { previewDim.remove(); previewDim = null; } // don't leak an open preview
    clearTimeout(swingTimer);
    if (ac) ac.close();
    tools.forEach((t) => t.reset && t.reset());
    delete window.__SMASH__;
    delete window.__SMASH_TOOLS__; // concat re-registers tools on next injection
    delete window.__SMASH_GUTS__;  // ditto — never leave closures on the host page
    delete window.__SMASH_HOST__;  // extension re-injects host.js; desktop is closing anyway
    // desktop app: quitting the toy quits the app (bridge set by desktop preload)
    const d = window.__SMASH_DESKTOP__;
    if (d) d.quit ? d.quit() : window.close();
  }

  // ---- input ----
  let mx = 0, my = 0;      // tracked cursor for auto-fire follow
  let autoTimer = 0;       // interval id while holding an auto weapon

  // Hardware-breach API handed to weapons as hit()'s 4th arg. Tools that ignore
  // it keep working unchanged (backward-compatible). Implementation lives in
  // guts.js, which registers itself as window.__SMASH_GUTS__ before the engine.
  const G = window.__SMASH_GUTS__;
  let lastZap = 0;
  const breachApi = {
    // Chew `amount` deeper over a disc and repaint the exposed strata there.
    breach(x, y, radius, amount) {
      const wasDeep = depthAt(x, y) >= 1;
      const d = addDepth(x, y, radius, amount);
      if (G) {
        G.paint(gutsCtx, x, y, radius, d, depthAt);
        // once breached, clear the damage art covering the hole so the guts show
        if (d >= 1) G.punch(ctx, x, y, radius);
      }
      if (d >= 1) {
        startFx(); // sparks/shards/flicker need the fx loop running
        // zap only on the moment of first breach-through, not every later hit —
        // and throttled, since a spray can cross the threshold on several
        // adjacent cells within one burst
        if (!wasDeep && G && G.zap && performance.now() - lastZap > 90 && ensureAudio()) {
          lastZap = performance.now();
          G.zap(ac, masterGain || master);
        }
      }
      return d;
    },
    depthAt: depthAt,
    spark(x, y, n) { if (G) { G.spark(x, y, n); startFx(); } },
  };

  function fireOnce(x, y) {
    tool.hit(ctx, x, y, breachApi);
    if (tool.soundLoop) startLoop(); // looping weapons roar continuously instead of per-hit
    else playSound();
    if (tool.frame || G) startFx();
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
    // while the save preview is open it owns the keyboard: Esc closes it, nothing else fires
    if (previewDim) {
      if (e.key === 'Escape') { e.stopPropagation(); previewDim.remove(); previewDim = null; }
      else e.stopPropagation();
      return;
    }
    if (e.key === 'Escape') { e.stopPropagation(); quit(); }
    else if (e.key === 'r' || e.key === 'R') { e.stopPropagation(); reset(); }
    else if (e.key >= '1' && e.key <= '9') { e.stopPropagation(); arm(+e.key - 1); }
    else if (e.key === '0') { e.stopPropagation(); arm(9); } // 0 = 10th weapon
  }

  addEventListener('resize', resize);
  addEventListener('keydown', onKey, true);

  doc.documentElement.appendChild(guts); // under the damage layer — order matters
  doc.documentElement.appendChild(canvas);
  doc.documentElement.appendChild(fx);
  doc.documentElement.appendChild(bar);
  arm(0);
  collapse();

  window.__SMASH__ = { quit: quit, reset: reset, shake: shake };
})();
