// ragequit hardware guts — what's *under* the screen.
//
// The engine keeps a depth grid (0 = pristine glass, 5 = punched clean through)
// and a dedicated canvas beneath the damage layer. Weapons call
// api.breach(x, y, radius, amount); this module paints the strata that the
// breach has exposed, so holes reveal LCD → backlight → PCB → chassis instead of
// a flat black core. Registers as window.__SMASH_GUTS__ before the engine runs.
(function () {
  'use strict';

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.random() * arr.length | 0];

  // ---- transient state (fx layer) ----
  let sparks = [];   // {x,y,vx,vy,life,max}
  let shards = [];   // {x,y,vx,vy,rot,vr,size,life,max,tone}
  let cables = [];   // {x,y,len,ang,vel,w,hue} dangling ribbon cables
  let breaches = []; // {x,y,r,depth,born} remembered for flicker/bleed/glitch
  let glitchUntil = 0;

  // Torn edge — never a clean circle and never a readable polygon. Lots of
  // vertices with per-vertex jitter plus occasional deep "bites" (snapped-off
  // chunks), so the boundary reads as ripped material at any radius.
  function blobPath(g, x, y, r, wobble) {
    g.beginPath();
    const n = 34 + (Math.random() * 14 | 0);
    const seed = rand(0, Math.PI * 2);
    // Smooth lobing carries the silhouette; per-vertex noise stays small so the
    // outline reads as a ragged hole rather than a sawtooth starburst.
    let drift = 0;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      drift = drift * 0.7 + rand(-wobble, wobble) * 0.3; // correlated, not white noise
      let k = 1 + Math.sin(a * 3 + seed) * wobble * 0.5
                + Math.sin(a * 6.7 - seed * 2) * wobble * 0.22
                + drift;
      if (Math.random() < 0.035) k -= rand(wobble * 0.4, wobble * 0.9); // small snapped chip
      const rr = Math.max(r * 0.55, r * k);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }

  // ---- strata (each draws INSIDE an already-clipped blob) ----

  // 1) LCD panel: pixel grid + polarizer sheen + bled liquid-crystal colour.
  function drawLcd(g, x, y, r) {
    g.fillStyle = '#0d1014';
    g.fillRect(x - r, y - r, r * 2, r * 2);
    // subpixel grid
    const step = 3;
    for (let py = y - r; py < y + r; py += step) {
      for (let px = x - r; px < x + r; px += step) {
        g.fillStyle = pick(['rgba(255,60,60,0.5)', 'rgba(60,255,90,0.5)', 'rgba(70,110,255,0.5)']);
        g.fillRect(px, py, 1.2, step - 0.8);
      }
    }
    // polarizer rainbow sheen — the giveaway that this is a panel, not paint
    const sheen = g.createLinearGradient(x - r, y - r, x + r, y + r);
    sheen.addColorStop(0, 'rgba(120,200,255,0.30)');
    sheen.addColorStop(0.4, 'rgba(190,120,255,0.20)');
    sheen.addColorStop(0.7, 'rgba(120,255,200,0.20)');
    sheen.addColorStop(1, 'rgba(255,180,120,0.28)');
    g.fillStyle = sheen;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    // bled crystal: dark inky smears creeping from the break. Kept small and
    // semi-transparent — bigger blobs swamp the subpixel grid, which is the only
    // cue that this is a screen panel and not just a dark surface.
    for (let i = 0; i < 3; i++) {
      const a = rand(0, Math.PI * 2), d = rand(0, r * 0.7);
      const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d;
      const bl = g.createRadialGradient(bx, by, 0, bx, by, rand(r * 0.15, r * 0.35));
      bl.addColorStop(0, 'rgba(8,6,20,0.55)');
      bl.addColorStop(1, 'rgba(8,6,20,0)');
      g.fillStyle = bl;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  // 2) Backlight / diffuser: the bright white sheet that makes it read as "broken screen".
  function drawBacklight(g, x, y, r) {
    // Flat sheet, not a glowing ball: near-uniform fill with a slight directional
    // gradient. A radial falloff here reads as a 3D bubble, which is wrong.
    const bg = g.createLinearGradient(x - r, y - r, x + r, y + r);
    bg.addColorStop(0, 'rgba(252,253,255,0.97)');
    bg.addColorStop(0.5, 'rgba(240,247,255,0.95)');
    bg.addColorStop(1, 'rgba(226,238,252,0.93)');
    g.fillStyle = bg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    // diffuser dot pattern + a couple of light-guide streaks
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      g.arc(x + rand(-r, r), y + rand(-r, r), rand(0.6, 1.6), 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const yy = y + rand(-r, r);
      g.beginPath(); g.moveTo(x - r, yy); g.lineTo(x + r, yy); g.stroke();
    }
  }

  // 3) Circuit board: PCB, copper traces, chips, solder, ribbon connector.
  function drawPcb(g, x, y, r) {
    g.fillStyle = pick(['#12492f', '#123f52', '#1d3a1c']);
    g.fillRect(x - r, y - r, r * 2, r * 2);
    // copper traces: right-angle runs, the signature PCB look
    g.strokeStyle = 'rgba(215,170,80,0.75)';
    g.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
      let px = x + rand(-r, r), py = y + rand(-r, r);
      g.beginPath();
      g.moveTo(px, py);
      for (let s = 0; s < 3; s++) {
        if (Math.random() < 0.5) px += rand(-r * 0.5, r * 0.5);
        else py += rand(-r * 0.5, r * 0.5);
        g.lineTo(px, py);
      }
      g.stroke();
    }
    // solder pads
    for (let i = 0; i < 18; i++) {
      const px = x + rand(-r, r), py = y + rand(-r, r);
      g.fillStyle = 'rgba(200,205,215,0.85)';
      g.beginPath(); g.arc(px, py, rand(1, 2.2), 0, Math.PI * 2); g.fill();
    }
    // chips
    for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) {
      const cw = rand(r * 0.25, r * 0.5), ch = rand(r * 0.18, r * 0.35);
      const px = x + rand(-r * 0.7, r * 0.7 - cw), py = y + rand(-r * 0.7, r * 0.7 - ch);
      g.fillStyle = '#15161a';
      g.fillRect(px, py, cw, ch);
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 0.7;
      g.strokeRect(px, py, cw, ch);
      g.fillStyle = 'rgba(190,195,205,0.8)'; // leg pins
      for (let l = px + 2; l < px + cw - 1; l += 3) {
        g.fillRect(l, py - 1.5, 1.4, 1.5);
        g.fillRect(l, py + ch, 1.4, 1.5);
      }
    }
  }

  // 4) Chassis void: you've punched clean through — dark metal, wires, a screw.
  function drawChassis(g, x, y, r) {
    g.fillStyle = '#07080a';
    g.fillRect(x - r, y - r, r * 2, r * 2);
    const lip = g.createRadialGradient(x, y, r * 0.35, x, y, r);
    lip.addColorStop(0, 'rgba(0,0,0,0.95)');
    lip.addColorStop(1, 'rgba(70,75,85,0.55)'); // metal lip catching light
    g.fillStyle = lip;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    // loose wires
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = pick(['#c0392b', '#e0a92b', '#2b6fc0', '#eeeeee', '#333']);
      g.lineWidth = rand(1.2, 2.4);
      g.beginPath();
      const sx = x + rand(-r, r), sy = y - r;
      g.moveTo(sx, sy);
      g.bezierCurveTo(sx + rand(-r, r), y, x + rand(-r, r), y + rand(0, r), x + rand(-r, r), y + r);
      g.stroke();
    }
    // a screw boss
    if (Math.random() < 0.5) {
      const px = x + rand(-r * 0.6, r * 0.6), py = y + rand(-r * 0.6, r * 0.6);
      g.fillStyle = 'rgba(120,126,138,0.9)';
      g.beginPath(); g.arc(px, py, rand(2.5, 4), 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,22,26,0.9)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(px - 2.5, py); g.lineTo(px + 2.5, py); g.stroke();
    }
  }

  const STRATA = [drawLcd, drawBacklight, drawPcb, drawChassis];

  // A dangling ribbon cable, drawn wherever it currently hangs. Used both for the
  // live swing (fx canvas) and for the one-time bake once it comes to rest.
  function drawCable(g, c) {
    const ex = c.x + Math.sin(c.ang) * c.len, ey = c.y + Math.cos(c.ang) * c.len;
    const mx = c.x + Math.sin(c.ang) * c.len * 0.5, my = c.y + c.len * 0.45;
    const grad = g.createLinearGradient(c.x, c.y, ex, ey);
    grad.addColorStop(0, 'hsl(' + c.hue + ',65%,45%)');
    grad.addColorStop(1, 'hsl(' + c.hue + ',60%,32%)');
    g.strokeStyle = grad;
    g.lineWidth = c.w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(c.x, c.y);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    // conductor stripes down the ribbon
    g.strokeStyle = 'rgba(190,160,90,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(c.x, c.y);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
  }

  window.__SMASH_GUTS__ = {
    // Paint the strata exposed by a breach. `d` is the deepest value reached;
    // each layer is drawn in a progressively smaller blob so the cross-section
    // reads as strata — shallow ring outside, deepest core in the middle.
    paint(g, x, y, radius, d, depthAt) {
      if (d < 1) return; // still just cracked glass — the damage layer covers it
      const layers = Math.min(4, Math.floor(d));
      let cx = x, cy = y;
      for (let i = 0; i < layers; i++) {
        // layer i occupies a shrinking share of the breach radius, and each
        // deeper layer drifts slightly off-centre so the strata aren't
        // perfectly nested rings (that reads as stacked stickers, not damage)
        const r = radius * (1 - i * 0.17);
        if (r < 3) break;
        if (i) { cx += rand(-radius * 0.07, radius * 0.07); cy += rand(-radius * 0.07, radius * 0.07); }
        g.save();
        blobPath(g, cx, cy, r, 0.26);
        g.clip();
        STRATA[i](g, cx, cy, r);
        // inner shadow around the rim: sells "looking down into a hole" rather
        // than a flat sticker pasted on the screen
        const sh = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
        sh.addColorStop(0, 'rgba(0,0,0,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.6)');
        g.fillStyle = sh;
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
        g.restore();
      }
      breaches.push({ x: x, y: y, r: radius, depth: d, born: performance.now() });
      if (breaches.length > 140) breaches.shift(); // ponytail: cap; oldest stop flickering

      // debris + sparks scale with how deep this hit went
      this.spark(x, y, 3 + layers * 3);
      for (let i = 0; i < 2 + layers; i++) {
        shards.push({
          x: x, y: y,
          vx: rand(-120, 120), vy: rand(-260, -60),
          rot: rand(0, Math.PI * 2), vr: rand(-14, 14),
          size: rand(3, 8), life: rand(1.2, 2.4), max: 0,
          tone: Math.random() < 0.5 ? 210 : 190,
        });
      }
      // deep tears let a ribbon cable flop out
      // a thin ribbon cable occasionally flops out of a deep tear (rare and
      // slender on purpose — a fat one reads as a plank, not a cable)
      if (d >= 3.5 && cables.length < 6 && Math.random() < 0.16) {
        cables.push({
          x: x + rand(-radius * 0.4, radius * 0.4), y: y,
          len: rand(16, 40), ang: rand(-0.4, 0.4), vel: 0,
          settle: rand(1.5, 3), done: false, // min swing time before it can bake out
          w: rand(2.5, 4.5), hue: pick([38, 45, 30]),
        });
      }
      if (d >= 2 && Math.random() < 0.35) glitchUntil = performance.now() + rand(120, 400);
    },

    // Punch the hole open in the DAMAGE layer: erase the accumulated cracks and
    // char inside the breach so the hardware underneath is actually visible
    // (without this, repeated hits bury the guts under their own dark art), then
    // ring it with a torn rim so it never looks like a clean cookie-cutter cut.
    punch(dctx, x, y, r) {
      dctx.save();
      dctx.globalCompositeOperation = 'destination-out';
      blobPath(dctx, x, y, r * 0.92, 0.22);
      dctx.fill();
      dctx.restore();
      // torn rim: dark broken edge + a few bright chipped glints
      dctx.save();
      dctx.lineJoin = 'round';
      blobPath(dctx, x, y, r * 0.94, 0.22);
      dctx.strokeStyle = 'rgba(12,14,20,0.85)';
      dctx.lineWidth = rand(1.5, 3);
      dctx.stroke();
      dctx.strokeStyle = 'rgba(225,235,250,0.35)';
      dctx.lineWidth = 1;
      dctx.stroke();
      dctx.restore();
    },

    spark(x, y, n) {
      for (let i = 0; i < n; i++) {
        sparks.push({
          x: x, y: y,
          vx: rand(-260, 260), vy: rand(-300, 60),
          life: rand(0.18, 0.5), max: 0,
        });
      }
    },

    // Electrical zap for a fresh breach — short, bright, band-passed noise + a
    // falling whine. Weapons call this via the engine when they punch through.
    zap(ac, dest) {
      const t = ac.currentTime;
      const out = ac.createGain();
      out.gain.value = 0.28;
      out.connect(dest || ac.destination);
      const len = ac.sampleRate * 0.12 | 0;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * Math.min(1, i / 8);
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(rand(2600, 4200), t);
      bp.frequency.exponentialRampToValueAtTime(700, t + 0.12);
      bp.Q.value = 3;
      src.connect(bp).connect(out);
      src.start(t);
    },

    // Animated bits, driven by the engine's fx loop. `fg` = transient fx canvas,
    // `gg` = the persistent guts canvas (used for flicker overlays).
    frame(fg, gg, dt, w, h) {
      const now = performance.now();

      // sparks: additive, gravity, quick fade
      fg.save();
      fg.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        if (!s.max) s.max = s.life;
        s.life -= dt;
        if (s.life <= 0) continue;
        s.vy += 700 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        const k = s.life / s.max;
        fg.fillStyle = 'rgba(255,' + (200 + 55 * k | 0) + ',150,' + k.toFixed(2) + ')';
        fg.beginPath();
        fg.arc(s.x, s.y, 1.4 * k + 0.5, 0, Math.PI * 2);
        fg.fill();
      }
      fg.restore();
      sparks = sparks.filter((s) => s.life > 0);

      // falling shards of screen/plastic
      for (const s of shards) {
        if (!s.max) s.max = s.life;
        s.life -= dt;
        if (s.life <= 0) continue;
        s.vy += 900 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.rot += s.vr * dt;
        if (s.y > h - 4) { s.y = h - 4; s.vy *= -0.25; s.vx *= 0.6; s.vr *= 0.5; }
        const a = Math.min(1, s.life);
        fg.save();
        fg.translate(s.x, s.y);
        fg.rotate(s.rot);
        fg.fillStyle = 'rgba(' + s.tone + ',' + (s.tone + 15) + ',' + (s.tone + 30) + ',' + (a * 0.75).toFixed(2) + ')';
        fg.beginPath();
        fg.moveTo(-s.size / 2, -s.size / 3);
        fg.lineTo(s.size / 2, -s.size / 2);
        fg.lineTo(s.size / 3, s.size / 2);
        fg.closePath();
        fg.fill();
        fg.strokeStyle = 'rgba(255,255,255,' + (a * 0.5).toFixed(2) + ')';
        fg.lineWidth = 0.6;
        fg.stroke();
        fg.restore();
      }
      shards = shards.filter((s) => s.life > 0 && s.x > -30 && s.x < w + 30);

      // dangling ribbon cables — lazy pendulum from the tear they fell out of.
      // Once one stops swinging it is baked into the persistent guts canvas and
      // dropped from the live list, so a hanging cable can't keep the rAF loop
      // running forever (it stays visible; it just stops costing frames).
      for (const c of cables) {
        c.vel += -Math.sin(c.ang) * 6 * dt;   // gravity restoring toward straight down
        c.vel *= 0.99;                         // damping
        c.ang += c.vel * dt;
        c.settle -= dt;
        // hard deadline, not a velocity test: a lightly-damped pendulum can swing
        // below any threshold forever, which would pin the rAF loop on for the
        // whole session. By now the swing is tiny, so baking mid-swing is invisible.
        const atRest = c.settle <= 0;
        drawCable(atRest ? gg : fg, c);
        c.done = atRest;
      }
      cables = cables.filter((c) => !c.done);

      // flicker: exposed panel areas pulse; occasional glitch band tears across
      let flickering = false;
      for (const b of breaches) {
        if (b.depth < 1 || b.depth >= 3) continue; // only live panel/backlight flickers
        if (Math.random() < 0.06) {
          flickering = true;
          fg.save();
          fg.globalCompositeOperation = 'lighter';
          fg.fillStyle = 'rgba(120,170,255,' + rand(0.05, 0.16).toFixed(2) + ')';
          blobPath(fg, b.x, b.y, b.r * 0.9, 0.15);
          fg.fill();
          fg.restore();
        }
      }
      if (now < glitchUntil && breaches.length) {
        const b = breaches[breaches.length - 1];
        const yy = b.y + rand(-b.r, b.r);
        fg.fillStyle = 'rgba(150,220,255,0.22)';
        fg.fillRect(0, yy, w, rand(2, 9));
        fg.fillStyle = 'rgba(255,80,120,0.16)';
        fg.fillRect(0, yy + rand(-6, 6), w, rand(1, 4));
        flickering = true;
      }

      return sparks.length + shards.length + cables.length > 0 || flickering ||
             now < glitchUntil;
    },

    reset() {
      sparks = [];
      shards = [];
      cables = [];
      breaches = [];
      glitchUntil = 0;
    },
  };
})();
