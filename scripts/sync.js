// Concatenates the core engine + weapon files into a single destroy.js
// and copies it into the extension and desktop packages. No bundler needed.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const core = path.join(root, 'packages', 'core');
const toolsDir = path.join(core, 'tools');

// Order matters: guts.js (hardware layers) and the tools register themselves into
// globals first, then the engine last — it reads both registries and starts.
// Tools sorted by filename for a stable toolbar order.
let out = fs.readFileSync(path.join(core, 'guts.js'), 'utf8') + '\n';
if (fs.existsSync(toolsDir)) {
  for (const f of fs.readdirSync(toolsDir).sort()) {
    if (f.endsWith('.js')) out += fs.readFileSync(path.join(toolsDir, f), 'utf8') + '\n';
  }
}
out += fs.readFileSync(path.join(core, 'destroy.js'), 'utf8');

for (const target of ['extension', 'desktop']) {
  const dest = path.join(root, 'packages', target, 'destroy.js');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  console.log('synced -> ' + path.relative(root, dest));
}
