type WsCallback<T = unknown> = (data: T) => void

interface WsEnvelope {
  type?: string
  event?: string
  data?: unknown
}

class WebSocketService {
  private ws: WebSocket | null = null
  private listeners: Record<string, Array<WsCallback<unknown>>> = {}
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    this.ws = new WebSocket(`${protocol}//${host}/ws/signals`)

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsEnvelope
        const eventType = typeof msg.type === 'string' ? msg.type : typeof msg.event === 'string' ? msg.event : null
        if (!eventType) return
        const callbacks = this.listeners[eventType] || []
        callbacks.forEach((cb) => cb(msg.data))
      } catch (e) {
        console.error('WS parse error', e)
      }
    }

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 3000)
    }
  }

  on<T = unknown>(type: string, callback: WsCallback<T>) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(callback as WsCallback<unknown>)
    return () => {
      this.listeners[type] = this.listeners[type].filter((cb) => cb !== callback)
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const wsService = new WebSocketService()
