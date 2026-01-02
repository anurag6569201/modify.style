/**
 * DemoForge WebSocket Bridge Server
 * 
 * Simple relay between:
 * - Extension Background Script (captures mouse events)
 * - Frontend React App (receives events for recording)
 * 
 * Message Flow:
 * Frontend → Server → Extension: recordingStarted, recordingStopped
 * Extension → Server → Frontend: mouse events (batched)
 */

const WebSocket = require('ws');

const PORT = 8081;
const wss = new WebSocket.Server({ port: PORT });

// Track connections
let extensionSocket = null;
const frontendSockets = new Set();

// Stats for debugging
let stats = {
  eventsRelayed: 0,
  batchesReceived: 0,
  lastEventTime: null
};

console.log('═══════════════════════════════════════════════════════════');
console.log(`  DemoForge WebSocket Bridge`);
console.log(`  Listening on ws://localhost:${PORT}`);
console.log('═══════════════════════════════════════════════════════════');

wss.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Run: lsof -ti:${PORT} | xargs kill -9\n`);
    process.exit(1);
  }
  console.error('[Server] Error:', error);
});

// Track connection times to reduce log spam
let lastExtensionConnectLog = 0;
let lastFrontendConnectLog = 0;
const LOG_THROTTLE_MS = 5000;

wss.on('connection', (socket, req) => {
  const origin = req.headers.origin || '';
  const isExtension = !origin || origin === 'null' || origin.startsWith('chrome-extension://');
  const now = Date.now();
  
  if (isExtension) {
    // Extension connection
    if (extensionSocket && extensionSocket !== socket) {
      try { extensionSocket.close(); } catch (e) {}
    }
    extensionSocket = socket;
    
    // Throttle connection logs (service worker can reconnect frequently)
    if (now - lastExtensionConnectLog > LOG_THROTTLE_MS) {
      console.log('[Server] ✅ Extension connected');
      lastExtensionConnectLog = now;
    }
    
    socket.on('close', () => {
      if (extensionSocket === socket) extensionSocket = null;
      // Don't log every disconnect - too noisy with service workers
    });
    
  } else {
    // Frontend connection
    frontendSockets.add(socket);
    
    if (now - lastFrontendConnectLog > LOG_THROTTLE_MS) {
      console.log(`[Server] ✅ Frontend connected (${frontendSockets.size} total)`);
      lastFrontendConnectLog = now;
    }
    
    socket.on('close', () => {
      frontendSockets.delete(socket);
    });
  }

  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      const isFromExtension = socket === extensionSocket;
      
      if (isFromExtension) {
        handleExtensionMessage(message);
      } else {
        handleFrontendMessage(message);
      }
    } catch (error) {
      console.error('[Server] Parse error:', error.message);
    }
  });

  socket.on('error', (error) => {
    console.error('[Server] Socket error:', error.message);
  });
});

/**
 * Handle messages from Extension → Forward to Frontend
 */
// Track unique sources we've seen during this session
const seenSources = new Set();

function handleExtensionMessage(message) {
  if (message.type === 'batch' && Array.isArray(message.events)) {
    stats.batchesReceived++;
    stats.eventsRelayed += message.events.length;
    stats.lastEventTime = new Date().toISOString();
    
    // Track and log new sources
    message.events.forEach(event => {
      if (event.source && !seenSources.has(event.source)) {
        seenSources.add(event.source);
        console.log(`[Server] 🌐 NEW source detected: ${event.source} (total sources: ${seenSources.size})`);
      }
      broadcastToFrontend(event);
    });
    
    // Log periodically (every 10 batches)
    if (stats.batchesReceived % 10 === 0) {
      console.log(`[Server] 📊 Stats: ${stats.eventsRelayed} events in ${stats.batchesReceived} batches`);
    }
  } 
  else if (message.type === 'mouse') {
    stats.eventsRelayed++;
    broadcastToFrontend(message);
  }
}

/**
 * Handle messages from Frontend → Forward to Extension
 */
function handleFrontendMessage(message) {
  if (message.type === 'recordingStarted' || message.type === 'recordingStopped') {
    console.log(`[Server] 📤 ${message.type} → Extension`);
    
    if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
      extensionSocket.send(JSON.stringify(message));
    } else {
      console.warn('[Server] ⚠️ Extension not connected');
    }
  }
}

/**
 * Send message to all connected frontends
 */
function broadcastToFrontend(message) {
  if (frontendSockets.size === 0) return;
  
  const payload = JSON.stringify(message);
  let sent = 0;
  
  frontendSockets.forEach(socket => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
      sent++;
    }
  });
}

// Periodic status log
setInterval(() => {
  const status = {
    extension: extensionSocket ? 'connected' : 'disconnected',
    frontends: frontendSockets.size,
    eventsRelayed: stats.eventsRelayed
  };
  console.log(`[Server] Status: Extension=${status.extension}, Frontends=${status.frontends}, Events=${status.eventsRelayed}`);
}, 30000);
