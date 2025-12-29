// Open the setup page in a new full tab
chrome.tabs.create({ url: 'setup.html' });

// Close the small popup since we moved to a full tab
window.close();
