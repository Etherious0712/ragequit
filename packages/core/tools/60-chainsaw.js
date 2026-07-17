// Weapon: chainsaw — hold + drag to carve a ragged torn rip along the path.
// Slow drag = wide messy gash, fast swipe = thin slash; holding still grinds
// a widening hole. Debris chips fly; motor revs with speed (soundLoop).
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);

  // Mini chainsaw: orange body, gray blade bar with tooth notches, blade
  // pointing up-left toward the hotspot.
  function drawSaw(g, size, vibrate) {
    const s = size / 32;
    g.save();
    if (vibrate) g.translate(rand(-1, 1) * s, rand(-1, 1) * s);
    g.rotate(-0.5);
    g.translate(10 * s, 14 * s);
    // blade bar
    g.fillStyle = '#8a939c';
    g.strokeStyle = '#3a4048';
    g.lineWidth = 1.2 * s;
    g.beginPath();
    g.roundRect(-9 * s, -2.2 * s, 18 * s, 4.4 * s, 2.2 * s);
    g.fill();
    g.stroke();
    // teeth notches (sub-pixel below 28px — skip on the toolbar icon)
    if (size >= 28) {
      g.fillStyle = '#3a4048';
      for (let i = -7; i <= 7; i += 2.6) {
        g.fillRect(i * s, -2.6 * s, 1.1 * s, 1.1 * s);
        g.fillRect((i + 1.3) * s, 1.5 * s, 1.1 * s, 1.1 * s);
      }
    }
    // body
    g.fillStyle = '#d8622a';
    g.strokeStyle = '#7c3312';
    g.beginPath();
    g.roundRect(7 * s, -4.5 * s, 10 * s, 9 * s, 2 * s);
    g.fill();
    g.stroke();
    // handle arc
    g.strokeStyle = '#2c2c30';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.arc(12 * s, -5 * s, 4 * s, Math.PI, Math.PI * 1.9);
    g.stroke();
    // body highlight
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(8 * s, -3.6 * s, 8 * s, 1.4 * s);
    g.restore();
  }

  let last = null;     // {x,y,t} previous tick position
  let grind = 0;       // seconds spent stationary at the current spot
  let speedSmooth = 0; // px/s, smoothed — read by the sound loop for revving
  let chips = [];      // debris {x,y,vx,vy,rot,vr,life,max,w,h,shade}

  // One ragged segment of the rip from (x1,y1) to (x2,y2) at width w.
  function tear(ctx, x1, y1, x2, y2, w) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx);

    // dark core stroke
    ctx.strokeStyle = 'rgba(14,11,9,0.9)';
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // pale splintered-fiber stroke on every segment: the rip must read on dark pages
    const perp = a + Math.PI / 2;
    const ox = Math.cos(perp) * w * 0.18, oy = Math.sin(perp) * w * 0.18;
    ctx.strokeStyle = 'rgba(196,150,96,0.3)';
    ctx.lineWidth = Math.max(1, w * 0.2);
    ctx.beginPath();
    ctx.moveTo(x1 + ox, y1 + oy);
    ctx.lineTo(x2 + ox, y2 + oy);
    ctx.stroke();

    // splintered edges: short angled strokes off both sides + light catch
    const n = Math.max(2, len / 5 | 0);
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      const px = x1 + dx * t, py = y1 + dy * t;
      const side = Math.random() < 0.5 ? 1 : -1;
      const sa = a + side * (Math.PI / 2) + rand(-0.6, 0.6);
      const sl = w * rand(0.4, 1.1);
      ctx.strokeStyle = 'rgba(' + (50 + rand(-15, 15) | 0) + ',' + (34 + rand(-10, 10) | 0) + ',' + (20 + rand(-8, 8) | 0) + ',0.7)';
      ctx.lineWidth = rand(0.8, 1.6);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(sa) * sl, py + Math.sin(sa) * sl);
      ctx.stroke();
      if (Math.random() < 0.4) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(sa) * sl, py + Math.sin(sa) * sl);
        ctx.lineTo(px + Math.cos(sa) * (sl + 2), py + Math.sin(sa) * (sl + 2));
        ctx.stroke();
      }
    }
  }

  function spawnChips(x, y, count, w) {
    for (let i = 0; i < count; i++) {
      chips.push({
        x: x + rand(-w, w) * 0.4,
        y: y + rand(-w, w) * 0.4,
        vx: rand(-180, 180),
        vy: rand(-260, -60),
        rot: rand(0, Math.PI * 2),
        vr: rand(-20, 20),
        life: rand(0.35, 0.75),
        max: 0,
        w: rand(2, 4.5),
        h: rand(1.2, 2.5),
        shade: rand(70, 140), // some chips read as freshly-cut pale wood, visible on dark pages
      });
    }
  }

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'chainsaw',
    auto: 30, // ~33 ticks/sec for smooth trails

    icon(ctx, size) {
      drawSaw(ctx, size, false);
    },

    cursor(makeCanvas) {
      const draw = (running) => {
        const c = makeCanvas(32, 32);
        drawSaw(c.getContext('2d'), 32, running);
        return 'url(' + c.toDataURL() + ') 3 10, crosshair'; // hotspot = blade tip
      };
      return { idle: draw(false), swung: draw(true) };
    },

    hit(ctx, x, y) {
      const now = performance.now();
      // time gap = a new stroke, not a segment from the old one
      if (!last || now - last.t > 120) {
        last = { x: x, y: y, t: now };
        grind = 0;
        speedSmooth = 0;
      }
      const dt = Math.max((now - last.t) / 1000, 0.001);
      const dist = Math.hypot(x - last.x, y - last.y);
      const speed = dist / dt; // px/s
      speedSmooth += (speed - speedSmooth) * 0.3;

      if (dist < 2) {
        // stationary: grind a widening ragged hole
        grind = Math.min(grind + dt, 2.5);
        const R = 6 + grind * 10;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, 'rgba(14,11,9,0.5)');
        g.addColorStop(0.7, 'rgba(40,28,18,0.25)');
        g.addColorStop(1, 'rgba(40,28,18,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fill();
        // ragged rim bites
        const ba = rand(0, Math.PI * 2);
        tear(ctx, x + Math.cos(ba) * R * 0.5, y + Math.sin(ba) * R * 0.5,
             x + Math.cos(ba) * R, y + Math.sin(ba) * R, rand(2, 4));
        spawnChips(x, y, 2, R);
      } else {
        grind = 0;
        // slow = wide (up to ~14px), fast = thin (min ~3px)
        const w = Math.max(3, 14 - speedSmooth * 0.012);
        tear(ctx, last.x, last.y, x, y, w);
        spawnChips(x, y, dist > 8 ? 3 : 2, w);
      }
      last = { x: x, y: y, t: now };
    },

    frame(g, dt, w, h) {
      for (const c of chips) {
        if (!c.max) c.max = c.life;
        c.life -= dt;
        if (c.life <= 0) continue;
        c.vy += 950 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
        const sh = c.shade | 0;
        g.save();
        g.translate(c.x, c.y);
        g.rotate(c.rot);
        g.fillStyle = 'rgba(' + (sh + 20) + ',' + sh + ',' + (sh - 15) + ',' + Math.min(1, c.life * 3).toFixed(2) + ')';
        g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        g.restore();
      }
      chips = chips.filter((c) => c.life > 0 && c.y < h + 20);
      return chips.length > 0;
    },

    // Motor: sawtooth + chain rattle, revs with drag speed, silent when idle.
    soundLoop(ac, dest) {
      const out = ac.createGain();
      out.gain.setValueAtTime(0.0001, ac.currentTime);
      out.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + 0.08); // rev-up
      out.connect(dest || ac.destination);

      // engine tone: detuned sawtooth pair
      const osc1 = ac.createOscillator();
      const osc2 = ac.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.value = 95;
      osc2.frequency.value = 99;
      const engGain = ac.createGain();
      engGain.gain.value = 0.5;
      // lowpass the saws: raw sawtooth harmonics read as buzz, not a throaty roar
      const engLP = ac.createBiquadFilter();
      engLP.type = 'lowpass';
      engLP.frequency.value = 2200;
      engLP.Q.value = 0.7;
      osc1.connect(engGain);
      osc2.connect(engGain);
      engGain.connect(engLP).connect(out);

      // chain rattle: looped noise through bandpass
      const len = ac.sampleRate | 0;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const noise = ac.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 0.6;
      const rattleGain = ac.createGain();
      rattleGain.gain.value = 0.25;
      noise.connect(bp).connect(rattleGain).connect(out);

      osc1.start();
      osc2.start();
      noise.start();

      // rev with drag speed: pitch, rattle + engine brightness track speedSmooth
      const rev = setInterval(() => {
        const t = ac.currentTime;
        const boost = Math.min(speedSmooth / 900, 1); // 0 idle-hold → 1 fast swipe
        osc1.frequency.setTargetAtTime(95 + boost * 85, t, 0.06);
        osc2.frequency.setTargetAtTime(99 + boost * 90, t, 0.06);
        bp.frequency.setTargetAtTime(700 + boost * 900, t, 0.06);
        engLP.frequency.setTargetAtTime(2200 + boost * 1200, t, 0.06);
      }, 60);

      return function stop() {
        clearInterval(rev);
        const t = ac.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); // sputter out
        osc1.frequency.setTargetAtTime(55, t, 0.08); // pitch drop as it dies
        osc2.frequency.setTargetAtTime(57, t, 0.08);
        setTimeout(() => { osc1.stop(); osc2.stop(); noise.stop(); out.disconnect(); }, 200);
      };
    },

    sound() {}, // loop covers audio while held

    reset() {
      chips = [];
      last = null;
      grind = 0;
      speedSmooth = 0;
    },
  });
})();
