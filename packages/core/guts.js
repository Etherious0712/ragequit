// ragequit hardware guts — what's *under* the screen, modelled as the OSI stack.
//
// The engine keeps a depth grid (0 = pristine glass, 5 = punched clean through)
// and a dedicated canvas beneath the damage layer. Weapons call
// api.breach(x, y, radius, amount); this module paints the strata that the
// breach has exposed. The surface is L7 Application (the page); digging peels
// L6 Presentation → L5 Session → L4 Transport → L3 Network → L2 Data Link →
// L1 Physical (circuit board, copper, fibre, chassis). Also owns the ambient
// circuit audio (mains hum, crackle). Registers as window.__SMASH_GUTS__ before the engine runs.
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

  // ---- OSI strata (each draws INSIDE an already-clipped blob) ----
  // The surface is L7 Application: the page itself plus the damage layer's
  // cracks. Each breach level peels one layer further down the stack, ending at
  // L1 Physical — the actual copper, fibre and circuit board.

  const hex = (n) => {
    let s = '';
    for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.random() * 16 | 0];
    return s;
  };
  const mono = (px) => 'bold ' + px + 'px ui-monospace,Menlo,Consolas,monospace';
  // Scatter short labels across the blob. Font scales with the hole but stays
  // readable-ish; tiny holes just get texture, which is fine.
  function scatterText(g, x, y, r, words, color, n) {
    const fs = Math.max(6, Math.min(11, r * 0.16)) | 0;
    g.font = mono(fs);
    g.textBaseline = 'middle';
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      g.fillText(typeof words === 'function' ? words() : pick(words),
        x + rand(-r, r * 0.6), y + rand(-r * 0.9, r * 0.9));
    }
  }

  // L6 Presentation: the rendering/encoding layer falling apart — JPEG
  // macroblocks, RGB channel split, hex dumps and mojibake.
  function drawPresentation(g, x, y, r) {
    g.fillStyle = '#141019';
    g.fillRect(x - r, y - r, r * 2, r * 2);
    const B = Math.max(6, Math.min(12, r * 0.14));
    for (let py = y - r; py < y + r; py += B) {
      for (let px = x - r; px < x + r; px += B) {
        if (Math.random() < 0.55) continue;
        const h = pick([330, 190, 50, 280, 120]);
        g.fillStyle = 'hsla(' + h + ',' + (50 + Math.random() * 40 | 0) + '%,' + (25 + Math.random() * 35 | 0) + '%,0.8)';
        g.fillRect(px, py, B, B);
        if (Math.random() < 0.3) { // smeared DCT stripes inside the block
          g.fillStyle = 'rgba(255,255,255,0.12)';
          for (let s = 0; s < B; s += 2) g.fillRect(px, py + s, B, 1);
        }
      }
    }
    // chromatic split: offset red/cyan bars
    for (let i = 0; i < 4; i++) {
      const yy = y + rand(-r, r), hh = rand(2, 6);
      g.fillStyle = 'rgba(255,40,80,0.35)';
      g.fillRect(x - r, yy, r * 2, hh);
      g.fillStyle = 'rgba(40,230,255,0.35)';
      g.fillRect(x - r + rand(3, 7), yy + rand(1, 3), r * 2, hh);
    }
    scatterText(g, x, y, r, () => hex(2) + ' ' + hex(2) + ' ' + hex(2) + ' ' + hex(2), 'rgba(235,225,255,0.85)', 5);
    scatterText(g, x, y, r, ['Ã©', 'â€™', '��', 'UTF-8?', '%E2%80', '&#x2F;', 'base64', 'gzip'], 'rgba(255,210,120,0.9)', 4);
  }

  // L5 Session: open dialogues between endpoints — nodes, dotted keep-alive
  // arcs, session ids and tokens.
  function drawSession(g, x, y, r) {
    const bg = g.createLinearGradient(x - r, y - r, x + r, y + r);
    bg.addColorStop(0, '#0d1633');
    bg.addColorStop(1, '#1a0f33');
    g.fillStyle = bg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    const nodes = [];
    for (let i = 0; i < 5; i++) nodes.push([x + rand(-r * 0.8, r * 0.8), y + rand(-r * 0.8, r * 0.8)]);
    g.setLineDash([2, 3]);
    g.lineWidth = 1.2;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i], b = nodes[(i + 1 + (Math.random() * 2 | 0)) % nodes.length];
      g.strokeStyle = pick(['rgba(140,170,255,0.8)', 'rgba(200,140,255,0.75)']);
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.quadraticCurveTo((a[0] + b[0]) / 2 + rand(-r * 0.4, r * 0.4), (a[1] + b[1]) / 2 + rand(-r * 0.4, r * 0.4), b[0], b[1]);
      g.stroke();
    }
    g.setLineDash([]);
    for (const n of nodes) {
      g.fillStyle = 'rgba(180,200,255,0.95)';
      g.beginPath(); g.arc(n[0], n[1], 2.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(180,200,255,0.35)';
      g.beginPath(); g.arc(n[0], n[1], 5.5, 0, Math.PI * 2); g.stroke();
    }
    scatterText(g, x, y, r, () => pick(['sid=', 'token:', 'cookie=', 'RPC#']) + hex(6), 'rgba(205,190,255,0.9)', 4);
    scatterText(g, x, y, r, ['KEEPALIVE', 'RESUME', 'CHECKPOINT', 'SYNC', 'TIMEOUT'], 'rgba(255,170,220,0.85)', 2);
  }

  // L4 Transport: segments in flight — header-striped packets, SEQ/ACK, ports.
  function drawTransport(g, x, y, r) {
    g.fillStyle = '#10201e';
    g.fillRect(x - r, y - r, r * 2, r * 2);
    // flow lanes
    g.strokeStyle = 'rgba(90,220,190,0.18)';
    g.lineWidth = 1;
    for (let yy = y - r; yy < y + r; yy += 9) { g.beginPath(); g.moveTo(x - r, yy); g.lineTo(x + r, yy); g.stroke(); }
    const fs = Math.max(6, Math.min(10, r * 0.14)) | 0;
    g.font = mono(fs);
    g.textBaseline = 'middle';
    for (let i = 0; i < 7; i++) {
      const pw = rand(r * 0.45, r * 0.9), ph = fs * 2.4;
      const px = x + rand(-r, r * 0.5), py = y + rand(-r, r - ph);
      g.fillStyle = 'rgba(20,60,55,0.95)';
      g.fillRect(px, py, pw, ph);
      g.fillStyle = pick(['rgba(80,230,190,0.9)', 'rgba(250,200,90,0.9)', 'rgba(255,120,110,0.9)']);
      g.fillRect(px, py, pw * 0.3, ph); // header
      g.strokeStyle = 'rgba(150,255,220,0.45)';
      g.lineWidth = 0.8;
      g.strokeRect(px, py, pw, ph);
      g.fillStyle = 'rgba(10,20,20,0.95)';
      g.fillText(pick(['SYN', 'ACK', 'FIN', 'PSH', 'RST', 'UDP']), px + 2, py + ph * 0.5);
      g.fillStyle = 'rgba(200,255,235,0.9)';
      g.fillText(pick(['SEQ ', 'ACK ', 'WIN ', ':']) + (Math.random() * 65535 | 0), px + pw * 0.33, py + ph * 0.5);
      // flow arrow
      g.fillStyle = 'rgba(150,255,220,0.6)';
      g.beginPath();
      g.moveTo(px + pw + 2, py + ph * 0.2); g.lineTo(px + pw + 7, py + ph * 0.5); g.lineTo(px + pw + 2, py + ph * 0.8);
      g.fill();
    }
  }

  // L3 Network: a routing graph — routers, hop lines, IP addresses.
  function drawNetwork(g, x, y, r) {
    g.fillStyle = '#1c1030';
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.strokeStyle = 'rgba(160,120,255,0.12)'; // map grid
    g.lineWidth = 1;
    for (let v = -r; v < r; v += 12) {
      g.beginPath(); g.moveTo(x + v, y - r); g.lineTo(x + v, y + r); g.stroke();
      g.beginPath(); g.moveTo(x - r, y + v); g.lineTo(x + r, y + v); g.stroke();
    }
    const nodes = [];
    for (let i = 0; i < 6; i++) nodes.push([x + rand(-r * 0.85, r * 0.85), y + rand(-r * 0.85, r * 0.85)]);
    g.lineWidth = 1.4;
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i], b = nodes[Math.random() * i | 0];
      g.strokeStyle = 'rgba(190,140,255,0.7)';
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      // hop marker travelling along the link
      const t = Math.random();
      g.fillStyle = 'rgba(255,230,120,0.95)';
      g.beginPath(); g.arc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1.8, 0, Math.PI * 2); g.fill();
    }
    const fs = Math.max(6, Math.min(10, r * 0.13)) | 0;
    g.font = mono(fs);
    g.textBaseline = 'middle';
    for (const n of nodes) {
      g.fillStyle = '#2a1a4a';
      g.strokeStyle = 'rgba(210,180,255,0.95)';
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(n[0], n[1], 4.2, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(230,215,255,0.9)';
      g.fillText(pick(['10.0.', '192.168.', '172.16.']) + (Math.random() * 255 | 0) + '.' + (1 + Math.random() * 254 | 0), n[0] + 6, n[1] - 5);
    }
    scatterText(g, x, y, r, ['TTL=64', 'TTL=12', 'hop 3', 'ICMP', '/24', 'route'], 'rgba(255,190,240,0.8)', 2);
  }

  // L2 Data Link: raw frames — bitstream grid, MAC addresses, preambles.
  function drawDataLink(g, x, y, r) {
    g.fillStyle = '#050d07';
    g.fillRect(x - r, y - r, r * 2, r * 2);
    const fs = Math.max(6, Math.min(9, r * 0.12)) | 0;
    g.font = mono(fs);
    g.textBaseline = 'top';
    for (let py = y - r; py < y + r; py += fs + 1) {
      let row = '';
      for (let i = 0; i < 40; i++) row += Math.random() < 0.5 ? '0' : '1';
      g.fillStyle = 'rgba(70,255,120,' + rand(0.25, 0.7).toFixed(2) + ')';
      g.fillText(row, x - r + rand(-6, 0), py);
    }
    // frame boundaries: preamble bars
    for (let i = 0; i < 3; i++) {
      const yy = y + rand(-r, r);
      g.fillStyle = 'rgba(120,255,160,0.55)';
      for (let px = x - r; px < x + r; px += 4) g.fillRect(px, yy, 2, 3);
    }
    const mac = () => [hex(2), hex(2), hex(2), hex(2), hex(2), hex(2)].join(':');
    g.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      const tx = x + rand(-r, r * 0.3), ty = y + rand(-r * 0.8, r * 0.8);
      const s = mac();
      g.fillStyle = 'rgba(0,0,0,0.75)';
      g.fillRect(tx - 1, ty - fs * 0.6, g.measureText(s).width + 2, fs * 1.2);
      g.fillStyle = 'rgba(190,255,200,0.95)';
      g.fillText(s, tx, ty);
    }
    scatterText(g, x, y, r, ['ETH', 'VLAN 10', 'FCS', 'ARP', '0x0800'], 'rgba(255,240,140,0.85)', 2);
  }

  // Circuit board detail used by L1: PCB, copper traces, chips, solder.
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

  // Chassis void used by L1: dark metal, loose wires, a screw.
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

  // L1 Physical: the bottom of the stack — the circuit board, with the wiring
  // and signal carriers torn open. Deep enough and you punch into the chassis.
  function drawPhysical(g, x, y, r) {
    drawPcb(g, x, y, r);
    // chassis void through the middle of the board
    g.save();
    blobPath(g, x + rand(-r * 0.1, r * 0.1), y + rand(-r * 0.1, r * 0.1), r * 0.32, 0.3);
    g.clip();
    drawChassis(g, x, y, r * 0.32);
    g.restore();
    // twisted copper pairs
    for (let p = 0; p < 2; p++) {
      const sx = x - r, sy = y + rand(-r * 0.7, r * 0.7), ey = y + rand(-r * 0.7, r * 0.7);
      for (let k = 0; k < 2; k++) {
        g.strokeStyle = k ? 'rgba(235,150,70,0.95)' : 'rgba(250,245,235,0.9)';
        g.lineWidth = 1.4;
        g.beginPath();
        for (let i = 0; i <= 24; i++) {
          const t = i / 24, px = sx + t * r * 2;
          const py = sy + (ey - sy) * t + Math.sin(t * 18 + k * Math.PI) * 2.2;
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.stroke();
      }
    }
    // a snapped fibre strand, glowing at the break
    const fx = x + rand(-r * 0.6, r * 0.2), fy = y + rand(-r * 0.6, r * 0.6);
    const ex = fx + rand(r * 0.3, r * 0.8), ey = fy + rand(-r * 0.3, r * 0.3);
    g.strokeStyle = 'rgba(120,230,255,0.85)';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(ex, ey); g.stroke();
    const glow = g.createRadialGradient(ex, ey, 0, ex, ey, 7);
    glow.addColorStop(0, 'rgba(200,250,255,0.95)');
    glow.addColorStop(1, 'rgba(80,200,255,0)');
    g.fillStyle = glow;
    g.fillRect(ex - 7, ey - 7, 14, 14);
  }

  // OSI layers exposed below the surface, shallowest first.
  const STRATA = [drawPresentation, drawSession, drawTransport, drawNetwork, drawDataLink, drawPhysical];
  const LAYERS = [
    'L7 · Application', 'L6 · Presentation', 'L5 · Session', 'L4 · Transport',
    'L3 · Network', 'L2 · Data Link', 'L1 · Physical',
  ];
  // lip colour per stratum (same order as STRATA)
  const EDGE = ['#ff5fa2', '#8fa8ff', '#5fe6c0', '#c49bff', '#6dff8f', '#e0a94f'];
  // How many strata a breach of depth d (0..5 on the engine's grid) exposes.
  // Weapons were tuned for a 5-deep grid; scaling keeps them unchanged while
  // spreading the six OSI layers over that range (dynamite's 5 = L1).
  // Below 1 the glass hasn't been breached at all, so nothing is exposed.
  const layerCount = (d) => (d < 1 ? 0 : Math.min(STRATA.length, Math.floor(d * 1.2)));

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
    // OSI layer names, surface first, and which one a depth value has exposed
    // (0 = L7, the untouched surface). The engine's HUD reads these.
    LAYERS: LAYERS,
    layerOf(d) { return layerCount(d); },

    // Paint the strata exposed by a breach. `d` is the deepest value reached;
    // each layer is drawn in a progressively smaller blob so the cross-section
    // reads as strata — shallow ring outside, deepest core in the middle.
    paint(g, x, y, radius, d, depthAt) {
      if (d < 1) return; // still just cracked glass — the damage layer covers it
      const layers = layerCount(d);
      let cx = x, cy = y;
      for (let i = 0; i < layers; i++) {
        // layer i occupies a shrinking share of the breach radius, and each
        // deeper layer drifts slightly off-centre so the strata aren't
        // perfectly nested rings (that reads as stacked stickers, not damage)
        // shallower layers survive only as thin terraced bands at the rim; the
        // deepest exposed layer always keeps ~2/3 of the hole so it reads clearly
        const r = radius * (1 - i * (layers > 1 ? 0.36 / (layers - 1) : 0));
        if (r < 3) break;
        if (i) { cx += rand(-radius * 0.07, radius * 0.07); cy += rand(-radius * 0.07, radius * 0.07); }
        // one Path2D for both the clip and the lip stroke (blobPath is random,
        // so re-running it would give a lip that wanders off the hole's edge)
        const hole = new Path2D();
        blobPath({ beginPath() {}, moveTo: (a, b) => hole.moveTo(a, b), lineTo: (a, b) => hole.lineTo(a, b),
          closePath: () => hole.closePath() }, cx, cy, r, 0.26);
        g.save();
        g.clip(hole);
        STRATA[i](g, cx, cy, r);
        // inner shadow around the rim: sells "looking down into a hole" rather
        // than a flat sticker pasted on the screen
        const sh = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
        sh.addColorStop(0, 'rgba(0,0,0,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.6)');
        g.fillStyle = sh;
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
        // layer-coloured lip so each terrace of the stack is identifiable
        g.strokeStyle = EDGE[i];
        g.lineWidth = 1.6; // half of it lands inside the clip
        g.globalAlpha = 0.4; // repeated hits stack lips; keep each one faint
        g.stroke(hole);
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
      if (layers >= 5 && cables.length < 6 && Math.random() < 0.16) {
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

    // Mains hum from the exposed electronics: a 50 Hz buzz with a few
    // harmonics, lowpassed, with a slow unsteady wobble. Returns a handle so the
    // engine can swell it as more of the screen is torn open, and stop it.
    hum(ac, dest) {
      const t = ac.currentTime;
      const out = ac.createGain();
      out.gain.value = 0;
      out.connect(dest || ac.destination);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      lp.Q.value = 0.7;
      const wob = ac.createGain(); // wobble target: sits between filter and out
      wob.gain.value = 1;
      lp.connect(wob).connect(out);
      const oscs = [];
      [[50, 'sawtooth', 0.5], [100, 'square', 0.18], [150, 'sine', 0.22], [49.6, 'sawtooth', 0.25]].forEach((h) => {
        const o = ac.createOscillator();
        o.type = h[1];
        o.frequency.value = h[0];
        const gg = ac.createGain();
        gg.gain.value = h[2];
        o.connect(gg).connect(lp);
        o.start(t);
        oscs.push(o);
      });
      const lfo = ac.createOscillator(); // slow unsteady throb
      lfo.frequency.value = 0.7;
      const lfoAmt = ac.createGain();
      lfoAmt.gain.value = 0.3;
      lfo.connect(lfoAmt).connect(wob.gain);
      lfo.start(t);
      oscs.push(lfo);
      let stopped = false;
      return {
        set(level) {
          if (stopped) return;
          out.gain.setTargetAtTime(Math.max(0, level), ac.currentTime, 0.4);
        },
        stop() {
          if (stopped) return;
          stopped = true;
          const now = ac.currentTime;
          out.gain.cancelScheduledValues(now);
          out.gain.setTargetAtTime(0, now, 0.08);
          oscs.forEach((o) => { try { o.stop(now + 0.4); } catch (e) {} });
          setTimeout(() => { try { out.disconnect(); } catch (e) {} }, 600);
        },
      };
    },

    // Dry electrical crackle: a short cluster of tiny noise ticks, the sound
    // of a live wire arcing somewhere in the wreckage.
    crackle(ac, dest) {
      const t = ac.currentTime;
      const len = ac.sampleRate * 0.35 | 0;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      const ticks = 5 + (Math.random() * 9 | 0);
      for (let k = 0; k < ticks; k++) {
        // clustered, accelerating pops — arcs come in bursts, not evenly
        const at = Math.pow(Math.random(), 1.6) * (len - 400) | 0;
        const tl = 40 + (Math.random() * 260 | 0);
        const amp = rand(0.3, 1);
        for (let i = 0; i < tl; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.pow(1 - i / tl, 2);
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = rand(1500, 2800);
      const out = ac.createGain();
      out.gain.value = rand(0.12, 0.22);
      src.connect(hp).connect(out).connect(dest || ac.destination);
      src.start(t);
    },

    // Throw sparks out of a random remembered breach (ambient arcing). Returns
    // where, or null if nothing has been breached yet.
    randomSpark() {
      if (!breaches.length) return null;
      const b = pick(breaches);
      const x = b.x + rand(-b.r * 0.5, b.r * 0.5), y = b.y + rand(-b.r * 0.5, b.r * 0.5);
      this.spark(x, y, 4 + (Math.random() * 6 | 0));
      if (Math.random() < 0.3) glitchUntil = performance.now() + rand(80, 200);
      return { x: x, y: y };
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
        // the data layers (L6–L2) flicker with traffic; L1 is dead metal and
        // only ever sparks
        const lc = layerCount(b.depth);
        if (lc < 1 || lc >= STRATA.length) continue;
        if (Math.random() < 0.06) {
          flickering = true;
          fg.save();
          fg.globalCompositeOperation = 'lighter';
          fg.fillStyle = 'hsla(' + [300, 230, 165, 270, 130][lc - 1] + ',90%,65%,' + rand(0.05, 0.16).toFixed(2) + ')';
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
