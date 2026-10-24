// Sentinel Background Service Worker
// Stores audit log and handles messages from content scripts

const MAX_LOG_ENTRIES = 200;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SENTINEL_LOG') {
    chrome.storage.local.get(['sentinelLog'], (data) => {
      const log = data.sentinelLog || [];
      log.unshift(msg.payload);
      if (log.length > MAX_LOG_ENTRIES) log.splice(MAX_LOG_ENTRIES);
      chrome.storage.local.set({ sentinelLog: log });
    });
  }

  if (msg.type === 'GET_LOG') {
    chrome.storage.local.get(['sentinelLog'], (data) => {
      sendResponse({ log: data.sentinelLog || [] });
    });
    return true; // async response
  }

  if (msg.type === 'CLEAR_LOG') {
    chrome.storage.local.set({ sentinelLog: [] });
  }
});

// Badge counter — show count of today's blocked events
function updateBadge() {
  chrome.storage.local.get(['sentinelLog'], (data) => {
    const log = data.sentinelLog || [];
    const today = new Date().toDateString();
    const blocked = log.filter(e => {
      return e.action === 'BLOCK' && new Date(e.ts).toDateString() === today;
    }).length;
    chrome.action.setBadgeText({ text: blocked > 0 ? String(blocked) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.sentinelLog) updateBadge();
});
