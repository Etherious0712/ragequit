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
  // Feedback: open the pre-filled mailto: draft. Only drafts addressed to the
  // developer are accepted, so the page can't use this to open arbitrary URLs.
  if (msg && msg.type === 'ragequit-mail' && sender.tab && isFeedbackMail(msg.url)) {
    chrome.tabs.create({ url: msg.url, index: sender.tab.index + 1 }).catch(() => {});
  }
});

// Exactly `mailto:<developer>?subject=…&body=…` — no extra params, so nothing
// can slip in a cc/bcc/to recipient or a different scheme.
function isFeedbackMail(url) {
  const pre = 'mailto:etherious0712@gmail.com?';
  if (typeof url !== 'string' || url.length >= 8000 || !url.startsWith(pre)) return false;
  const keys = url.slice(pre.length).split('&').map((p) => p.split('=')[0]);
  return keys.length === 2 && keys[0] === 'subject' && keys[1] === 'body' && !/[\s#]/.test(url);
}
