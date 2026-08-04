// Weapon: flamethrower — hold to burn. Rising painterly flame plume at the
// cursor, char builds to black in ~1s, smoke wisps curl up for ~3s after,
// flames flicker out (~0.5s) on release. Continuous roar via soundLoop.
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);

  // Teardrop flame glyph: outer orange, inner yellow, white core.
  function drawFlame(g, size) {
    const s = size / 24;
    const tongue = (r, color) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(12 * s, (21 - 17 * r) * s); // tip
      g.bezierCurveTo(
        (12 + 8 * r) * s, (21 - 10 * r) * s,
        (12 + 6.5 * r) * s, 21 * s,
        12 * s, 21 * s
      );
      g.bezierCurveTo(
        (12 - 6.5 * r) * s, 21 * s,
        (12 - 8 * r) * s, (21 - 10 * r) * s,
        12 * s, (21 - 17 * r) * s
      );
      g.fill();
    };
    tongue(1, '#e2622b');
    tongue(0.62, '#f7a832');
    tongue(0.3, '#ffe9a8');
  }

  let flames = [];   // rising fire particles {x,y,vx,vy,r,life,max}
  let smoke = [];    // wisps {x,y,vy,drift,phase,r,life,max}
  let hotspots = []; // freshly charred spots that emit smoke {x,y,age}

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'flamethrower',
    auto: 50, // char/particle tick every 50ms while held

    icon(ctx, size) {
      drawFlame(ctx, size);
    },

    // Outlined crosshair + flame badge; held variant glows warm.
    cursor(makeCanvas) {
      const draw = (hot) => {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        const paint = (stroke, lw) => {
          g.strokeStyle = stroke;
          g.lineWidth = lw;
          g.beginPath();
          g.arc(16, 16, hot ? 10 : 8, 0, Math.PI * 2);
          g.moveTo(16, 3); g.lineTo(16, 10);
          g.moveTo(16, 22); g.lineTo(16, 29);
          g.moveTo(3, 16); g.lineTo(10, 16);
          g.moveTo(22, 16); g.lineTo(29, 16);
          g.stroke();
        };
        paint('rgba(10,15,25,0.85)', 4);
        paint(hot ? '#ffb347' : '#f2e9dc', 2);
        g.save();
        g.translate(19, 17);
        drawFlame(g, 13);
        g.restore();
        return 'url(' + c.toDataURL() + ') 16 16, crosshair';
      };
      return { idle: draw(false), swung: draw(true) };
    },

    // Each 50ms tick: one translucent char stamp (≈20 stamps → full black in ~1s)
    // + a burst of flame particles + remember the spot for smoke.
    hit(ctx, x, y, api) {
      const cx = x + rand(-8, 8);
      const cy = y + rand(-6, 6);
      const R = rand(16, 26);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, 'rgba(12,8,6,0.16)');       // sooty core, stacks to black
      g.addColorStop(0.55, 'rgba(48,28,13,0.11)');  // brown scorch fringe
      g.addColorStop(1, 'rgba(48,28,13,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 4; i++) {
        flames.push({
          x: x + rand(-12, 12),
          y: y + rand(-4, 8),
          vx: rand(-15, 15),
          vy: rand(-160, -80),
          r: rand(7, 15),
          life: rand(0.35, 0.6), // particles dying naturally = the 0.5s flicker-out on release
          max: 0,
        });
      }
      for (const f of flames) if (!f.max) f.max = f.life;

      // one hotspot per tick is plenty for smoke density
      hotspots.push({ x: cx, y: cy, age: 0 });
      if (hotspots.length > 90) hotspots.shift();
      // breach last so the fresh char doesn't cover the melt-through; heat works
      // slowly and widely — char first, then the panel gives way
      if (api) api.breach(cx, cy, R * 0.8, 0.09);
    },

    frame(g, dt, w, h) {
      // smoke emission from young hotspots (first 3s), thinning over time
      for (const hs of hotspots) {
        hs.age += dt;
        if (hs.age < 3 && Math.random() < dt * (2.5 - hs.age * 0.7)) {
          smoke.push({
            x: hs.x + rand(-8, 8),
            y: hs.y,
            vy: rand(-45, -25),
            drift: rand(8, 22),
            phase: rand(0, Math.PI * 2),
            r: rand(6, 11),
            life: rand(1.4, 2.2),
            max: 0,
          });
        }
      }
      hotspots = hotspots.filter((hs) => hs.age < 3);
      for (const s of smoke) if (!s.max) { s.max = s.life; s.shade = rand(105, 140); }

      // smoke: soft gray, grows and thins as it rises, sinusoidal drift
      for (const s of smoke) {
        s.life -= dt;
        if (s.life <= 0) continue;
        s.y += s.vy * dt;
        s.phase += dt * 2.2;
        s.x += Math.sin(s.phase) * s.drift * dt;
        s.r += 9 * dt;
        const a = 0.22 * (s.life / s.max);
        const sh = s.shade | 0; // per-wisp gray jitter so clusters don't look cloned
        const sg = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        sg.addColorStop(0, 'rgba(' + sh + ',' + sh + ',' + (sh + 4) + ',' + a.toFixed(3) + ')');
        sg.addColorStop(1, 'rgba(' + sh + ',' + sh + ',' + (sh + 4) + ',0)');
        g.fillStyle = sg;
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fill();
      }
      smoke = smoke.filter((s) => s.life > 0);

      // flames: additive painterly blobs, rising, shrinking, cooling
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const f of flames) {
        f.life -= dt;
        if (f.life <= 0) continue;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        const k = f.life / f.max;             // 1 = fresh, 0 = dead
        const r = f.r * (0.4 + 0.6 * k);
        g.save();
        g.translate(f.x, f.y);
        g.scale(1, 1.5 + 0.6 * (1 - k)); // vertical stretch = licking tongue, not orange fog
        const fg = g.createRadialGradient(0, 0, 0, 0, 0, r);
        fg.addColorStop(0, 'rgba(255,235,160,' + (0.75 * k).toFixed(3) + ')');
        fg.addColorStop(0.45, 'rgba(255,140,40,' + (0.5 * k).toFixed(3) + ')');
        fg.addColorStop(1, 'rgba(200,40,10,0)');
        g.fillStyle = fg;
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.restore();
      flames = flames.filter((f) => f.life > 0);

      return flames.length + smoke.length + hotspots.length > 0;
    },

    // Continuous roar: looping filtered noise, ignition swell, crackle pops.
    // Returns the stop function (engine calls it on release/switch/quit).
    soundLoop(ac, dest) {
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, ac.currentTime);
      out.gain.exponentialRampToValueAtTime(0.5, ac.currentTime + 0.12); // ignition whoof
      out.connect(dest || ac.destination);

      // looped noise bed → lowpass roar
      const len = ac.sampleRate * 1.5 | 0;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 850;
      // slow wobble on the filter keeps the roar alive; rate drifts so it never
      // settles into a fixed beat the ear can lock onto
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      lfo.frequency.value = 2.3;
      lfoGain.gain.value = 140;
      lfo.connect(lfoGain).connect(lp.frequency);
      src.connect(lp).connect(out);
      const retune = setInterval(() => {
        lfo.frequency.setTargetAtTime(rand(1.6, 3.0), ac.currentTime, 0.5);
      }, 1500);

      // high hiss band: without it the roar reads as wind, not fire
      const hiss = ac.createBiquadFilter();
      hiss.type = 'bandpass';
      hiss.frequency.value = 2600;
      hiss.Q.value = 0.5;
      const hissGain = ac.createGain();
      hissGain.gain.value = 0.15;
      src.connect(hiss).connect(hissGain).connect(out);

      src.start();
      lfo.start();

      // crackle pops on randomized gaps (a fixed interval reads as a metronome)
      let crackleTimer;
      (function scheduleCrackle() {
        crackleTimer = setTimeout(() => {
          const t = ac.currentTime;
          const o = ac.createOscillator();
          const og = ac.createGain();
          o.type = 'square';
          o.frequency.value = rand(900, 2400);
          og.gain.setValueAtTime(rand(0.03, 0.09), t);
          og.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
          o.connect(og).connect(out);
          o.start(t);
          o.stop(t + 0.04);
          scheduleCrackle();
        }, rand(40, 160));
      })();

      return function stop() {
        clearTimeout(crackleTimer);
        clearInterval(retune);
        const t = ac.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); // die down with the flames
        setTimeout(() => { src.stop(); lfo.stop(); out.disconnect(); }, 250);
      };
    },

    sound() {}, // per-hit sound unused: the loop covers audio while held

    reset() {
      flames = [];
      smoke = [];
      hotspots = [];
    },
  });
})();
