# DemoForge Chrome Extension

Pixel-perfect cursor recording extension for DemoForge.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` directory
5. The extension icon should appear in your toolbar

## Setup

1. Start the WebSocket server:
   ```bash
   cd extension
   npm install
   node ws-server.js
   ```

2. Start the DemoForge frontend (port 8080)

3. Navigate to the page you want to record

4. Click the extension icon and click "Start Recording"

5. In DemoForge, start recording - cursor events will be captured via extension

## Architecture

- **content-script.js**: Captures mouse events in the page context
- **background.js**: Buffers and streams events to frontend via WebSocket
- **ws-server.js**: WebSocket bridge server (runs on port 8081)

## Data Flow

```
User Mouse → Content Script → Background → WebSocket → Frontend
```

## Permissions

- `activeTab`: Access to current tab for event capture
- `storage`: Store recording state
- `host_permissions`: Connect to localhost/HTTPS sites

