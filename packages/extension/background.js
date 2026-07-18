// Toolbar button toggles destruction on the current tab. The engine is
// idempotent (re-injection tears itself down), so inject = toggle. The host
// shim runs first so the engine's save feature can request a page capture.
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting
    .executeScript({ target: { tabId: tab.id }, files: ['host.js', 'destroy.js'] })
    .catch(() => {}); // chrome://, Web Store, etc. — injection not allowed, nothing to do
});

// Save feature: the injected engine asks for a screenshot of the visible page.
// activeTab (granted by the toolbar click) covers captureVisibleTab — no extra
// permission. The image is composited and downloaded locally; never transmitted.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'ragequit-capture' && sender.tab) {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl: chrome.runtime.lastError ? null : dataUrl });
    });
    return true; // keep the message channel open for the async response
  }
});
