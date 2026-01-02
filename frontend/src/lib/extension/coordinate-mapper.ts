import { ExtensionMouseEvent } from './websocket';
import { MoveData, ClickData } from '../../pages/Recorder';

/**
 * Map extension mouse event coordinates to normalized video coordinates
 * 
 * For cross-tab recording, we use screenX/screenY which are absolute screen coordinates.
 * These need to be mapped to the video's coordinate space.
 * 
 * The video captures the entire screen, so:
 * - screenX/screenY are the absolute position on the display
 * - We need to normalize these to 0-1 based on the screen dimensions
 * 
 * Note: screenX/screenY are already in screen pixels, independent of browser chrome.
 */
// Track logging to avoid spam
let lastLogTime = 0;
const LOG_INTERVAL = 5000; // Log every 5 seconds

export function mapExtensionEventToVideoCoords(
  event: ExtensionMouseEvent,
  videoRect: DOMRect,
  recordingStartTime: number
): { x: number; y: number; timestamp: number } {
  // Use Date.now() based timestamp (event.t is already Date.now())
  const timestamp = (event.t - recordingStartTime) / 1000;
  
  // For screen recording, we use screenX/screenY which are absolute screen coords
  // These represent where the cursor actually is on the monitor
  const screenX = event.screenX;
  const screenY = event.screenY;
  
  // Get screen dimensions
  // window.screen.width/height are in CSS pixels (logical pixels)
  // screenX/screenY are also in CSS pixels, so they match
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  // Normalize screen coordinates to 0-1
  const normalizedX = screenX / screenWidth;
  const normalizedY = screenY / screenHeight;
  
  // Debug logging (throttled)
  const now = Date.now();
  if (now - lastLogTime > LOG_INTERVAL) {
    console.log('[CoordMapper] Mapping:', {
      screenX, screenY,
      screenWidth, screenHeight,
      normalizedX: normalizedX.toFixed(3),
      normalizedY: normalizedY.toFixed(3),
      source: event.source
    });
    lastLogTime = now;
  }
  
  // Clamp to valid range (cursor might be on a different monitor)
  return {
    x: Math.max(0, Math.min(1, normalizedX)),
    y: Math.max(0, Math.min(1, normalizedY)),
    timestamp
  };
}

/**
 * Convert extension mouse event to MoveData format
 */
export function extensionEventToMoveData(
  event: ExtensionMouseEvent,
  videoRect: DOMRect,
  recordingStartTime: number
): MoveData {
  const coords = mapExtensionEventToVideoCoords(event, videoRect, recordingStartTime);
  
  return {
    x: coords.x,
    y: coords.y,
    timestamp: coords.timestamp,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height
  };
}

/**
 * Convert extension mouse event to ClickData format
 */
export function extensionEventToClickData(
  event: ExtensionMouseEvent,
  videoRect: DOMRect,
  recordingStartTime: number,
  clickType: "click" | "doubleClick" | "rightClick" = "click"
): ClickData {
  const coords = mapExtensionEventToVideoCoords(event, videoRect, recordingStartTime);
  
  return {
    x: coords.x,
    y: coords.y,
    timestamp: coords.timestamp,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    type: clickType
  };
}
