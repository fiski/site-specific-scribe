
// Initialize badge count
let badgeCount = 0;

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadgeCount') {
    badgeCount = message.count;
    updateBadge();
    sendResponse({ success: true });
  }
  
  // Return true to indicate we want to send a response asynchronously
  return true;
});

// Update the badge with the current count
function updateBadge() {
  if (badgeCount > 0) {
    // Display count on the badge
    chrome.action.setBadgeText({ text: badgeCount.toString() });
    
    // Set badge background color (green)
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    // Clear the badge when count is 0
    chrome.action.setBadgeText({ text: '' });
  }
}

// Listen for storage changes (in case popup updates the filter settings)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && 
      (changes.excludedBrands || changes.disabledBrands || changes.siteSettings)) {
    // If the brand settings changed, update the badge
    // Content script will send new count after filtering
  }
});
