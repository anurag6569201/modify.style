export interface ExtensionMouseEvent {
  type: "mouse";
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
  eventType: "move" | "down" | "up";
}

export class ExtensionWebSocketReceiver {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<(event: ExtensionMouseEvent) => void> = new Set();
  private readonly WS_URL = 'ws://localhost:8081';
  public onScreenSelectionRequest?: () => void;

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[Frontend] WebSocket already connected');
      return;
    }

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      console.log('[Frontend] Connecting to WebSocket:', this.WS_URL);
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => {
        console.log('[Frontend] ✅ WebSocket connected to extension bridge');
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data.toString());
          console.log('[Frontend] 📨 Received WebSocket message:', data.type, {
            hasListeners: this.listeners.size,
            listenerCount: this.listeners.size
          });
          
          if (data.type === 'mouse') {
            const event = data as ExtensionMouseEvent;
            console.log('[Frontend] 🖱️ Received mouse event:', {
              eventType: event.eventType,
              clientX: event.clientX,
              clientY: event.clientY,
              listeners: this.listeners.size
            });
            console.log('[Frontend] 🖱️ Dispatching to', this.listeners.size, 'listener(s)');
            this.listeners.forEach((listener, index) => {
              try {
                console.log(`[Frontend] Calling listener ${index}`);
                listener(event);
              } catch (err) {
                console.error(`[Frontend] ❌ Error in listener ${index}:`, err);
              }
            });
          } else if (data.type === 'requestScreenSelection') {
            // Extension requesting screen selection
            console.log('[Frontend] Extension requested screen selection');
            this.onScreenSelectionRequest?.();
          }
        } catch (error) {
          console.error('[Frontend] Failed to parse WebSocket message:', error, e.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Frontend] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[Frontend] WebSocket closed, reconnecting...');
        this.ws = null;
        this.reconnectTimeout = setTimeout(() => this.connect(), 1000);
      };
    } catch (error) {
      console.error('[Frontend] Failed to create WebSocket:', error);
      this.reconnectTimeout = setTimeout(() => this.connect(), 1000);
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get wsSocket() {
    return this.ws;
  }

  onEvent(listener: (event: ExtensionMouseEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const extensionWS = new ExtensionWebSocketReceiver();

