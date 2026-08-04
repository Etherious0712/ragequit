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

    hit(ctx, x, y, api) {
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
      // breach last so the hole survives this shot's own art; the floor keeps the
      // exposed area big enough for the strata detail to actually read
      if (api) api.breach(x, y, Math.max(R * 1.8, 18), 1.15);
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
