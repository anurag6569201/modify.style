/**
 * DemoForge Background Script (Service Worker)
 * 
 * SINGLE SOURCE OF TRUTH for recording state.
 * 
 * Responsibilities:
 * 1. Manage recording state in chrome.storage
 * 2. Relay mouse events from content scripts to frontend via WebSocket
 * 3. Handle commands from frontend via WebSocket
 * 4. Handle desktop capture requests
 */

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const WS_URL = 'ws://localhost:8081';
const BUFFER_FLUSH_INTERVAL_MS = 50;
const BUFFER_MAX_SIZE = 50;
const WS_RECONNECT_DELAY_MS = 3000;
const WS_HEALTH_CHECK_INTERVAL_MS = 10000; // Less aggressive health check

// ═══════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════

let ws = null;
let wsReconnectTimer = null;
let eventBuffer = [];
let bufferFlushTimer = null;
let isConnecting = false;
let lastConnectAttempt = 0;
const MIN_RECONNECT_INTERVAL = 2000; // Don't reconnect faster than this

console.log('[BG] 🚀 Background service worker started');

// ═══════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isRecording: false, recordingStartTime: null });
  console.log('[BG] Initialized storage');
});

// Connect WebSocket on startup
connectWebSocket();

// Start buffer flush interval
bufferFlushTimer = setInterval(flushEventBuffer, BUFFER_FLUSH_INTERVAL_MS);

// Periodic WebSocket health check (less aggressive)
setInterval(() => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectWebSocket(); // Don't log - connectWebSocket already logs
  }
}, WS_HEALTH_CHECK_INTERVAL_MS);

// ═══════════════════════════════════════════════════════════════════════
// WEBSOCKET CONNECTION
// ═══════════════════════════════════════════════════════════════════════

function connectWebSocket() {
  // Prevent rapid reconnection attempts
  const now = Date.now();
  if (now - lastConnectAttempt < MIN_RECONNECT_INTERVAL) {
    return;
  }
  
  if (isConnecting) return;
  if (ws && ws.readyState === WebSocket.OPEN) return;
  
  // Clean up existing connection
  if (ws) {
    try { ws.close(); } catch (e) {}
    ws = null;
  }
  
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  isConnecting = true;
  lastConnectAttempt = now;
  console.log('[BG] 🔌 Connecting to WebSocket...');

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      isConnecting = false;
      console.log('[BG] ✅ WebSocket connected');
      flushEventBuffer();
    };

    ws.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('[BG] Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[BG] ❌ WebSocket error');
      isConnecting = false;
    };

    ws.onclose = (event) => {
      // Only log if it wasn't a clean close
      if (event.code !== 1000) {
        console.log('[BG] WebSocket disconnected (code:', event.code, ')');
      }
      ws = null;
      isConnecting = false;
      scheduleReconnect();
    };

  } catch (error) {
    console.error('[BG] Failed to create WebSocket:', error);
    isConnecting = false;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWebSocket();
  }, WS_RECONNECT_DELAY_MS);
}

// ═══════════════════════════════════════════════════════════════════════
// WEBSOCKET MESSAGE HANDLING (Commands from Frontend)
// ═══════════════════════════════════════════════════════════════════════

function handleWebSocketMessage(message) {
  console.log('[BG] 📨 Received:', message.type);

  switch (message.type) {
    case 'recordingStarted':
      handleStartRecording(message.startTime || Date.now());
      break;
      
    case 'recordingStopped':
      handleStopRecording();
      break;
      
    default:
      console.log('[BG] Unknown message type:', message.type);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RECORDING STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

function handleStartRecording(startTime) {
  console.log('[BG] 🎬 Starting recording at:', new Date(startTime).toISOString());
  
  // Set storage - this broadcasts to ALL content scripts automatically
  chrome.storage.local.set({
    isRecording: true,
    recordingStartTime: startTime
  }, () => {
    console.log('[BG] ✅ Recording state saved to storage');
    
    // Log active tabs for debugging
    chrome.tabs.query({}, (tabs) => {
      const validTabs = tabs.filter(t => 
        t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
      );
      console.log(`[BG] 📊 ${validTabs.length} tabs will receive recording state`);
    });
  });
}

function handleStopRecording() {
  console.log('[BG] ⏹️ Stopping recording');
  
  chrome.storage.local.set({
    isRecording: false,
    recordingStartTime: null
  }, () => {
    console.log('[BG] ✅ Recording stopped, state saved');
  });
}

// ═══════════════════════════════════════════════════════════════════════
// EVENT BUFFERING & RELAY
// ═══════════════════════════════════════════════════════════════════════

function flushEventBuffer() {
  if (eventBuffer.length === 0) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const batch = eventBuffer.splice(0, eventBuffer.length);
  
  try {
    ws.send(JSON.stringify({
      type: 'batch',
      events: batch
    }));
    
    // Only log occasionally to reduce noise
    if (batch.length > 0) {
      console.log(`[BG] 📤 Sent ${batch.length} events`);
    }
  } catch (error) {
    console.error('[BG] Failed to send batch:', error);
    // Put events back at the front of the buffer
    eventBuffer.unshift(...batch);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MESSAGE HANDLING (From Content Scripts)
// ═══════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  // Mouse event from content script
  if (msg.type === 'mouse') {
    eventBuffer.push(msg);
    
    // Flush immediately if buffer is getting large
    if (eventBuffer.length >= BUFFER_MAX_SIZE) {
      flushEventBuffer();
    }
    
    sendResponse({ success: true });
    return false; // Synchronous
  }
  
  // Recording control from DemoForge content script (fallback path)
  if (msg.action === 'startRecording') {
    handleStartRecording(msg.recordingStartTime || Date.now());
    sendResponse({ success: true });
    return false;
  }
  
  if (msg.action === 'stopRecording') {
    handleStopRecording();
    sendResponse({ success: true });
    return false;
  }
  
  // Desktop capture request
  if (msg.type === 'getStreamId') {
    console.log('[BG] 🎥 Desktop capture requested');
    
    chrome.desktopCapture.chooseDesktopMedia(
      ['screen', 'audio'],
      sender.tab,
      (streamId) => {
        if (!streamId) {
          console.log('[BG] ❌ Desktop capture cancelled');
          sendResponse({ success: false, error: 'Cancelled' });
          return;
        }
        console.log('[BG] ✅ Desktop capture stream ID obtained');
        sendResponse({ success: true, streamId });
      }
    );
    return true; // Async response
  }
  
  // Unknown message
  sendResponse({ success: false, error: 'Unknown message' });
  return false;
});

// ═══════════════════════════════════════════════════════════════════════
// TAB LIFECYCLE (Ensure new tabs get recording state)
// ═══════════════════════════════════════════════════════════════════════

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // When a tab finishes loading, it will read storage automatically
  // via the content script's syncStateFromStorage()
  // No need to send messages - storage.onChanged handles it
});

// Service worker wake-up
chrome.runtime.onStartup.addListener(() => {
  console.log('[BG] Service worker started via onStartup');
  connectWebSocket();
});
