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

    hit(ctx, x, y, api) {
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
      // breach last so this shatter's own art doesn't cover the hole; spidering
      // glass barely goes past the surface, so it takes many hits to break through
      if (api) api.breach(x, y, 18, 0.2);
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
