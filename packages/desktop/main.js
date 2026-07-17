// Captures the monitor under the cursor, shows the frozen image fullscreen,
// and lets the engine destroy it. Esc (engine quit) closes the app.
const { app, BrowserWindow, screen, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
}

app.on('window-all-closed', () => app.quit());
