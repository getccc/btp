type WsCallback = (data: any) => void

class WebSocketService {
  private ws: WebSocket | null = null
  private listeners: Record<string, WsCallback[]> = {}
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    this.ws = new WebSocket(`${protocol}//${host}/ws/signals`)

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        const callbacks = this.listeners[msg.type] || []
        callbacks.forEach((cb) => cb(msg.data))
      } catch (e) {
        console.error('WS parse error', e)
      }
    }

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 3000)
    }
  }

  on(type: string, callback: WsCallback) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(callback)
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
