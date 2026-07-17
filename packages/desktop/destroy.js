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
    sound(ac, dest) {
      const t = ac.currentTime;
      const out = ac.createGain();
      out.gain.setValueAtTime(0.5, t);
      out.connect(dest || ac.destination);

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

// Weapon: glass cracks — click = local radial shatter. Clicking near an
// existing shatter grows connecting cracks from it. Instant white glint flash.
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);

  // One jagged crack line from (x,y) toward `angle`, with occasional branches.
  // Dark core stroke + offset white glint = glass look on any background.
  function crackLine(ctx, x, y, angle, len, width, depth) {
    const pts = [[x, y]];
    let px = x, py = y, a = angle;
    const steps = 4 + (Math.random() * 3 | 0);
    for (let s = 1; s <= steps; s++) {
      a += rand(-0.35, 0.35);
      const d = (len / steps) * rand(0.7, 1.3);
      px += Math.cos(a) * d;
      py += Math.sin(a) * d;
      pts.push([px, py]);
      // branch: shorter, thinner child crack
      if (depth > 0 && Math.random() < 0.35) {
        crackLine(ctx, px, py, a + rand(0.5, 1.1) * (Math.random() < 0.5 ? 1 : -1), len * 0.4, width * 0.6, depth - 1);
      }
    }
    for (const [dx, dy, style, w] of [
      [0.8, 0.8, 'rgba(255,255,255,0.45)', width * 0.9], // glint offset
      [0, 0, 'rgba(20,25,35,0.75)', width],              // dark core
    ]) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + dx, pts[i][1] + dy);
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.stroke();
    }
  }

  // Brief white glint flash at the impact — its own throwaway node so the
  // persistent damage canvas stays untouched.
  function flash(x, y) {
    const f = document.createElement('div');
    f.style.cssText =
      'position:fixed;left:' + (x - 60) + 'px;top:' + (y - 60) + 'px;width:120px;height:120px;' +
      'z-index:2147483647;pointer-events:none;border-radius:50%;' +
      'background:radial-gradient(circle,rgba(255,255,255,0.9),rgba(255,255,255,0) 65%);' +
      'transform:scale(0.7);' +
      'transition:opacity 80ms ease-out,transform 80ms cubic-bezier(.2,1.4,.4,1);';
    document.documentElement.appendChild(f);
    requestAnimationFrame(() => { f.style.opacity = '0'; f.style.transform = 'scale(1)'; });
    setTimeout(() => f.remove(), 150);
  }

  let impacts = []; // remembered so nearby hits extend the web of damage

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'glass',

    icon(ctx, size) {
      const s = size / 24;
      ctx.translate(12 * s, 12 * s);
      ctx.strokeStyle = '#cfe3f5';
      ctx.lineWidth = 1.4 * s;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 2 * s, Math.sin(a) * 2 * s);
        ctx.lineTo(Math.cos(a + 0.35) * 10 * s, Math.sin(a + 0.35) * 10 * s);
        ctx.stroke();
      }
      ctx.fillStyle = '#eef6ff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    },

    // Crosshair-style ring cursor: aiming at glass, hotspot dead center.
    // Dark outline under bright core so it reads on both light and dark pages.
    cursor(makeCanvas) {
      const draw = (pressed) => {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        const paint = (stroke, lw) => {
          g.strokeStyle = stroke;
          g.lineWidth = lw;
          g.beginPath();
          g.arc(16, 16, pressed ? 6 : 9, 0, Math.PI * 2);
          g.moveTo(16, 3); g.lineTo(16, 10);
          g.moveTo(16, 22); g.lineTo(16, 29);
          g.moveTo(3, 16); g.lineTo(10, 16);
          g.moveTo(22, 16); g.lineTo(29, 16);
          g.stroke();
        };
        paint('rgba(10,15,25,0.85)', 4);
        paint(pressed ? '#ffffff' : '#dbe9f7', 2);
        return 'url(' + c.toDataURL() + ') 16 16, crosshair';
      };
      return { idle: draw(false), swung: draw(true) };
    },

    hit(ctx, x, y) {
      // dark rim under the light disc — keeps the impact visible on light pages
      const rim = ctx.createRadialGradient(x, y, 0, x, y, 9);
      rim.addColorStop(0, 'rgba(15,20,30,0.35)');
      rim.addColorStop(0.75, 'rgba(15,20,30,0.12)');
      rim.addColorStop(1, 'rgba(15,20,30,0)');
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();

      // pulverized core disc
      const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
      g.addColorStop(0, 'rgba(235,242,250,0.9)');
      g.addColorStop(1, 'rgba(235,242,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();

      // radial shatter: 8-14 cracks
      const n = 8 + (Math.random() * 7 | 0);
      for (let i = 0; i < n; i++) {
        crackLine(ctx, x, y, (i / n) * Math.PI * 2 + rand(-0.2, 0.2), rand(35, 85), rand(0.8, 1.8), 1);
      }

      // near an old impact? grow connecting cracks from it toward the new hit
      // ponytail: nearest 6 only — spam-clicking one spot must not overdraw into a blob
      const near = impacts
        .map((p) => ({ p: p, d: Math.hypot(x - p.x, y - p.y) }))
        .filter((o) => o.d > 20 && o.d < 160)
        .sort((a, b) => a.d - b.d)
        .slice(0, 6);
      for (const { p, d } of near) {
        const a = Math.atan2(y - p.y, x - p.x);
        for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) {
          crackLine(ctx, p.x, p.y, a + rand(-0.25, 0.25), d * rand(0.6, 1.0), rand(0.7, 1.4), 0);
        }
      }
      impacts.push({ x: x, y: y });
      if (impacts.length > 60) impacts.shift(); // ponytail: cap memory; oldest shatters stop extending

      flash(x, y);
    },

    // Sharp clink + tinkle tail of tiny shard pings.
    sound(ac, dest) {
      const t = ac.currentTime;
      const out = ac.createGain();
      out.gain.value = 0.4;
      out.connect(dest || ac.destination);

      // impact clink: bright FM-ish ping
      const osc = ac.createOscillator();
      const og = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(rand(2200, 3200), t);
      og.gain.setValueAtTime(0.9, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(og).connect(out);
      osc.start(t);
      osc.stop(t + 0.09);

      // noise crack transient
      const len = ac.sampleRate * 0.05 | 0;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const noise = ac.createBufferSource();
      noise.buffer = buf;
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      noise.connect(hp).connect(out);
      noise.start(t);

      // tinkle tail: 5-8 tiny high pings over ~0.4s
      const nTinks = 5 + (Math.random() * 4 | 0);
      for (let i = 0; i < nTinks; i++) {
        const tt = t + 0.06 + Math.random() * 0.35;
        const o = ac.createOscillator();
        const gg = ac.createGain();
        o.type = 'sine';
        o.frequency.value = rand(3000, 6500);
        gg.gain.setValueAtTime(0, tt);
        gg.gain.linearRampToValueAtTime(rand(0.08, 0.2), tt + 0.005);
        gg.gain.exponentialRampToValueAtTime(0.001, tt + rand(0.04, 0.09));
        o.connect(gg).connect(out);
        o.start(tt);
        o.stop(tt + 0.1);
      }
    },

    reset() {
      impacts = [];
    },
  });
})();

// Weapon: gun — click = one shot with ±6px spread. Glass-piercing bullet hole:
// black core, torn rim, gray spall ring, 3-5 radial micro-cracks. Impact flash.
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);

  // Small pistol silhouette pointing right, drawn in a `size` box.
  function drawPistol(g, size) {
    const s = size / 24;
    g.fillStyle = '#7d8791';   // light gunmetal — reads on the dark toolbar and dark pages
    g.strokeStyle = '#2a2f36';
    g.lineWidth = s;
    g.beginPath();
    // slide + barrel
    g.roundRect(3 * s, 7 * s, 17 * s, 5.5 * s, 1.5 * s);
    // grip, angled back
    g.moveTo(6 * s, 12 * s);
    g.lineTo(11 * s, 12 * s);
    g.lineTo(9.5 * s, 20 * s);
    g.lineTo(4.5 * s, 20 * s);
    g.closePath();
    g.fill();
    g.stroke();
    // trigger guard
    g.strokeStyle = '#4a525c';
    g.lineWidth = 1.2 * s;
    g.beginPath();
    g.arc(12.5 * s, 14 * s, 2.5 * s, 0.2, Math.PI - 0.4);
    g.stroke();
    // slide highlight
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(4 * s, 8 * s, 15 * s, 1.2 * s);
  }

  // Warm ~60ms spark flash at the impact (throwaway node, damage canvas untouched).
  function flash(x, y) {
    const f = document.createElement('div');
    f.style.cssText =
      'position:fixed;left:' + (x - 35) + 'px;top:' + (y - 35) + 'px;width:70px;height:70px;' +
      'z-index:2147483647;pointer-events:none;border-radius:50%;' +
      'background:radial-gradient(circle,rgba(255,250,220,0.95),rgba(255,180,60,0.5) 40%,rgba(255,140,0,0) 70%);' +
      'transform:scale(0.6);' +
      'transition:opacity 60ms ease-out,transform 60ms cubic-bezier(.2,1.4,.4,1);';
    document.documentElement.appendChild(f);
    requestAnimationFrame(() => { f.style.opacity = '0'; f.style.transform = 'scale(1)'; });
    setTimeout(() => f.remove(), 120);
  }

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'gun',

    icon(ctx, size) {
      drawPistol(ctx, size);
    },

    // Outlined crosshair (hotspot = aim point) + tiny pistol badge bottom-right.
    cursor(makeCanvas) {
      const draw = (recoil) => {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        const paint = (stroke, lw) => {
          g.strokeStyle = stroke;
          g.lineWidth = lw;
          g.beginPath();
          g.arc(16, 16, recoil ? 11 : 8, 0, Math.PI * 2);
          g.moveTo(16, 4); g.lineTo(16, 11);
          g.moveTo(16, 21); g.lineTo(16, 28);
          g.moveTo(4, 16); g.lineTo(11, 16);
          g.moveTo(21, 16); g.lineTo(28, 16);
          g.stroke();
        };
        paint('rgba(10,15,25,0.85)', 4);
        paint(recoil ? '#ffd9a0' : '#f2e9dc', 2);
        g.save();
        g.translate(21, 21);
        drawPistol(g, 11);
        g.restore();
        return 'url(' + c.toDataURL() + ') 16 16, crosshair';
      };
      return { idle: draw(false), swung: draw(true) };
    },

    hit(ctx, x, y) {
      // recoil spread: shots land near, not exactly on, the aim point
      x += rand(-6, 6);
      y += rand(-6, 6);
      const R = rand(4.5, 7); // hole radius

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand(0, Math.PI * 2));

      // gray spall ring: pulverized glass dust around the hole
      const spall = ctx.createRadialGradient(0, 0, R, 0, 0, R * 3);
      spall.addColorStop(0, 'rgba(160,168,178,0.5)');
      spall.addColorStop(0.6, 'rgba(160,168,178,0.18)');
      spall.addColorStop(1, 'rgba(160,168,178,0)');
      ctx.fillStyle = spall;
      ctx.beginPath();
      ctx.arc(0, 0, R * 3, 0, Math.PI * 2);
      ctx.fill();

      // torn rim: jagged dark polygon around the core
      ctx.beginPath();
      const teeth = 9 + (Math.random() * 4 | 0);
      for (let i = 0; i <= teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        const r = R * rand(1.15, 1.7);
        i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(25,28,34,0.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(210,215,225,0.35)'; // chipped-glass edge glint, visible on black pages
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // black core
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5,6,8,0.95)';
      ctx.fill();

      // 3-5 radial micro-cracks with glint (dual-tone, reads on any background)
      const n = 3 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.4, 0.4);
        const len = rand(R * 2.5, R * 5);
        const midA = a + rand(-0.3, 0.3);
        const pts = [
          [Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2],
          [Math.cos(midA) * len * 0.6, Math.sin(midA) * len * 0.6],
          [Math.cos(midA + rand(-0.3, 0.3)) * len, Math.sin(midA + rand(-0.3, 0.3)) * len],
        ];
        for (const [dx, dy, style, w] of [
          [0.7, 0.7, 'rgba(255,255,255,0.4)', 1.1],
          [0, 0, 'rgba(20,25,35,0.75)', 1.3],
        ]) {
          ctx.beginPath();
          ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
          ctx.lineTo(pts[1][0] + dx, pts[1][1] + dy);
          ctx.lineTo(pts[2][0] + dx, pts[2][1] + dy);
          ctx.strokeStyle = style;
          ctx.lineWidth = w;
          ctx.stroke();
        }
      }
      ctx.restore();

      flash(x, y);
    },

    // Sharp crack + low thump + two decaying echo slaps.
    sound(ac, dest) {
      const t = ac.currentTime;
      const out = ac.createGain();
      out.gain.value = 0.5;
      out.connect(dest || ac.destination);

      // crack: hot noise burst, band-passed high
      const mkNoise = (at, dur, gain, freq) => {
        const len = ac.sampleRate * dur | 0;
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d = buf.getChannelData(0);
        // ~8-sample attack ramp kills the waveform-discontinuity tick at gain 1.0
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2) * Math.min(1, i / 8);
        }
        const src = ac.createBufferSource();
        src.buffer = buf;
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq;
        bp.Q.value = 0.8;
        const gg = ac.createGain();
        gg.gain.value = gain;
        src.connect(bp).connect(gg).connect(out);
        src.start(at);
      };
      mkNoise(t, 0.09, 1.0, rand(2500, 3500));   // main crack
      mkNoise(t + 0.1, 0.12, 0.28, 1500);        // echo slap 1 (duller)
      mkNoise(t + 0.24, 0.16, 0.12, 900);        // echo slap 2 (far)

      // body thump
      const osc = ac.createOscillator();
      const og = ac.createGain();
      osc.frequency.setValueAtTime(rand(110, 150), t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.1);
      og.gain.setValueAtTime(0.7, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(og).connect(out);
      osc.start(t);
      osc.stop(t + 0.13);
    },
  });
})();

// Weapon: machine gun — hold to auto-fire ~8 rounds/sec at the cursor.
// Climbing recoil (±6px → ±25px over a sustained burst), per-round muzzle
// flicker on the fx layer, brass casings that eject, bounce and fade.
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);

  // Compact MG silhouette pointing right: long barrel, box magazine, stock.
  function drawMG(g, size) {
    const s = size / 24;
    g.fillStyle = '#7d8791';
    g.strokeStyle = '#2a2f36';
    g.lineWidth = s;
    g.beginPath();
    // receiver + barrel
    g.roundRect(2 * s, 9 * s, 20 * s, 4 * s, s);
    // stock (back-left, angled down)
    g.moveTo(2 * s, 10 * s);
    g.lineTo(0.5 * s, 15 * s);
    g.lineTo(4 * s, 15 * s);
    g.lineTo(5 * s, 13 * s);
    g.closePath();
    g.fill();
    g.stroke();
    // magazine, curved forward
    g.beginPath();
    g.moveTo(11 * s, 13 * s);
    g.lineTo(14.5 * s, 13 * s);
    g.lineTo(13.5 * s, 19 * s);
    g.lineTo(10 * s, 19 * s);
    g.closePath();
    g.fill();
    g.stroke();
    // muzzle tip
    g.fillStyle = '#4a525c';
    g.fillRect(20.5 * s, 9.5 * s, 2.5 * s, 3 * s);
    // top highlight
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(3 * s, 9.6 * s, 17 * s, 1 * s);
  }

  let lastShot = 0;   // ms timestamp of the previous round
  let burstStart = 0; // ms timestamp when the current burst began
  let casings = [];   // {x,y,vx,vy,rot,vr,life}
  let flashes = [];   // {x,y,r,life}

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'machine gun',
    auto: 125, // ~8 rounds/sec while held; engine follows the cursor

    icon(ctx, size) {
      drawMG(ctx, size);
    },

    // Heavier double-ring crosshair + MG badge. Recoil variant widens.
    cursor(makeCanvas) {
      const draw = (recoil) => {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        const paint = (stroke, lw) => {
          g.strokeStyle = stroke;
          g.lineWidth = lw;
          g.beginPath();
          g.arc(16, 16, recoil ? 12 : 8, 0, Math.PI * 2);
          g.moveTo(16, 2); g.lineTo(16, 9);
          g.moveTo(16, 23); g.lineTo(16, 30);
          g.moveTo(2, 16); g.lineTo(9, 16);
          g.moveTo(23, 16); g.lineTo(30, 16);
          g.stroke();
        };
        paint('rgba(10,15,25,0.85)', 4);
        paint(recoil ? '#ffc46b' : '#f2e9dc', 2);
        g.save();
        g.translate(20, 22);
        drawMG(g, 12);
        g.restore();
        return 'url(' + c.toDataURL() + ') 16 16, crosshair';
      };
      return { idle: draw(false), swung: draw(true) };
    },

    hit(ctx, x, y) {
      const now = performance.now();
      if (now - lastShot > 300) burstStart = now; // gap = new burst, recoil resets
      lastShot = now;

      // climbing recoil: tight for the first rounds, blooming to ±25px over ~1.5s
      const bloom = Math.min(1, (now - burstStart) / 1500);
      const spread = 6 + 19 * bloom;
      // polar scatter: true circular cone, center-weighted, respects the ±25px cap on diagonals
      const scatterA = rand(0, Math.PI * 2);
      const scatterR = spread * Math.sqrt(Math.random());
      x += Math.cos(scatterA) * scatterR;
      y += Math.sin(scatterA) * scatterR;

      // bullet hole (dry variant of the pistol hole: core, torn rim, spall, 2-3 cracks)
      const R = rand(4, 6);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rand(0, Math.PI * 2));
      const spall = ctx.createRadialGradient(0, 0, R, 0, 0, R * 2.6);
      spall.addColorStop(0, 'rgba(160,168,178,0.45)');
      spall.addColorStop(1, 'rgba(160,168,178,0)');
      ctx.fillStyle = spall;
      ctx.beginPath();
      ctx.arc(0, 0, R * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      const teeth = 8 + (Math.random() * 3 | 0);
      for (let i = 0; i <= teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        const r = R * rand(1.1, 1.6);
        i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(25,28,34,0.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(210,215,225,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5,6,8,0.95)';
      ctx.fill();
      const n = 2 + (Math.random() * 2 | 0);
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const len = rand(R * 2, R * 4);
        for (const [dx, dy, style, w] of [
          [0.7, 0.7, 'rgba(255,255,255,0.4)', 1],
          [0, 0, 'rgba(20,25,35,0.75)', 1.2],
        ]) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * R * 1.2 + dx, Math.sin(a) * R * 1.2 + dy);
          ctx.lineTo(Math.cos(a + rand(-0.3, 0.3)) * len + dx, Math.sin(a + rand(-0.3, 0.3)) * len + dy);
          ctx.strokeStyle = style;
          ctx.lineWidth = w;
          ctx.stroke();
        }
      }
      ctx.restore();

      // fx: muzzle flicker at the impact + ejected brass casing
      flashes.push({ x: x, y: y, r: rand(16, 26), life: 0.06 });
      casings.push({
        x: x, y: y,
        vx: rand(80, 160) * (Math.random() < 0.5 ? -1 : 1),
        vy: rand(-300, -180),
        rot: rand(0, Math.PI * 2),
        vr: rand(-12, 12),
        life: 3,
      });
    },

    // fx layer: simulate casings (gravity, floor bounce, fade) + flash flicker.
    frame(g, dt, w, h) {
      for (const f of flashes) {
        f.life -= dt;
        if (f.life <= 0) continue;
        const grad = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        grad.addColorStop(0, 'rgba(255,250,220,0.9)');
        grad.addColorStop(0.4, 'rgba(255,180,60,0.5)');
        grad.addColorStop(1, 'rgba(255,140,0,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        g.fill();
      }
      flashes = flashes.filter((f) => f.life > 0);

      const floor = h - 6;
      for (const cs of casings) {
        cs.life -= dt;
        cs.vy += 900 * dt; // gravity
        cs.x += cs.vx * dt;
        cs.y += cs.vy * dt;
        cs.rot += cs.vr * dt;
        if (cs.y > floor) { // bounce, losing energy
          cs.y = floor;
          cs.vy *= -0.45;
          cs.vx *= 0.7;
          cs.vr *= 0.6;
        }
        const alpha = Math.min(1, cs.life); // fade out over the last second
        g.save();
        g.translate(cs.x, cs.y);
        g.rotate(cs.rot);
        g.fillStyle = 'rgba(196,164,80,' + alpha.toFixed(2) + ')';
        g.fillRect(-3.5, -1.5, 7, 3);
        g.fillStyle = 'rgba(255,235,170,' + (alpha * 0.7).toFixed(2) + ')';
        g.fillRect(-3.5, -1.5, 7, 1);
        g.restore();
      }
      casings = casings.filter((cs) => cs.life > 0 && cs.x > -20 && cs.x < w + 20);

      return casings.length + flashes.length > 0;
    },

    // Dry short crack, quieter than the pistol, pitch jitter per round.
    sound(ac, dest) {
      const t = ac.currentTime;
      const out = ac.createGain();
      out.gain.value = rand(0.3, 0.4);  // gain + length jitter: 8/s repetition must not read as a loop
      out.connect(dest || ac.destination);

      const len = ac.sampleRate * rand(0.05, 0.075) | 0;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2) * Math.min(1, i / 8);
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = rand(2200, 3200);
      bp.Q.value = 0.7;
      src.connect(bp).connect(out);
      src.start(t);

      const osc = ac.createOscillator();
      const og = ac.createGain();
      osc.frequency.setValueAtTime(rand(120, 160), t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.07);
      og.gain.setValueAtTime(0.5, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(og).connect(out);
      osc.start(t);
      osc.stop(t + 0.09);
    },

    reset() {
      casings = [];
      flashes = [];
      lastShot = 0;
      burstStart = 0;
    },
  });
})();

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
