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
    hit(ctx, x, y) {
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

// Weapon: paintball — click = one splat in a random bright color. Irregular
// blob + satellite droplets bake instantly; a few drips run downward on the
// fx layer for ~0.6s, then bake into the canvas so they persist.
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);

  const randColor = () => 'hsl(' + (Math.random() * 360 | 0) + ',' + (70 + Math.random() * 25 | 0) + '%,' + (48 + Math.random() * 14 | 0) + '%)';

  // Irregular blob: wobbly radial polygon around (x,y), radius ~R.
  function blob(ctx, x, y, R, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const n = 10 + (Math.random() * 5 | 0);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = R * rand(0.68, 1.25);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  let drips = [];    // {x,y,vy,len,w,color,life,max}
  let dmgCtx = null; // persistent canvas ctx, captured on first hit, for baking drips

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'paintball',

    icon(ctx, size) {
      const s = size / 24;
      blob(ctx, 12 * s, 12 * s, 7 * s, '#e0472f');
      ctx.fillStyle = '#f2b134';
      ctx.beginPath();
      ctx.arc(18 * s, 7 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f8fe0';
      ctx.beginPath();
      ctx.arc(6 * s, 18 * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    },

    // A colorful splat blob as the cursor, hotspot at center.
    cursor(makeCanvas) {
      const draw = (squish) => {
        const c = makeCanvas(32, 32);
        const g = c.getContext('2d');
        // outline for contrast on any background
        g.save();
        g.translate(16, 16);
        if (squish) g.scale(1.15, 0.85);
        blob(g, 0, 0, 8, 'rgba(10,10,15,0.7)'); // dark base = outline (blob fills, never strokes)
        g.fillStyle = '#3fb0ff';
        blob(g, 0, 0, 7, '#3fb0ff');
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.beginPath();
        g.arc(-2.5, -2.5, 2, 0, Math.PI * 2);
        g.fill();
        g.restore();
        return 'url(' + c.toDataURL() + ') 16 16, crosshair';
      };
      return { idle: draw(false), swung: draw(true) };
    },

    hit(ctx, x, y) {
      dmgCtx = ctx;
      const color = randColor();
      const R = rand(14, 22);

      // main blob: dark base = outline so it keeps a silhouette on same-hue pages
      blob(ctx, x, y, R * 1.06, 'rgba(0,0,0,0.35)');
      blob(ctx, x, y, R, color);
      // wet gloss highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(x - R * 0.3, y - R * 0.35, R * 0.28, R * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // satellite droplets flung around
      const drops = 4 + (Math.random() * 5 | 0);
      for (let i = 0; i < drops; i++) {
        const a = rand(0, Math.PI * 2);
        const d = rand(R * 0.9, R * 2.4);
        blob(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, rand(2, 6), color);
      }

      // a couple of tiny specks
      ctx.fillStyle = color;
      for (let i = 0, n = 4 + (Math.random() * 6 | 0); i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const d = rand(R, R * 3);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rand(0.8, 1.8), 0, Math.PI * 2);
        ctx.fill();
      }

      // 1-3 drips that will run downward on the fx layer, then bake in
      const nd = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < nd; i++) {
        const life = rand(0.4, 0.65);
        drips.push({
          x: x + rand(-R * 0.6, R * 0.6),
          y: y + R * 0.5,
          vy: rand(30, 60),
          len: rand(8, 20),
          w: rand(2.5, 5),
          color: color,
          life: life,
          max: life,
        });
      }
    },

    frame(g, dt) {
      for (const d of drips) {
        d.life -= dt;
        d.vy += 260 * dt; // gravity: drips accelerate, not floaty constant slide
        d.y += d.vy * dt;
        // draw the running drip as a rounded vertical streak with a bead head
        const streak = (ctx) => {
          ctx.strokeStyle = d.color;
          ctx.lineCap = 'round';
          ctx.lineWidth = d.w;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y - d.len);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.w * 0.7, 0, Math.PI * 2);
          ctx.fill();
        };
        if (d.life > 0) {
          streak(g);
        } else if (dmgCtx) {
          streak(dmgCtx); // final position bakes into the persistent canvas
        }
      }
      drips = drips.filter((d) => d.life > 0);
      return drips.length > 0;
    },

    // Wet 'splort': short lowpassed noise thump + soft pitch drop.
    sound(ac, dest) {
      const t = ac.currentTime;
      const out = ac.createGain();
      out.gain.value = 0.5;
      out.connect(dest || ac.destination);

      const len = ac.sampleRate * 0.09 | 0;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5) * Math.min(1, i / 8);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(rand(700, 1000), t);
      lp.frequency.exponentialRampToValueAtTime(200, t + 0.09); // wet 'squelch' down-sweep
      src.connect(lp).connect(out);
      src.start(t);

      // soft body plop
      const osc = ac.createOscillator();
      const og = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(rand(200, 300), t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);
      og.gain.setValueAtTime(0.5, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(og).connect(out);
      osc.start(t);
      osc.stop(t + 0.11);
    },

    reset() {
      drips = [];
    },
  });
})();

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

    hit(ctx, x, y) {
      const now = performance.now();
      firing = now;
      fx_x = x; fx_y = y;
      // char the path; a time gap means a fresh start, not a long jump-cut
      if (last && now - last.t < 120) char(ctx, last.x, last.y, x, y);
      else char(ctx, x - 1, y, x, y); // dot at the impact on a fresh press
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

// Weapon: termites — click drops a swarm of ~8-12 bugs that wander on their
// own, gnawing ragged dark holes into the screen as they go, and die out after
// ~10s. Autonomous: the fx loop drives them after the click. The eaten damage
// bakes into the persistent canvas; the bugs live on the fx layer.
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);
  const LIFE = 10;      // seconds each bug lives
  const MAX_BUGS = 220; // safety cap

  let bugs = [];     // {x,y,dir,speed,life,legPhase,gnawAcc}
  let dmgCtx = null; // persistent canvas, captured on first click, for baking holes

  // Draw a tiny termite at b.(x,y) heading b.dir: dark oval body + head + 6
  // flicking legs. Manual trig (no save/rotate/restore, one stroke) — cheap
  // enough to run for every bug each frame up to MAX_BUGS.
  function drawBug(g, b) {
    const cos = Math.cos(b.dir), sin = Math.sin(b.dir);
    const rot = (lx, ly) => [b.x + lx * cos - ly * sin, b.y + lx * sin + ly * cos];
    // legs, one path
    g.strokeStyle = 'rgba(40,30,24,0.9)';
    g.lineWidth = 0.8;
    g.beginPath();
    for (let i = -1; i <= 1; i++) {
      const swing = Math.sin(b.legPhase + i) * 1.4;
      let [x1, y1] = rot(i * 1.6, -1.2), [x2, y2] = rot(i * 1.6 + swing, -3.4);
      g.moveTo(x1, y1); g.lineTo(x2, y2);
      [x1, y1] = rot(i * 1.6, 1.2); [x2, y2] = rot(i * 1.6 - swing, 3.4);
      g.moveTo(x1, y1); g.lineTo(x2, y2);
    }
    g.stroke();
    // body
    g.save();
    g.translate(b.x, b.y);
    g.rotate(b.dir);
    g.fillStyle = '#2c211a';
    g.beginPath();
    g.ellipse(0, 0, 3, 1.8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3c2c22';
    g.beginPath();
    g.arc(3, 0, 1.4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // One ragged gnaw bite onto the persistent canvas at (x,y).
  function gnaw(ctx, x, y) {
    const R = rand(2.5, 4.5);
    ctx.fillStyle = 'rgba(24,16,10,0.55)';
    ctx.beginPath();
    const n = 6 + (Math.random() * 3 | 0);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = R * rand(0.6, 1.3);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // cheap lit inner rim (depth without a per-bite gradient object)
    ctx.fillStyle = 'rgba(60,42,28,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, R * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // pale nibbled fleck every bite — reads on dark pages, sells "ragged"
    ctx.fillStyle = 'rgba(200,180,150,0.35)';
    const a = rand(0, Math.PI * 2);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, rand(0.6, 1.3), 0, Math.PI * 2);
    ctx.fill();
  }

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'termites',

    icon(ctx, size) {
      // one bold bug filling the frame — two tiny ones smudge at 24px
      const s = size / 16;
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.scale(s, s);
      ctx.lineWidth = 1.4;
      drawBug(ctx, { x: 0, y: 0, dir: -0.4, legPhase: 0.6 });
      ctx.restore();
    },

    // A single termite as the cursor, hotspot at its body center.
    cursor(makeCanvas) {
      const draw = () => {
        const c = makeCanvas(24, 24);
        const g = c.getContext('2d');
        g.save();
        g.translate(12, 12);
        g.scale(2, 2);
        drawBug(g, { x: 0, y: 0, dir: -Math.PI / 2, legPhase: 0.5 });
        g.restore();
        return 'url(' + c.toDataURL() + ') 12 12, crosshair';
      };
      const u = draw();
      return { idle: u, swung: u };
    },

    hit(ctx, x, y) {
      dmgCtx = ctx;
      const n = 8 + (Math.random() * 5 | 0);
      for (let i = 0; i < n && bugs.length < MAX_BUGS; i++) {
        bugs.push({
          x: x + rand(-6, 6),
          y: y + rand(-6, 6),
          dir: rand(0, Math.PI * 2),
          speed: rand(35, 70),
          life: LIFE,
          legPhase: rand(0, Math.PI * 2),
          gnawAcc: 0,
        });
      }
      gnaw(ctx, x, y); // initial nibble at the drop point
    },

    frame(g, dt, w, h) {
      for (const b of bugs) {
        b.life -= dt;
        if (b.life <= 0) continue;

        // wander: small heading jitter with persistence
        b.dir += rand(-1.5, 1.5) * dt * 3;
        // near an edge, pull hard toward center (overrides jitter — no corner vibration)
        const margin = 24;
        if (b.x < margin || b.x > w - margin || b.y < margin || b.y > h - margin) {
          const toCenter = Math.atan2(h / 2 - b.y, w / 2 - b.x);
          let diff = toCenter - b.dir;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest angular path
          b.dir += diff * Math.min(1, 8 * dt);
        }

        b.x += Math.cos(b.dir) * b.speed * dt;
        b.y += Math.sin(b.dir) * b.speed * dt;
        b.x = Math.max(4, Math.min(w - 4, b.x));
        b.y = Math.max(4, Math.min(h - 4, b.y));
        b.legPhase += dt * 22;

        // gnaw a bite roughly every 5px travelled
        b.gnawAcc += b.speed * dt;
        if (b.gnawAcc > 5 && dmgCtx) { b.gnawAcc = 0; gnaw(dmgCtx, b.x, b.y); }

        // fade the body over the last second of life
        g.globalAlpha = Math.min(1, b.life);
        drawBug(g, b);
        g.globalAlpha = 1;
      }
      bugs = bugs.filter((b) => b.life > 0);
      return bugs.length > 0;
    },

    // Faint granular skitter: ~14 filtered noise ticks (chitinous, not beepy).
    sound(ac, dest) {
      const out = ac.createGain();
      out.gain.value = 0.35;
      out.connect(dest || ac.destination);
      const t0 = ac.currentTime;
      for (let i = 0; i < 14; i++) {
        const t = t0 + Math.random() * 0.35;
        const len = ac.sampleRate * 0.02 | 0;
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = rand(2500, 5500);
        bp.Q.value = 4;
        const og = ac.createGain();
        og.gain.value = rand(0.15, 0.3);
        src.connect(bp).connect(og).connect(out);
        src.start(t);
      }
    },

    reset() {
      bugs = [];
    },
  });
})();

// Weapon: dynamite — click plants a stick with a ~2s sparking fuse; when it
// burns down it detonates: white flash, screen-shake, scorched crater + cracks
// racing to the screen edges (baked), flying debris + ash. Each stick runs its
// own timer, so a cluster pops in sequence. (Prefixed a0 = sorts after 90.)
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);
  const FUSE = 2000; // ms

  let sticks = [];   // {x,y,born,blown}
  let flashes = [];  // {life,max}
  let debris = [];   // {x,y,vx,vy,rot,vr,life,max,size,shade}
  let ash = [];      // {x,y,vx,vy,life,max,r}
  let liveOuts = []; // per-click output gains, so reset() can silence in-flight fuses
  let dmgCtx = null;

  // Draw a dynamite stick centered at (x,y): red cylinder, label band, fuse
  // rising from the top with a sparking tip that burns down as `progress` → 1.
  function drawStick(g, x, y, progress) {
    g.save();
    g.translate(x, y);
    // fuse (from top of stick curving up-left), remaining length shrinks
    const fuseLen = 14 * (1 - progress);
    g.strokeStyle = '#6b5535';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, -11);
    g.quadraticCurveTo(-6, -14 - fuseLen * 0.5, -3 - fuseLen * 0.4, -11 - fuseLen);
    g.stroke();
    // spark at the burning tip
    const sx = -3 - fuseLen * 0.4, sy = -11 - fuseLen;
    const spark = g.createRadialGradient(sx, sy, 0, sx, sy, rand(4, 7));
    spark.addColorStop(0, 'rgba(255,250,210,0.95)');
    spark.addColorStop(0.5, 'rgba(255,170,40,0.7)');
    spark.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = spark;
    g.beginPath();
    g.arc(sx + rand(-1, 1), sy + rand(-1, 1), rand(4, 7), 0, Math.PI * 2);
    g.fill();
    // stick body
    g.fillStyle = '#c0301f';
    g.strokeStyle = '#7a1c12';
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(-6, -11, 12, 26, 3);
    g.fill();
    g.stroke();
    // label band + highlight
    g.fillStyle = '#f2e2c0';
    g.fillRect(-6, -2, 12, 6);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(-4.5, -10, 2.5, 24);
    g.restore();
  }

  // Baked crater + edge cracks at the blast center.
  function crater(ctx, x, y, w, h) {
    const R = rand(70, 100);
    // scorch
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(6,5,4,0.92)');
    g.addColorStop(0.5, 'rgba(30,18,10,0.7)');
    g.addColorStop(0.8, 'rgba(60,35,18,0.35)');
    g.addColorStop(1, 'rgba(60,35,18,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    // charred irregular rim
    ctx.fillStyle = 'rgba(10,8,6,0.55)';
    ctx.beginPath();
    const rn = 18;
    for (let i = 0; i <= rn; i++) {
      const a = (i / rn) * Math.PI * 2;
      const r = R * 0.62 * rand(0.75, 1.15);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // ember flecks for dark-page readability
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2), r = rand(R * 0.3, R * 0.9);
      ctx.fillStyle = 'rgba(255,' + (rand(120, 180) | 0) + ',40,' + rand(0.2, 0.5).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, rand(0.8, 2), 0, Math.PI * 2);
      ctx.fill();
    }
    // cracks racing to the screen edges
    const maxD = Math.hypot(w, h);
    const nc = 7 + (Math.random() * 3 | 0);
    for (let i = 0; i < nc; i++) {
      const baseA = (i / nc) * Math.PI * 2 + rand(-0.2, 0.2);
      let px = x + Math.cos(baseA) * R * 0.5, py = y + Math.sin(baseA) * R * 0.5;
      let a = baseA;
      const len = rand(maxD * 0.4, maxD * 0.75);
      const steps = 8 + (Math.random() * 5 | 0);
      const pts = [[px, py]];
      for (let s = 0; s < steps; s++) {
        a += rand(-0.3, 0.3);
        px += Math.cos(a) * (len / steps);
        py += Math.sin(a) * (len / steps);
        pts.push([px, py]);
      }
      for (const [dx, dy, style, lw] of [
        [0.8, 0.8, 'rgba(255,255,255,0.22)', 1],
        [0, 0, 'rgba(15,12,10,0.8)', rand(1.2, 2.6)],
      ]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
        for (let s = 1; s < pts.length; s++) ctx.lineTo(pts[s][0] + dx, pts[s][1] + dy);
        ctx.stroke();
      }
    }
  }

  function detonate(s, w, h) {
    crater(dmgCtx, s.x, s.y, w, h);
    flashes.push({ life: 0.32, max: 0.32 });
    if (window.__SMASH__ && window.__SMASH__.shake) window.__SMASH__.shake(22, 500);
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(120, 520);
      debris.push({
        x: s.x, y: s.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(40, 160),
        rot: rand(0, Math.PI * 2), vr: rand(-16, 16),
        life: rand(0.5, 1.1), max: 0,
        size: rand(2, 6), shade: rand(20, 60),
      });
    }
    for (let i = 0; i < 18; i++) {
      ash.push({
        x: s.x + rand(-20, 20), y: s.y + rand(-20, 20),
        vx: rand(-30, 30), vy: rand(-70, -20),
        life: rand(1, 2.2), max: 0, r: rand(6, 16),
      });
    }
  }

  (window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
    name: 'dynamite',

    icon(ctx, size) {
      // drawStick is gameplay-scale; shrink + recenter so fuse+spark+body fit 24px
      const s = (size / 24) * 0.48;
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.scale(s, s);
      ctx.translate(3.8, 6);
      drawStick(ctx, 0, 0, 0.35);
      ctx.restore();
    },

    cursor(makeCanvas) {
      const c = makeCanvas(28, 32);
      const g = c.getContext('2d');
      g.translate(14, 19); // shifted down so the fuse tip fits inside the canvas
      g.scale(0.85, 0.85);
      // simple stick glyph (no live spark) for the cursor
      g.fillStyle = '#c0301f';
      g.strokeStyle = '#7a1c12';
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(-6, -11, 12, 26, 3);
      g.fill();
      g.stroke();
      g.fillStyle = '#f2e2c0';
      g.fillRect(-6, -2, 12, 6);
      g.strokeStyle = '#6b5535';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(0, -11);
      g.quadraticCurveTo(-6, -20, -9, -22);
      g.stroke();
      const u = 'url(' + c.toDataURL() + ') 14 19, crosshair'; // hotspot = stick body center
      return { idle: u, swung: u };
    },

    hit(ctx, x, y) {
      dmgCtx = ctx;
      sticks.push({ x: x, y: y, born: performance.now(), blown: false });
    },

    frame(g, dt, w, h) {
      const now = performance.now();

      // sticks: draw the burning fuse, detonate when it reaches the stick
      for (const s of sticks) {
        const progress = (now - s.born) / FUSE;
        if (progress >= 1 && !s.blown) { s.blown = true; detonate(s, w, h); }
        else if (!s.blown) drawStick(g, s.x, s.y, Math.max(0, progress));
      }
      sticks = sticks.filter((s) => !s.blown);

      // white flash over the whole screen
      for (const f of flashes) {
        if (!f.max) f.max = f.life;
        f.life -= dt;
        if (f.life <= 0) continue;
        const alpha = 0.85 * Math.exp(-5 * (1 - f.life / f.max)); // fast drop then trail — punchy
        g.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        g.fillRect(0, 0, w, h);
      }
      flashes = flashes.filter((f) => f.life > 0);

      // ash (behind debris), drifting up
      for (const p of ash) {
        if (!p.max) p.max = p.life;
        p.life -= dt;
        if (p.life <= 0) continue;
        p.vy += 8 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.r += 8 * dt;
        const a = 0.3 * (p.life / p.max);
        const sg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        sg.addColorStop(0, 'rgba(90,84,80,' + a.toFixed(3) + ')');
        sg.addColorStop(1, 'rgba(90,84,80,0)');
        g.fillStyle = sg;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
      ash = ash.filter((p) => p.life > 0);

      // debris chunks with gravity
      for (const d of debris) {
        if (!d.max) d.max = d.life;
        d.life -= dt;
        if (d.life <= 0) continue;
        d.vy += 900 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        d.rot += d.vr * dt;
        const sh = d.shade | 0;
        g.save();
        g.translate(d.x, d.y);
        g.rotate(d.rot);
        g.fillStyle = 'rgba(' + (sh + 15) + ',' + sh + ',' + Math.max(0, sh - 8) + ',' + Math.min(1, d.life * 2).toFixed(2) + ')';
        g.fillRect(-d.size / 2, -d.size / 2, d.size, d.size * rand(0.6, 1));
        g.restore();
      }
      debris = debris.filter((d) => d.life > 0 && d.y < h + 40);

      return sticks.length + flashes.length + debris.length + ash.length > 0;
    },

    // Fuse hiss for FUSE ms, then a deep boom + crack + rumble tail. Scheduled
    // at click time (WebAudio is sample-accurate; visual timer matches at 2s).
    sound(ac, dest) {
      const out = ac.createGain();
      out.gain.value = 0.8;
      out.connect(dest || ac.destination);
      liveOuts.push(out); // reset() can silence this in-flight fuse before it booms
      setTimeout(() => { liveOuts = liveOuts.filter((o) => o !== out); }, FUSE + 1400);
      const t0 = ac.currentTime;
      const tBoom = t0 + FUSE / 1000;

      // fuse hiss: gated highpass noise over the 2s burn
      const hlen = ac.sampleRate * (FUSE / 1000) | 0;
      const hbuf = ac.createBuffer(1, hlen, ac.sampleRate);
      const hd = hbuf.getChannelData(0);
      for (let i = 0; i < hlen; i++) hd[i] = (Math.random() * 2 - 1) * 0.5;
      const hiss = ac.createBufferSource();
      hiss.buffer = hbuf;
      const hhp = ac.createBiquadFilter();
      hhp.type = 'highpass';
      hhp.frequency.value = 3500;
      const hg = ac.createGain();
      hg.gain.value = 0.12;
      hiss.connect(hhp).connect(hg).connect(out);
      hiss.start(t0);

      // crack transient
      const clen = ac.sampleRate * 0.12 | 0;
      const cbuf = ac.createBuffer(1, clen, ac.sampleRate);
      const cd = cbuf.getChannelData(0);
      for (let i = 0; i < clen; i++) cd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / clen, 1.5) * Math.min(1, i / 8);
      const crack = ac.createBufferSource();
      crack.buffer = cbuf;
      const chp = ac.createBiquadFilter();
      chp.type = 'highpass';
      chp.frequency.value = 1200;
      crack.connect(chp).connect(out);
      crack.start(tBoom);

      // deep boom
      const boom = ac.createOscillator();
      const bg = ac.createGain();
      boom.frequency.setValueAtTime(90, tBoom);
      boom.frequency.exponentialRampToValueAtTime(28, tBoom + 0.4);
      bg.gain.setValueAtTime(1.0, tBoom);
      bg.gain.exponentialRampToValueAtTime(0.001, tBoom + 0.6);
      boom.connect(bg).connect(out);
      boom.start(tBoom);
      boom.stop(tBoom + 0.65);

      // rumble tail: lowpass noise decaying over ~1.2s
      const rlen = ac.sampleRate * 1.2 | 0;
      const rbuf = ac.createBuffer(1, rlen, ac.sampleRate);
      const rd = rbuf.getChannelData(0);
      for (let i = 0; i < rlen; i++) rd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rlen, 2);
      const rumble = ac.createBufferSource();
      rumble.buffer = rbuf;
      const rlp = ac.createBiquadFilter();
      rlp.type = 'lowpass';
      rlp.frequency.value = 220;
      const rg = ac.createGain();
      rg.gain.value = 0.7;
      rumble.connect(rlp).connect(rg).connect(out);
      rumble.start(tBoom);
    },

    reset() {
      sticks = [];
      flashes = [];
      debris = [];
      ash = [];
      // silence any lit-but-not-yet-boomed fuses (their audio is already scheduled)
      for (const out of liveOuts) {
        const t = out.context.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + 0.03); // 30ms fade, no click
      }
      liveOuts = [];
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
    ctx.clearRect(0, 0, innerWidth, innerHeight);
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
        const prev = [bar, fx, canvas].map((el) => el.style.display);
        bar.style.display = fx.style.display = canvas.style.display = 'none';
        try {
          // setTimeout (not rAF) so the hide still lands even if rendering is throttled
          await new Promise((r) => setTimeout(r, 32));
          backdrop = await host.capture();
        } catch (e) { backdrop = null; }
        [bar, fx, canvas].forEach((el, i) => (el.style.display = prev[i]));
      }

      const W = canvas.width, H = canvas.height;
      const out = makeCanvas(W, H);
      const octx = out.getContext('2d');
      let noteBackdropMissing = !!(host && host.capture) && !backdrop;
      if (backdrop) {
        await new Promise((res) => {
          const img = new Image();
          img.onload = () => { octx.drawImage(img, 0, 0, W, H); octx.drawImage(canvas, 0, 0); res(); };
          img.onerror = () => { noteBackdropMissing = true; octx.drawImage(canvas, 0, 0); res(); };
          img.src = backdrop;
        });
      } else {
        octx.drawImage(canvas, 0, 0);
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
    canvas.remove();
    fx.remove();
    bar.remove();
    if (previewDim) { previewDim.remove(); previewDim = null; } // don't leak an open preview
    clearTimeout(swingTimer);
    if (ac) ac.close();
    tools.forEach((t) => t.reset && t.reset());
    delete window.__SMASH__;
    delete window.__SMASH_TOOLS__; // concat re-registers tools on next injection
    delete window.__SMASH_HOST__;  // extension re-injects host.js; desktop is closing anyway
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

  doc.documentElement.appendChild(canvas);
  doc.documentElement.appendChild(fx);
  doc.documentElement.appendChild(bar);
  arm(0);
  collapse();

  window.__SMASH__ = { quit: quit, reset: reset, shake: shake };
})();
