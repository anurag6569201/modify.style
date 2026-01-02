/**
 * DemoForge Content Script
 * 
 * Responsibilities:
 * 1. Capture mouse events when recording is active
 * 2. Send events to background script for relay to frontend
 * 3. Listen for recording state changes from background
 * 
 * State Management:
 * - Recording state comes from background script via chrome.storage
 * - Content script is PASSIVE - it only reacts to state changes
 */
(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  let isRecording = false;
  let recordingStartTime = null;
  let eventCount = 0;
  
  // Throttling state
  const MOVE_LOG_INTERVAL = 2000; // Log move events every 2 seconds
  let lastMoveLogTime = 0;

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════
  
  const pageInfo = {
    hostname: window.location.hostname,
    isDemoForge: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    url: window.location.href.substring(0, 60)
  };
  
  console.log(`[CS:${pageInfo.hostname}] Content script loaded`);

  // Check initial recording state from storage
  syncStateFromStorage();

  // ═══════════════════════════════════════════════════════════════════════
  // STORAGE SYNC (Single source of truth: chrome.storage)
  // ═══════════════════════════════════════════════════════════════════════
  
  function syncStateFromStorage() {
    if (!chrome.runtime?.id) return;
    
    chrome.storage.local.get(['isRecording', 'recordingStartTime'], (result) => {
      if (chrome.runtime.lastError) return;
      
      const wasRecording = isRecording;
      isRecording = result.isRecording || false;
      recordingStartTime = result.recordingStartTime || null;
      
      if (isRecording && !wasRecording) {
        eventCount = 0;
        console.log(`[CS:${pageInfo.hostname}] 🎬 Recording ACTIVE`);
      } else if (!isRecording && wasRecording) {
        console.log(`[CS:${pageInfo.hostname}] ⏹️ Recording STOPPED (captured ${eventCount} events)`);
      }
    });
  }

  // Listen for storage changes (immediate sync across all tabs)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    
    if (changes.isRecording !== undefined) {
      const wasRecording = isRecording;
      isRecording = changes.isRecording.newValue || false;
      
      if (changes.recordingStartTime) {
        recordingStartTime = changes.recordingStartTime.newValue;
      }
      
      if (isRecording && !wasRecording) {
        eventCount = 0;
        console.log(`[CS:${pageInfo.hostname}] 🎬 Recording STARTED via storage`);
      } else if (!isRecording && wasRecording) {
        console.log(`[CS:${pageInfo.hostname}] ⏹️ Recording STOPPED via storage (captured ${eventCount} events)`);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MOUSE EVENT CAPTURE
  // ═══════════════════════════════════════════════════════════════════════
  
  function captureMouseEvent(e, eventType) {
    if (!isRecording) return;
    if (!chrome.runtime?.id) return;

    const vv = window.visualViewport || { offsetLeft: 0, offsetTop: 0, scale: 1 };
    
    const eventData = {
      type: 'mouse',
      eventType,
      t: Date.now(),
      clientX: e.clientX,
      clientY: e.clientY,
      pageX: e.pageX,
      pageY: e.pageY,
      screenX: e.screenX,
      screenY: e.screenY,
      vv: {
        x: vv.offsetLeft || 0,
        y: vv.offsetTop || 0,
        scale: vv.scale || 1
      },
      vw: window.innerWidth,
      vh: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      source: pageInfo.hostname
    };

    eventCount++;

    // Throttled logging for move events
    if (eventType === 'move') {
      const now = Date.now();
      if (now - lastMoveLogTime > MOVE_LOG_INTERVAL) {
        console.log(`[CS:${pageInfo.hostname}] 🖱️ Captured ${eventCount} events (latest: ${e.clientX},${e.clientY})`);
        lastMoveLogTime = now;
      }
    } else {
      console.log(`[CS:${pageInfo.hostname}] 🖱️ ${eventType.toUpperCase()} at ${e.clientX},${e.clientY}`);
    }

    // Send to background script (safely handle context invalidation)
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage(eventData).catch(() => {});
    }
  }

  // Event listeners
  window.addEventListener('mousemove', (e) => captureMouseEvent(e, 'move'), { passive: true });
  window.addEventListener('mousedown', (e) => captureMouseEvent(e, 'down'), { passive: true });
  window.addEventListener('mouseup', (e) => captureMouseEvent(e, 'up'), { passive: true });

  // ═══════════════════════════════════════════════════════════════════════
  // DEMOFORGE PAGE SPECIFIC: Direct communication for same-tab events
  // ═══════════════════════════════════════════════════════════════════════
  
  // Helper to safely send messages to background (handles context invalidation)
  function safeSendMessage(message, callback) {
    if (!chrome.runtime?.id) {
      notifyContextInvalidated();
      return false;
    }
    try {
      chrome.runtime.sendMessage(message, callback);
      return true;
    } catch (e) {
      if (e.message?.includes('Extension context invalidated')) {
        notifyContextInvalidated();
      }
      return false;
    }
  }

  // Notify page that extension context is invalid (so it can show a message to user)
  function notifyContextInvalidated() {
    console.log(`[CS:${pageInfo.hostname}] ⚠️ Extension context invalidated, please refresh the page`);
    if (pageInfo.isDemoForge) {
      window.postMessage({ type: 'DEMOFORGE_EXTENSION_INVALID' }, '*');
    }
  }

  if (pageInfo.isDemoForge) {
    // Listen for recording commands from the page (fallback if WebSocket fails)
    window.addEventListener('message', (event) => {
      if (!event.data) return;
      
      if (event.data.type === 'DEMOFORGE_START_RECORDING') {
        console.log(`[CS:${pageInfo.hostname}] 📩 Received START from page, forwarding to background`);
        safeSendMessage({
          action: 'startRecording',
          recordingStartTime: event.data.recordingStartTime || Date.now()
        });
      } 
      else if (event.data.type === 'DEMOFORGE_STOP_RECORDING') {
        console.log(`[CS:${pageInfo.hostname}] 📩 Received STOP from page, forwarding to background`);
        safeSendMessage({ action: 'stopRecording' });
      }
      else if (event.data.type === 'DEMOFORGE_GET_STREAM_ID') {
        console.log(`[CS:${pageInfo.hostname}] 📩 Received GET_STREAM_ID from page`);
        safeSendMessage({ type: 'getStreamId' }, (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage({ type: 'DEMOFORGE_STREAM_ID_ERROR', error: chrome.runtime.lastError.message }, '*');
            return;
          }
          if (response?.success && response?.streamId) {
            window.postMessage({ type: 'DEMOFORGE_STREAM_ID_SUCCESS', streamId: response.streamId }, '*');
          } else {
            window.postMessage({ type: 'DEMOFORGE_STREAM_ID_ERROR', error: response?.error || 'Unknown error' }, '*');
          }
        });
      }
    });

    // Expose direct receiver for high-frequency same-tab events (optional optimization)
    window.__demoforgeExtensionReceiver = function(event) {
      // For same-tab events, dispatch directly to page
      window.dispatchEvent(new CustomEvent('demoforge-mouse-event', { detail: event }));
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MESSAGE HANDLING FROM BACKGROUND
  // ═══════════════════════════════════════════════════════════════════════
  
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Recording state is managed via storage, not messages
    // This is kept for backwards compatibility but storage.onChanged is preferred
    if (msg.action === 'ping') {
      sendResponse({ pong: true, hostname: pageInfo.hostname, isRecording });
      return;
    }
    sendResponse({ success: true });
  });

})();
