import { ExtensionMouseEvent } from './websocket';
import { MoveData, ClickData } from '../../pages/Recorder';

/**
 * Map extension mouse event coordinates to normalized video coordinates
 * Uses the exact formula: x = (event.clientX + event.vv.x) * (videoRect.width / event.vw)
 * Then normalizes to 0-1 range for storage
 */
export function mapExtensionEventToVideoCoords(
  event: ExtensionMouseEvent,
  videoRect: DOMRect,
  recordingStartTime: number
): { x: number; y: number; timestamp: number } {
  const timestamp = (event.t - recordingStartTime) / 1000;
  
  // Exact formula from requirements
  const x = (event.clientX + event.vv.x) * (videoRect.width / event.vw);
  const y = (event.clientY + event.vv.y) * (videoRect.height / event.vh);
  
  // Normalize to 0-1 for storage (MoveData/ClickData use normalized coordinates)
  return {
    x: x / videoRect.width,
    y: y / videoRect.height,
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
    screenWidth: event.vw,
    screenHeight: event.vh
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
    screenWidth: event.vw,
    screenHeight: event.vh,
    type: clickType
  };
}

