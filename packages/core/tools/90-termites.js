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
  let breachApi = null; // stashed on drop; bugs keep chewing from frame() afterwards

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

    hit(ctx, x, y, api) {
      dmgCtx = ctx;
      breachApi = api;
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
        if (b.gnawAcc > 5 && dmgCtx) {
          b.gnawAcc = 0;
          gnaw(dmgCtx, b.x, b.y);
          // slow but relentless: a swarm left alone eats right through the panel
          if (breachApi) breachApi.breach(b.x, b.y, 14, 0.12);
        }

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
