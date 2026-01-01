const WebSocket = require('ws');

const PORT = 8081;
const wss = new WebSocket.Server({ port: PORT });
let extensionConnection = null;
const frontendConnections = new Set();

wss.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[WS Server] Port ${PORT} is already in use.`);
    console.error(`[WS Server] Kill the process using: lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  } else {
    console.error('[WS Server] Server error:', error);
  }
});

wss.on('listening', () => {
  console.log(`[WS Server] Listening on ws://localhost:${PORT}`);
});

wss.on('connection', (ws, req) => {
  const userAgent = req.headers['user-agent'] || '';
  const origin = req.headers.origin || '';
  
  console.log('[WS Server] New connection:', { userAgent: userAgent.substring(0, 50), origin });
  
  // Extension connects from Chrome extension context (no origin header)
  if (!origin || origin === 'null') {
    console.log('[WS Server] ✅ Extension connected');
    extensionConnection = ws;
    
    ws.on('close', () => {
      console.log('[WS Server] Extension disconnected');
      extensionConnection = null;
    });
  } else {
    // Frontend connects from browser
    console.log('[WS Server] ✅ Frontend connected from:', origin);
    frontendConnections.add(ws);
    
    ws.on('close', () => {
      console.log('[WS Server] Frontend disconnected');
      frontendConnections.delete(ws);
    });
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Determine if message is from extension or frontend
      const isFromExtension = ws === extensionConnection;
      
      console.log(`[WS Server] Message from ${isFromExtension ? 'Extension' : 'Frontend'}:`, message.type);
      
      if (isFromExtension) {
        // Messages from extension -> forward to frontend
        if (message.type === 'batch' && Array.isArray(message.events)) {
          console.log(`[WS Server] 📦 Received batch of ${message.events.length} events from extension`);
          console.log(`[WS Server] 📤 Forwarding batch to ${frontendConnections.size} frontend connection(s)`);
          message.events.forEach((event, index) => {
            if (index < 3) {
              console.log(`[WS Server]   Event ${index + 1}:`, event.eventType, event.clientX, event.clientY);
            }
            broadcastToFrontend(event);
          });
        } else if (message.type === 'mouse') {
          console.log('[WS Server] 📤 Forwarding single mouse event to frontend');
          broadcastToFrontend(message);
        } else if (message.type === 'requestScreenSelection') {
          console.log('[WS Server] Forwarding screen selection request to frontend');
          broadcastToFrontend(message);
        }
      } else {
        // Messages from frontend -> forward to extension
        if (message.type === 'recordingStarted' || message.type === 'recordingStopped') {
          console.log(`[WS Server] 📤 Frontend sent ${message.type}, forwarding to extension...`);
          if (extensionConnection && extensionConnection.readyState === WebSocket.OPEN) {
            extensionConnection.send(JSON.stringify(message));
            console.log(`[WS Server] ✅ Forwarded ${message.type} to extension`);
          } else {
            console.warn(`[WS Server] ⚠️ Cannot forward ${message.type} - extension not connected`);
            console.warn(`[WS Server] Extension connection state:`, {
              exists: !!extensionConnection,
              readyState: extensionConnection?.readyState,
              OPEN: WebSocket.OPEN
            });
          }
        }
      }
    } catch (error) {
      console.error('[WS Server] Parse error:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('[WS Server] WebSocket error:', error);
  });
});

function broadcastToFrontend(event) {
  if (frontendConnections.size === 0) {
    console.warn('[WS Server] ⚠️ No frontend connections to send event to');
    return;
  }
  
  let sentCount = 0;
  frontendConnections.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(event));
        sentCount++;
      } catch (error) {
        console.error('[WS Server] ❌ Failed to send to frontend:', error);
      }
    } else {
      console.warn('[WS Server] ⚠️ Frontend connection not open, state:', client.readyState);
    }
  });
  
  if (sentCount > 0) {
    console.log(`[WS Server] ✅ Sent event to ${sentCount} frontend connection(s)`);
  }
}


