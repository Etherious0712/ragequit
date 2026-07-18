// Extension-only host shim (injected before destroy.js, same isolated world).
// Gives the engine a way to grab a clean screenshot of the page for the save
// feature — the engine stays platform-agnostic and just calls __SMASH_HOST__.
// captureVisibleTab lives in the background worker; we ask it via a message.
window.__SMASH_HOST__ = {
  capture: () =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'ragequit-capture' }, (r) => {
        resolve(r && r.dataUrl ? r.dataUrl : null); // null on chrome://, PDF viewer, etc.
      });
    }),
};
