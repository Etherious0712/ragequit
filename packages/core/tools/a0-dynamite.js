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
