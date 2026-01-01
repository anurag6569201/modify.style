// This script is injected into the DemoForge page (localhost:8080)
// It receives events from the extension and forwards them to the React app

(function() {
  'use strict';
  
  console.log('[DemoForge Inject] Script loaded');
  
  // Listen for messages from extension content script
  window.addEventListener('message', (event) => {
    // Only accept messages from our extension
    if (event.data && event.data.type === 'DEMOFORGE_MOUSE_EVENT') {
      const mouseEvent = event.data.event;
      
      // Forward to React app via custom event
      window.dispatchEvent(new CustomEvent('demoforge-mouse-event', {
        detail: mouseEvent
      }));
      
      console.log('[DemoForge Inject] Forwarded mouse event:', mouseEvent.eventType);
    }
  });
  
  // Expose function for extension to call directly
  window.__demoforgeExtensionReceiver = function(event) {
    window.dispatchEvent(new CustomEvent('demoforge-mouse-event', {
      detail: event
    }));
    console.log('[DemoForge Inject] Received event via function call:', event.eventType);
  };
  
  console.log('[DemoForge Inject] Ready to receive events');
})();

