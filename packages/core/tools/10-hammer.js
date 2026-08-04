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
    // Heavy blunt force — punches deep fast, so a few hits on one spot go through.
    hit(ctx, x, y, api) {
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
      // breach LAST: punching the hole must happen after this hit's own art, or
      // the bruise above would paint straight back over the exposed hardware
      if (api) api.breach(x, y, R * 0.95, rand(0.55, 0.9));
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
