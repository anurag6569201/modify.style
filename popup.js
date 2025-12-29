document.getElementById('startBtn').addEventListener('click', () => {
  // Open the recorder page in a new tab
  chrome.tabs.create({ url: 'recorder.html' });
});
