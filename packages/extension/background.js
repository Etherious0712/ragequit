// Toolbar button toggles destruction on the current tab. The engine is
// idempotent (re-injection tears itself down), so inject = toggle.
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting
    .executeScript({ target: { tabId: tab.id }, files: ['destroy.js'] })
    .catch(() => {}); // chrome://, Web Store, etc. — injection not allowed, nothing to do
});
