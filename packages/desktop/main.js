// Captures the monitor under the cursor, shows the frozen image fullscreen,
// and lets the engine destroy it. Esc (engine quit) closes the app.
const { app, BrowserWindow, screen, desktopCapturer, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const https = require('https');

const REPO = 'Etherious0712/ragequit';

// numeric x.y.z compare: is `a` newer than `b`?
function isNewer(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

// Zero-dependency update check: ask GitHub for the latest release and, if it's
// newer, offer a download link. Fails silently — offline, no releases yet, or
// the repo still private all just skip the prompt (never interrupts the toy).
function checkForUpdates(win) {
  const req = https.get({
    hostname: 'api.github.com',
    path: '/repos/' + REPO + '/releases/latest',
    headers: { 'User-Agent': 'ragequit-updater', Accept: 'application/vnd.github+json' },
    timeout: 5000,
  }, (res) => {
    if (res.statusCode !== 200) { res.resume(); return; }
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      try {
        const latest = String(JSON.parse(body).tag_name).replace(/^v/, '');
        if (!isNewer(latest, app.getVersion())) return;
        if (win.isDestroyed()) return;
        win.setAlwaysOnTop(false); // let the native dialog sit above the fullscreen window
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'Update available',
          message: 'ragequit ' + latest + ' is available.',
          detail: 'You have ' + app.getVersion() + '.',
          buttons: ['Download', 'Later'],
          defaultId: 0,
          cancelId: 1,
        }).then((r) => {
          if (r.response === 0) shell.openExternal('https://github.com/' + REPO + '/releases/latest');
          if (!win.isDestroyed()) win.setAlwaysOnTop(true);
        }).catch(() => {}); // window gone mid-prompt, etc. — ignore
      } catch (e) { /* malformed response — ignore */ }
    });
  });
  req.on('error', () => {});
  req.on('timeout', () => req.destroy());
}

app.whenReady().then(async () => {
  try {
    await start();
  } catch (err) {
    console.error('ragequit: failed to start:', err); // e.g. capture permission denied
    app.quit();
  }
});

async function start() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width, height } = display.size;
  const scale = display.scaleFactor || 1;

  // Capture BEFORE creating the window so our own window isn't in the shot.
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
  });
  const source =
    sources.find((s) => s.display_id === String(display.id)) || sources[0];
  if (!source) throw new Error('no screen capture source (permission denied?)');
  const shot = source.thumbnail.toDataURL();

  ipcMain.handle('smash:shot', () => shot);
  ipcMain.on('smash:quit', () => app.quit());

  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
  // check for updates a moment after the toy is up (packaged builds only — no
  // network chatter or nag dialogs during `npm start` development)
  if (app.isPackaged) {
    win.webContents.once('did-finish-load', () => setTimeout(() => checkForUpdates(win), 2000));
  }
}

app.on('window-all-closed', () => app.quit());
