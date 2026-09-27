// Extension-only host shim (injected before destroy.js, same isolated world).
// Gives the engine a way to grab a clean screenshot of the page for the save
// feature — the engine stays platform-agnostic and just calls __SMASH_HOST__.
// captureVisibleTab lives in the background worker; we ask it via a message.
window.__SMASH_HOST__ = {
  info: { platform: 'extension', version: chrome.runtime.getManifest().version },
  // Feedback: the engine builds a mailto: draft; the background worker opens it
  // in a new tab so the browser hands it to the user's mail app / webmail.
  openMail: (url) =>
    chrome.runtime.sendMessage({ type: 'ragequit-mail', url: url }, () => void chrome.runtime.lastError),
  capture: () =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'ragequit-capture' }, (r) => {
        resolve(r && r.dataUrl ? r.dataUrl : null); // null on chrome://, PDF viewer, etc.
      });
    }),
};
