# Debugging Guide

## Console Logs to Check

### 1. Extension Content Script (Page Console)
Open DevTools on the page you're recording:
- `[Extension] Recording started at: [timestamp]`
- `[Extension] Viewport: {...}`
- `[Extension] Capturing mouse event: {...}`

### 2. Extension Background (Extension Service Worker)
Open `chrome://extensions/` → Click "Service worker" link:
- `[Extension] ✅ WebSocket connected to bridge server`
- `[Extension] ✅ Forwarded screen selection request to frontend`
- `[Extension] Received recordingStarted signal from frontend`

### 3. WebSocket Server (Terminal)
- `[WS Server] ✅ Extension connected`
- `[WS Server] ✅ Frontend connected from: [origin]`
- `[WS Server] Message from Extension: mouse`
- `[WS Server] ✅ Forwarded recordingStarted to extension`

### 4. Frontend (Browser Console)
- `[Frontend] ✅ WebSocket connected to extension bridge`
- `[Frontend] Received WebSocket message: mouse`
- `[Frontend] Recorded click: {...}`
- `[Frontend] Recorded X move events`
- `[Frontend] Downloaded cursor data: {...}`

## Common Issues

### Extension Not Capturing Events
1. Check if content script is injected: Look for `[Extension] Recording started` in page console
2. Check WebSocket connection: Look for `[Extension] ✅ WebSocket connected` in service worker
3. Check if recording was signaled: Look for `[Extension] Received recordingStarted signal`

### WebSocket Not Connecting
1. Check if server is running: `lsof -ti:8081`
2. Check server logs for connection messages
3. Check browser console for WebSocket errors

### Cursor Data Not Downloading
1. Check if recording completed successfully
2. Check browser console for `[Frontend] Downloaded cursor data`
3. Check Downloads folder for `cursor-data-[timestamp].json`

## Testing Flow

1. **Start WebSocket Server**: `cd extension && npm start`
2. **Load Extension**: `chrome://extensions/` → Load unpacked → Select `extension/` folder
3. **Open Target Page**: Navigate to page you want to record
4. **Click Extension Icon**: Click "Start Recording"
5. **Check Console**: Should see screen selection request
6. **Select Screen**: Choose screen/window to record
7. **Start Recording**: Click "Start Recording" in DemoForge
8. **Check Logs**: Should see events being captured
9. **Stop Recording**: Press Esc or click Stop
10. **Check Download**: JSON file should download automatically

