// Weapon: laser — hold to fire a red beam from a top-center emitter to the
// cursor. A charred molten cut bakes along the cursor path (persistent); the
// beam, molten glow and sparks are transient (fx layer, gone on release).
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);
  const EMIT_X_FRAC = 0.5; // top-center

  let firing = 0;    // performance.now() of the last fire tick (0 = not firing)
  let fx_x = 0, fx_y = 0; // current beam impact point
  let last = null;   // previous char point {x,y,t}
  let sparks = [];   // {x,y,vx,vy,life,max}

  // Charred cut segment: thin dark scorch that persists on the damage canvas.
  function char(ctx, x1, y1, x2, y2) {
    ctx.lineCap = 'round';
    // dark burnt core
    ctx.strokeStyle = 'rgba(18,10,8,0.85)';
    ctx.lineWidth = rand(3, 4.5);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // ember-orange highlight down the center: reads on dark pages where a dark-red
    // fringe would vanish. (canvas is a transparent overlay — 'multiply' against its
    // empty backdrop is a no-op; a bright stroke under source-over is the fix.)
    ctx.strokeStyle = 'rgba(255,130,60,0.4)';
    ctx.lineWidth = rand(1.4, 2);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // 3-layer beam glyph for icon/cursor: outer red, red, white core.
  function beamGlyph(g, size) {
    const s = size / 24;
    g.save();
    g.translate(12 * s, 12 * s);
    g.rotate(-Math.PI / 4);
    for (const [w, color] of [[7 * s, 'rgba(255,40,30,0.5)'], [3.2 * s, '#ff2a1e'], [1.2 * s, '#fff2f0']]) {
      g.strokeStyle = color;
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-10 * s, -10 * s);
      g.lineTo(10 * s, 10 * s);
      g.stroke();
    }
    g.restore();
  }

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'laser',
    auto: 30, // cut/beam tick ~33/sec while held

    icon(ctx, size) {
      beamGlyph(ctx, size);
    },

    cursor(makeCanvas) {
      const draw = (hot) => {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        // outlined crosshair (aim precision) with a warm core when firing
        const paint = (stroke, lw) => {
          g.strokeStyle = stroke;
          g.lineWidth = lw;
          g.beginPath();
          g.arc(16, 16, hot ? 5 : 7, 0, Math.PI * 2);
          g.moveTo(16, 3); g.lineTo(16, 11);
          g.moveTo(16, 21); g.lineTo(16, 29);
          g.moveTo(3, 16); g.lineTo(11, 16);
          g.moveTo(21, 16); g.lineTo(29, 16);
          g.stroke();
        };
        paint('rgba(10,15,25,0.85)', 4);
        paint(hot ? '#ff6a5a' : '#ffd0cb', 2);
        return 'url(' + c.toDataURL() + ') 16 16, crosshair';
      };
      return { idle: draw(false), swung: draw(true) };
    },

    hit(ctx, x, y, api) {
      const now = performance.now();
      firing = now;
      fx_x = x; fx_y = y;
      // char the path; a time gap means a fresh start, not a long jump-cut
      if (last && now - last.t < 120) char(ctx, last.x, last.y, x, y);
      else char(ctx, x - 1, y, x, y); // dot at the impact on a fresh press
      // a focused beam cuts clean through, fast; radius kept wide enough that the
      // strata detail inside the slot is actually legible
      if (api) api.breach(x, y, 16, 0.42);
      last = { x: x, y: y, t: now };
      // sparks fly off the cut point
      for (let i = 0; i < 2; i++) {
        sparks.push({
          x: x, y: y,
          vx: rand(-160, 160),
          vy: rand(-220, -40),
          life: rand(0.18, 0.4),
          max: 0,
        });
      }
    },

    frame(g, dt, w, h) {
      const now = performance.now();
      const age = now - firing;
      const active = firing && age < 90; // beam lingers ~90ms then cuts off

      if (active) {
        const ex = w * EMIT_X_FRAC, ey = -8; // emitter just above the top edge
        const fade = age < 40 ? 1 : Math.pow(1 - (age - 40) / 50, 2); // eased flicker-off, snappier cutoff
        g.save();
        g.globalCompositeOperation = 'lighter';
        // emitter flare so the beam reads as fired-from, not materializing
        const flare = g.createRadialGradient(ex, ey, 0, ex, ey, 14);
        flare.addColorStop(0, 'rgba(255,220,200,' + (0.8 * fade).toFixed(2) + ')');
        flare.addColorStop(1, 'rgba(255,60,30,0)');
        g.fillStyle = flare;
        g.beginPath();
        g.arc(ex, ey, 14, 0, Math.PI * 2);
        g.fill();
        // beam: outer glow → red → white-hot core
        for (const [lw, color] of [
          [12, 'rgba(255,40,30,' + (0.28 * fade).toFixed(2) + ')'],
          [4, 'rgba(255,50,40,' + (0.7 * fade).toFixed(2) + ')'],
          [1.6, 'rgba(255,235,230,' + (0.95 * fade).toFixed(2) + ')'],
        ]) {
          g.strokeStyle = color;
          g.lineWidth = lw;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(ex, ey);
          g.lineTo(fx_x, fx_y);
          g.stroke();
        }
        // molten impact dot
        const glow = g.createRadialGradient(fx_x, fx_y, 0, fx_x, fx_y, 16 * fade);
        glow.addColorStop(0, 'rgba(255,240,220,' + (0.9 * fade).toFixed(2) + ')');
        glow.addColorStop(0.4, 'rgba(255,120,40,' + (0.6 * fade).toFixed(2) + ')');
        glow.addColorStop(1, 'rgba(255,60,20,0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(fx_x, fx_y, 16 * fade, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }

      // sparks (additive), gravity, quick fade
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        if (!s.max) s.max = s.life;
        s.life -= dt;
        if (s.life <= 0) continue;
        s.vy += 500 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const k = s.life / s.max;
        g.fillStyle = 'rgba(255,' + (170 + 60 * k | 0) + ',80,' + k.toFixed(2) + ')';
        g.beginPath();
        g.arc(s.x, s.y, 1.6 * k + 0.6, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      sparks = sparks.filter((s) => s.life > 0);

      return active || sparks.length > 0;
    },

    // Rising electronic hum + filtered-noise sizzle, looped while held.
    soundLoop(ac, dest) {
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, ac.currentTime);
      out.gain.exponentialRampToValueAtTime(0.32, ac.currentTime + 0.15); // power-up swell
      out.connect(dest || ac.destination);

      // detuned hum: two saws + a fifth, rising in pitch on activation
      const humGain = ac.createGain();
      humGain.gain.value = 0.5;
      humGain.connect(out);
      const oscs = [220, 220.7, 330].map((f) => {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 0.6, ac.currentTime);
        o.frequency.exponentialRampToValueAtTime(f, ac.currentTime + 0.15);
        o.connect(humGain);
        o.start();
        return o;
      });
      const humLP = ac.createBiquadFilter();
      humLP.type = 'lowpass';
      humLP.frequency.value = 1400;
      humGain.disconnect();
      humGain.connect(humLP).connect(out);

      // sizzle: looped noise through a highpass
      const len = ac.sampleRate | 0;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const noise = ac.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4000;
      const sizzleGain = ac.createGain();
      sizzleGain.gain.value = 0.12;
      noise.connect(hp).connect(sizzleGain).connect(out);
      noise.start();

      return function stop() {
        const t = ac.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); // power-down
        oscs.forEach((o) => o.frequency.setTargetAtTime(o.frequency.value * 0.5, t, 0.08));
        setTimeout(() => { oscs.forEach((o) => o.stop()); noise.stop(); out.disconnect(); }, 160);
      };
    },

    sound() {}, // loop covers audio while held

    reset() {
      sparks = [];
      last = null;
      firing = 0;
    },
  });
})();
