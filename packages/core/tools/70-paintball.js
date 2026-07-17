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
