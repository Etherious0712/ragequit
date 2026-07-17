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
