let socket = null;
let eventBuffer = [];
let bufferFlushInterval = null;
const BUFFER_FLUSH_MS = 50;
const WS_URL = 'ws://localhost:8081';

// Initialize storage on installation/startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['isRecording'], (result) => {
    if (result.isRecording === undefined) {
      chrome.storage.local.set({ isRecording: false });
      console.log('[Extension] Initialized isRecording to false');
    }
  });
});

function connectWebSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return;
  }

  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log('[Extension] ✅ WebSocket connected to bridge server');
    console.log('[Extension] 📊 Buffer status:', {
      eventsInBuffer: eventBuffer.length,
      socketReady: socket.readyState === WebSocket.OPEN
    });
    flushBuffer();
  };

  socket.onmessage = (e) => {
    try {
      const message = JSON.parse(e.data.toString());
      console.log('[Extension] 📨 Received WebSocket message:', message.type);
      
      if (message.type === 'recordingStarted') {
        // Frontend signals recording has started (after countdown)
        console.log('[Extension] 🎬 Processing recordingStarted signal');
        
        const startTime = Date.now();
        
        // Set storage flag - ALL content scripts will pick this up automatically
        chrome.storage.local.set({
          isRecording: true,
          recordingStartTime: startTime
        }, () => {
          console.log('[Extension] ✅✅✅ Set isRecording=true in storage at:', new Date(startTime).toISOString());
          console.log('[Extension] Storage set complete, verifying...');
          
          // Verify it was set
          chrome.storage.local.get(['isRecording'], (result) => {
            console.log('[Extension] 🔍 Storage verification:', result);
          });
          
          // Also broadcast message to all tabs for immediate response
          chrome.tabs.query({}, (allTabs) => {
            console.log('[Extension] 📢 Broadcasting startRecording to', allTabs.length, 'tabs');
            allTabs.forEach((tab) => {
              if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                chrome.tabs.sendMessage(tab.id, { action: 'startRecording' }).catch(() => {
                  // Ignore errors - storage change will handle it
                });
              }
            });
          });
        });
      } else if (message.type === 'recordingStopped') {
        // Frontend signals recording has stopped
        console.log('[Extension] ⏹️ Processing recordingStopped signal');
        
        // Set storage flag - ALL content scripts will pick this up automatically
        chrome.storage.local.set({ isRecording: false }, () => {
          console.log('[Extension] ✅ Set isRecording=false in storage - all content scripts will stop recording');
        });
      }
    } catch (error) {
      console.error('[Extension] Failed to parse message from server:', error);
    }
  };

  socket.onerror = (error) => {
    console.error('[Extension] WebSocket error:', error);
  };

  socket.onclose = () => {
    console.log('[Extension] WebSocket closed, reconnecting...');
    socket = null;
    setTimeout(connectWebSocket, 1000);
  };
}

function flushBuffer() {
  if (eventBuffer.length === 0) {
    return;
  }
  
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('[Extension] ⚠️ Cannot flush buffer - WebSocket not open. State:', socket?.readyState);
    return;
  }

  const batch = [...eventBuffer];
  eventBuffer = [];

  try {
    const message = {
      type: 'batch',
      events: batch
    };
    socket.send(JSON.stringify(message));
    console.log('[Extension] ✅ Sent batch of', batch.length, 'events to WebSocket');
  } catch (error) {
    console.error('[Extension] ❌ Failed to send batch:', error);
    eventBuffer.unshift(...batch);
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "mouse") {
    eventBuffer.push(msg);
    
    // Log first few events for debugging
    if (eventBuffer.length <= 5) {
      console.log('[Extension] 📦 Buffered mouse event:', msg.eventType, 'Total in buffer:', eventBuffer.length);
    }

    if (eventBuffer.length >= 100) {
      console.log('[Extension] 📤 Flushing buffer (100 events)');
      flushBuffer();
    }
  } else if (msg.type === "requestScreenSelection") {
    // Forward screen selection request to frontend via WebSocket
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "requestScreenSelection"
      }));
      console.log('[Extension] ✅ Forwarded screen selection request to frontend');
    } else {
      console.warn('[Extension] ⚠️ Cannot forward screen selection - WebSocket not connected');
    }
  }

  sendResponse({ success: true });
  return true;
});

if (!bufferFlushInterval) {
  bufferFlushInterval = setInterval(flushBuffer, BUFFER_FLUSH_MS);
}

connectWebSocket();

