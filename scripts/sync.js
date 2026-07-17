// Concatenates the core engine + weapon files into a single destroy.js
// and copies it into the extension and desktop packages. No bundler needed.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const core = path.join(root, 'packages', 'core');
const toolsDir = path.join(core, 'tools');

// Tools first (they register into the global registry), engine last (it reads
// the registry and starts). Tools sorted by filename for a stable toolbar order.
let out = '';
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
