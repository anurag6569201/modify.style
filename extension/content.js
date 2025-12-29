// Basic mouse tracker
let mouseData = [];
const startTime = Date.now();

function recordEvent(type, x, y) {
  mouseData.push({
    t: Date.now() - startTime,
    x: x / window.innerWidth, // Normalize coordinates (0-1)
    y: y / window.innerHeight,
    type: type
  });
}

// Throttle mousemove
let lastLog = 0;
document.addEventListener('mousemove', (e) => {
  const now = Date.now();
  if (now - lastLog > 50) { // 20fps cap
    recordEvent('move', e.clientX, e.clientY);
    lastLog = now;
  }
});

document.addEventListener('click', (e) => {
  recordEvent('click', e.clientX, e.clientY);
});

// Listen for request to stop and send data
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getMouseData") {
    sendResponse({ data: mouseData });
  }
});
