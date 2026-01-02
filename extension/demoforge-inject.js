/**
 * DemoForge Inject Script
 * 
 * Injected into the DemoForge page (localhost:8080) to:
 * 1. Forward mouse events from extension to React app
 * 2. Expose a receiver function for direct event passing
 * 
 * This enables same-tab events to bypass WebSocket for lower latency.
 */
(function() {
  'use strict';

  console.log('[DemoForge] Inject script loaded');

  // Forward events from content script to React app
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'DEMOFORGE_MOUSE_EVENT') {
      window.dispatchEvent(new CustomEvent('demoforge-mouse-event', {
        detail: event.data.event
      }));
    }
  });

  // Direct receiver for content script (bypasses postMessage for speed)
  window.__demoforgeExtensionReceiver = function(event) {
    window.dispatchEvent(new CustomEvent('demoforge-mouse-event', {
      detail: event
    }));
  };

  console.log('[DemoForge] Ready to receive events');
})();
