# Chrome Extension Implementation - Pixel-Perfect Cursor Recording

## Overview

This implementation provides pixel-perfect cursor recording and playback by capturing all mouse events in a Chrome extension (not website JS), ensuring accurate coordinate mapping regardless of zoom, viewport shifts, or CSS transforms.

## Architecture

### Data Flow
```
User Mouse
   ↓
Chrome Content Script (true viewport)
   ↓
chrome.runtime.sendMessage
   ↓
Background Service Worker
   ↓
WebSocket (ws://localhost:8081)
   ↓
DemoForge Frontend
```

### Key Components

1. **Extension (`extension/`)**
   - `content-script.js`: Captures mouse events with full viewport context
   - `background.js`: Buffers and streams events via WebSocket
   - `manifest.json`: Extension configuration

2. **WebSocket Server (`extension/ws-server.js`)**
   - Bridges extension → frontend communication
   - Runs on port 8081

3. **Frontend Integration**
   - `frontend/src/lib/extension/websocket.ts`: WebSocket receiver
   - `frontend/src/lib/extension/coordinate-mapper.ts`: Coordinate transformation
   - Updated `Recorder.tsx`: Removed direct mouse listeners, uses extension data
   - Updated `CursorLayer.tsx`: Uses `getExactCursorPos` for linear interpolation

## Data Captured

Each mouse event includes:
```typescript
{
  t: performance.now(),          // high-res timestamp
  clientX, clientY,              // viewport coordinates
  pageX, pageY,                  // document coordinates
  screenX, screenY,              // OS screen coordinates
  vv: {
    x: visualViewport.offsetLeft,
    y: visualViewport.offsetTop,
    scale: visualViewport.scale
  },
  vw: window.innerWidth,         // viewport width
  vh: window.innerHeight,        // viewport height
  dpr: window.devicePixelRatio,
  eventType: "move" | "down" | "up"
}
```

## Coordinate Mapping

**Exact formula** (no guesswork, no drift):
```typescript
x = (event.clientX + event.vv.x) * (videoRect.width / event.vw);
y = (event.clientY + event.vv.y) * (videoRect.height / event.vh);
```

Then normalized to 0-1 for storage:
```typescript
normalizedX = x / videoRect.width;
normalizedY = y / videoRect.height;
```

## Playback

- **Frontend never listens to mouse events** - only replays extension data
- **Cursor overlay driven by `video.currentTime`** - time-locked playback
- **Linear interpolation** - no easing, pure `lerp()` between events
- **Uses `video.getBoundingClientRect()`** for coordinate mapping

## Setup

1. Install extension:
   ```bash
   # Load extension in Chrome (chrome://extensions/)
   ```

2. Start WebSocket server:
   ```bash
   cd extension
   npm install
   npm start
   ```

3. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

4. Record:
   - Navigate to target page
   - Click extension icon → "Start Recording"
   - Start recording in DemoForge

## Key Features

✅ Extension owns ALL input capture  
✅ Normalizes coordinates with visualViewport context  
✅ Buffers and streams events efficiently  
✅ Frontend never listens to mouse directly  
✅ Cursor overlay time-locked to video  
✅ Linear interpolation (no easing)  
✅ Pixel-perfect coordinate mapping  

## Files Modified

- `extension/`: New Chrome extension
- `frontend/src/lib/extension/`: New extension integration
- `frontend/src/pages/Recorder.tsx`: Removed mouse listeners, added WebSocket receiver
- `frontend/src/components/editor/CursorLayer.tsx`: Uses `getExactCursorPos` for linear interpolation

