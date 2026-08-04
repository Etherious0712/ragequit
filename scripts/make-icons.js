// Generates the app icons as PNGs — zero dependencies, no browser round-trip.
//
// The art is the same procedural "cracked screen" mark as scripts/make-icons.html
// (which stays as the visual playground), rasterised here with signed-distance
// fields + 4x4 supersampling and encoded with Node's built-in zlib. Doing it in
// Node means `npm run icons` is reproducible and byte-exact every time.
//
//   node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- tiny PNG encoder (RGBA8) ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  // 10,11,12 = deflate / adaptive filtering / no interlace (all 0)
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter type 0 (None)
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- signed distance helpers ----------
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r), qy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(wx - vx * t, wy - vy * t);
}

// ---------- the mark ----------
// Fixed geometry (no randomness) so every size renders the same logo.
const CRACKS = 9;
const KINK = [0.18, -0.22, 0.12, -0.15, 0.24, -0.1, 0.16, -0.2, 0.13];
const REACH = [0.86, 0.72, 0.9, 0.66, 0.8, 0.74, 0.88, 0.7, 0.82];

function render(size) {
  const c = size / 2;
  const tileR = size * 0.16;
  const strokes = []; // {ax,ay,bx,by,w,col}

  const push = (ax, ay, bx, by, w, col) => strokes.push({ ax, ay, bx, by, w, col });

  // crack polylines: dark underlay first, bright core on top
  const legs = [];
  for (let i = 0; i < CRACKS; i++) {
    const a0 = (i / CRACKS) * Math.PI * 2 - 0.4;
    const far = size * 0.52 * REACH[i];
    const midA = a0 + KINK[i];
    const mx = c + Math.cos(a0) * far * 0.5, my = c + Math.sin(a0) * far * 0.5;
    const ex = c + Math.cos(midA) * far, ey = c + Math.sin(midA) * far;
    legs.push([c, c, mx, my, ex, ey]);
  }
  const darkW = Math.max(1.5, size * 0.045), briteW = Math.max(0.8, size * 0.02);
  for (const [x0, y0, mx, my, ex, ey] of legs) {
    push(x0, y0, mx, my, darkW, hex('#0a0e16'));
    push(mx, my, ex, ey, darkW, hex('#0a0e16'));
  }
  for (const [x0, y0, mx, my, ex, ey] of legs) {
    push(x0, y0, mx, my, briteW, hex('#cfe6ff'));
    push(mx, my, ex, ey, briteW, hex('#cfe6ff'));
  }
  // connecting web ring
  const ring = size * 0.24, ringW = Math.max(0.8, size * 0.012), ringCol = hex('#8fb8e6');
  const rp = [];
  for (let i = 0; i < CRACKS; i++) {
    const a = (i / CRACKS) * Math.PI * 2 - 0.4 + KINK[i] * 0.5;
    rp.push([c + Math.cos(a) * ring, c + Math.sin(a) * ring]);
  }
  for (let i = 0; i < rp.length; i++) {
    const p = rp[i], q = rp[(i + 1) % rp.length];
    push(p[0], p[1], q[0], q[1], ringW, ringCol);
  }

  const tileCol = hex('#1a1a20'), coreCol = hex('#7db4ff'), coreR = size * 0.14, hotR = size * 0.075;
  const out = Buffer.alloc(size * size * 4);
  const SS = 4, inv = 1 / (SS * SS);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          if (sdRoundRect(px, py, c, c, c, c, tileR) > 0) continue; // outside the tile
          let cr = tileCol[0], cg = tileCol[1], cb = tileCol[2];
          for (const s of strokes) {
            if (sdSegment(px, py, s.ax, s.ay, s.bx, s.by) <= s.w / 2) {
              cr = s.col[0]; cg = s.col[1]; cb = s.col[2];
            }
          }
          const dc = Math.hypot(px - c, py - c);
          if (dc <= coreR) { cr = coreCol[0]; cg = coreCol[1]; cb = coreCol[2]; }
          if (dc <= hotR) { cr = 255; cg = 255; cb = 255; }
          r += cr; g += cg; b += cb; a += 255;
        }
      }
      const i = (y * size + x) * 4;
      const cov = a * inv / 255;
      // un-premultiply so edge pixels keep their colour as alpha falls off
      out[i] = cov > 0 ? Math.round(r / (a / 255)) : 0;
      out[i + 1] = cov > 0 ? Math.round(g / (a / 255)) : 0;
      out[i + 2] = cov > 0 ? Math.round(b / (a / 255)) : 0;
      out[i + 3] = Math.round(cov * 255);
    }
  }
  return encodePng(size, size, out);
}

const root = path.join(__dirname, '..');
const extIcons = path.join(root, 'packages', 'extension', 'icons');
fs.mkdirSync(extIcons, { recursive: true });
for (const s of [16, 48, 128]) {
  const p = path.join(extIcons, s + '.png');
  fs.writeFileSync(p, render(s));
  console.log('wrote ' + path.relative(root, p));
}
const deskIcon = path.join(root, 'packages', 'desktop', 'icon.png');
fs.writeFileSync(deskIcon, render(512)); // 512 = crisper Windows taskbar downscales
console.log('wrote ' + path.relative(root, deskIcon));
