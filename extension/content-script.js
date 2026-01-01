(function() {
  'use strict';

  let recordingStartTime = null;
  let isRecording = false;
  
  let storageCheckInterval = null;

  // Check storage for recording state on load and when it changes
  function checkRecordingState() {
    try {
      // Check if extension context is valid
      if (!chrome.runtime?.id) {
        console.log('[Extension] Context invalidated, stopping interval');
        if (storageCheckInterval) clearInterval(storageCheckInterval);
        return;
      }

      chrome.storage.local.get(['isRecording', 'recordingStartTime'], (result) => {
        if (chrome.runtime.lastError) {
          // This might happen if context is invalidated during the call
          console.log('[Extension] Storage error (likely context invalidated):', chrome.runtime.lastError);
          if (storageCheckInterval) clearInterval(storageCheckInterval);
          return;
        }

        console.log('[Extension] 🔍 Checking storage state:', result, 'Current isRecording:', isRecording);
        if (result.isRecording && !isRecording) {
          // Recording just started
          isRecording = true;
          recordingStartTime = result.recordingStartTime ? result.recordingStartTime : performance.now();
          captureMouseEvent._count = 0; // Reset counter
          console.log('[Extension] ✅✅✅ RECORDING STARTED (from storage) at:', new Date(recordingStartTime).toISOString());
          console.log('[Extension] Viewport:', {
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: window.devicePixelRatio,
            visualViewport: {
              offsetLeft: window.visualViewport?.offsetLeft || 0,
              offsetTop: window.visualViewport?.offsetTop || 0,
              scale: window.visualViewport?.scale || 1
            }
          });
        } else if (!result.isRecording && isRecording) {
          // Recording just stopped
          isRecording = false;
          recordingStartTime = null;
          console.log('[Extension] ⏹️ Recording stopped (from storage)');
        } else if (result.isRecording === undefined) {
          // Treat undefined as false (not recording), don't spam console
          // console.log('[Extension] ⚠️ Storage isRecording is undefined');
        }
      });
    } catch (error) {
       if (error.message && error.message.includes('Extension context invalidated')) {
         console.log('[Extension] Extension context invalidated (caught), stopping interval');
         if (storageCheckInterval) clearInterval(storageCheckInterval);
       } else {
         console.error('[Extension] Error checking recording state:', error);
       }
    }
  }
  
  // Check immediately
  checkRecordingState();
  
  // Check periodically (every 200ms) in case storage change event doesn't fire
  storageCheckInterval = setInterval(checkRecordingState, 200);
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    console.log('[Extension] 📦 Storage changed:', changes, 'Area:', areaName);
    if (areaName === 'local') {
      if (changes.isRecording) {
        console.log('[Extension] 🔔 Storage change detected for isRecording:', changes.isRecording.newValue);
        checkRecordingState();
      }
      if (changes.recordingStartTime) {
        console.log('[Extension] 🔔 Storage change detected for recordingStartTime');
        checkRecordingState();
      }
    }
  });

  function captureMouseEvent(e, type) {
    // Quick synchronous check first
    if (!isRecording) {
      // Don't check storage on every event (too slow), rely on periodic check and storage listener
      if (!captureMouseEvent._warned) {
        console.warn('[Extension] ⚠️ Not recording, ignoring mouse event. isRecording:', isRecording);
        
        // Check if extension context is valid before trying to use storage
        if (chrome.runtime?.id) {
            // Check storage once when we first see this warning
            try {
                chrome.storage.local.get(['isRecording'], (result) => {
                  if (chrome.runtime.lastError) return; // Ignore errors
                  console.log('[Extension] 🔍 Storage check result:', result);
                  if (result.isRecording) {
                    isRecording = true;
                    recordingStartTime = performance.now();
                    captureMouseEvent._count = 0;
                    console.log('[Extension] ✅✅✅ RECORDING STARTED (from storage check in captureMouseEvent)');
                  }
                });
            } catch (e) {
                // Ignore context invalidated errors here
            }
        }
        
        captureMouseEvent._warned = true;
        setTimeout(() => { captureMouseEvent._warned = false; }, 5000);
      }
      return;
    }

    const vv = window.visualViewport || {
      offsetLeft: 0,
      offsetTop: 0,
      scale: 1
    };

    const eventData = {
      type: "mouse",
      t: performance.now(),
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
      eventType: type
    };

    // Console log what we're capturing (throttled for move events)
    if (type === "move") {
      if (!captureMouseEvent._lastLog || Date.now() - captureMouseEvent._lastLog > 1000) {
        console.log('[Extension] 🖱️ Capturing mouse move:', {
          clientX: eventData.clientX,
          clientY: eventData.clientY,
          viewport: { w: eventData.vw, h: eventData.vh },
          eventsCaptured: captureMouseEvent._count || 0
        });
        captureMouseEvent._lastLog = Date.now();
      }
      captureMouseEvent._count = (captureMouseEvent._count || 0) + 1;
    } else {
      console.log('[Extension] 🖱️ Capturing mouse', type + ':', {
        clientX: eventData.clientX,
        clientY: eventData.clientY,
        viewport: { w: eventData.vw, h: eventData.vh }
      });
    }

    // Send to background for WebSocket (keep for now)
    if (chrome.runtime?.id) {
        try {
            chrome.runtime.sendMessage(eventData).catch((error) => {
              // Ignore context invalidated errors, log others
              if (error.message && !error.message.includes('Extension context invalidated')) {
                  console.error('[Extension] ❌ Failed to send mouse event to background:', error);
              }
            });
        } catch (e) {
            // Ignore synchronous errors
        }
    }
    
    // ALSO send directly to DemoForge page via postMessage (new approach)
    // Find the DemoForge window/tab and send directly
    if (window.__demoforgeExtensionReceiver) {
      // We're on the DemoForge page itself
      try {
        window.__demoforgeExtensionReceiver(eventData);
        console.log('[Extension] ✅ Sent event directly to DemoForge page');
      } catch (error) {
        console.error('[Extension] Failed to call DemoForge receiver:', error);
      }
    } else {
      // We're on a different page, need to send to DemoForge page
      // Use window.postMessage to send to parent/opener, or chrome.tabs to find DemoForge tab
      window.postMessage({
        type: 'DEMOFORGE_MOUSE_EVENT',
        event: eventData
      }, '*');
    }
  }

  window.addEventListener("mousemove", (e) => {
    captureMouseEvent(e, "move");
  }, { passive: true });

  window.addEventListener("mousedown", (e) => {
    captureMouseEvent(e, "down");
  }, { passive: true });

  window.addEventListener("mouseup", (e) => {
    captureMouseEvent(e, "up");
  }, { passive: true });

  // Listen for window messages from DemoForge page
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'DEMOFORGE_START_RECORDING') {
      recordingStartTime = performance.now();
      isRecording = true;
      captureMouseEvent._count = 0;
      console.log('[Extension] ✅✅✅ RECORDING STARTED (from window message)');
      
      // SYNC TO STORAGE so polling doesn't stop it
      if (chrome.runtime?.id) {
        chrome.storage.local.set({
          isRecording: true,
          recordingStartTime: recordingStartTime
        }).catch(err => console.error('[Extension] Failed to sync start to storage:', err));
      }
      
    } else if (event.data && event.data.type === 'DEMOFORGE_STOP_RECORDING') {
      isRecording = false;
      recordingStartTime = null;
      console.log('[Extension] ⏹️ Recording stopped (from window message)');
      
      // SYNC TO STORAGE
      if (chrome.runtime?.id) {
        chrome.storage.local.set({
          isRecording: false
        }).catch(err => console.error('[Extension] Failed to sync stop to storage:', err));
      }
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (msg.action === "startRecording") {
        // Also update storage so all content scripts know
        chrome.storage.local.set({
          isRecording: true,
          recordingStartTime: performance.now()
        });
        recordingStartTime = performance.now();
        isRecording = true;
        captureMouseEvent._count = 0; // Reset counter
        console.log('[Extension] ✅✅✅ RECORDING STARTED (from message) at:', new Date(recordingStartTime).toISOString());
        sendResponse({ success: true });
      } else if (msg.action === "stopRecording") {
        chrome.storage.local.set({ isRecording: false });
        isRecording = false;
        recordingStartTime = null;
        console.log('[Extension] ⏹️ Recording stopped (from message)');
        sendResponse({ success: true });
      } else if (msg.action === "requestScreenSelection") {
        // If we're on DemoForge page, trigger screen selection
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          window.postMessage({ type: 'DEMOFORGE_REQUEST_SCREEN_SELECTION' }, '*');
        }
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[Extension] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep channel open for async response
  });
  
  // Signal that content script is ready
  console.log('[Extension] Content script loaded and ready');
})();

