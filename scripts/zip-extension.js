// Zips packages/extension into dist/ragequit-extension.zip for Chrome Web Store
// upload. Zero npm deps — invokes the static zip-extension.ps1 via execFile (no
// shell, no string interpolation, so no command-injection surface).
const { execFileSync } = require('child_process');
const path = require('path');

execFileSync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'zip-extension.ps1')],
  { stdio: 'inherit' }
);
