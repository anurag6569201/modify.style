/**
 * DemoForge Extension WebSocket Client
 * 
 * Connects to the WebSocket bridge server to:
 * 1. Send recording commands to extension
 * 2. Receive mouse events from extension (cross-tab)
 */

export interface ExtensionMouseEvent {
  type: 'mouse';
  eventType: 'move' | 'down' | 'up';
  t: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  screenX: number;
  screenY: number;
  vv: {
    x: number;
    y: number;
    scale: number;
  };
  vw: number;
  vh: number;
  dpr: number;
  source?: string; // hostname of the source tab
}

type EventListener = (event: ExtensionMouseEvent) => void;

class ExtensionWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<EventListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;

  private readonly WS_URL = 'ws://localhost:8081';
  private readonly RECONNECT_DELAY = 2000;

  // Stats for debugging
  private eventsReceived = 0;
  private lastLogTime = 0;

  /**
   * Connect to the WebSocket bridge server
   */
  connect(): void {
    if (this.isConnecting) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.cleanup();
    this.isConnecting = true;

    console.log('[WS Client] Connecting to:', this.WS_URL);

    try {
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log('[WS Client] ✅ Connected to bridge server');
      };

      this.ws.onmessage = (e) => {
        this.handleMessage(e);
      };

      this.ws.onerror = () => {
        console.error('[WS Client] ❌ Connection error');
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log('[WS Client] Disconnected');
        this.ws = null;
        this.isConnecting = false;
        this.scheduleReconnect();
      };

    } catch (error) {
      console.error('[WS Client] Failed to connect:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the bridge server
   */
  disconnect(): void {
    this.cleanup();
    console.log('[WS Client] Disconnected (manual)');
  }

  /**
   * Send a message to the extension via bridge
   */
  send(message: { type: string;[key: string]: unknown }): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS Client] Cannot send - not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      console.log('[WS Client] 📤 Sent:', message.type);
      return true;
    } catch (error) {
      console.error('[WS Client] Send failed:', error);
      return false;
    }
  }

  /**
   * Signal recording start to extension
   */
  startRecording(startTime: number): boolean {
    return this.send({
      type: 'recordingStarted',
      startTime
    });
  }

  /**
   * Signal recording stop to extension
   */
  stopRecording(): boolean {
    return this.send({
      type: 'recordingStopped'
    });
  }

  /**
   * Subscribe to mouse events from extension
   */
  onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────────

  private handleMessage(e: MessageEvent): void {
    try {
      const data = JSON.parse(e.data);

      // Mouse event from extension
      if (data.type === 'mouse') {
        this.eventsReceived++;

        // Throttled logging
        const now = Date.now();
        if (now - this.lastLogTime > 2000) {
          console.log(`[WS Client] 📥 Received ${this.eventsReceived} events (latest: ${data.eventType} from ${data.source || 'unknown'})`);
          this.lastLogTime = now;
        }

        // Dispatch to listeners
        const event = data as ExtensionMouseEvent;
        this.listeners.forEach(listener => {
          try {
            listener(event);
          } catch (err) {
            console.error('[WS Client] Listener error:', err);
          }
        });
      }

    } catch (error) {
      console.error('[WS Client] Failed to parse message:', error);
    }
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) { }
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.RECONNECT_DELAY);
  }
}

// Singleton instance
export const extensionWS = new ExtensionWebSocketClient();

// Legacy alias for backwards compatibility
export class ExtensionWebSocketReceiver extends ExtensionWebSocketClient {
  sendMessage(message: { type: string;[key: string]: unknown }): void {
    this.send(message);
  }
}
