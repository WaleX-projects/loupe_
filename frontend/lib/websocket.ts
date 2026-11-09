import { useCallback, useEffect, useRef, useState } from "react"

type Options = {
  /** Called for EVERY message, synchronously, so nothing is dropped by React batching. */
  onMessage?: (data: any) => void
  /** Auto-reconnect with backoff (default true). */
  reconnect?: boolean
}

export function useWebSocket(url: string, { onMessage, reconnect = true }: Options = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)

  const socketRef = useRef<WebSocket | null>(null)
  // Always call the latest callback without re-opening the socket when it changes
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    let closedByUs = false
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    function connect() {
      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        retry = 0
        setIsConnected(true)
      }

      socket.onmessage = (event: MessageEvent) => {
        let data: any = event.data
        try {
          data = JSON.parse(event.data)
        } catch {
          /* not JSON, pass the raw string */
        }
        onMessageRef.current?.(data)
        setLastMessage(data)
      }

      socket.onclose = () => {
        setIsConnected(false)
        if (closedByUs || !reconnect) return
        const delay = Math.min(1000 * 2 ** retry++, 10000)
        timer = setTimeout(connect, delay)
      }

      socket.onerror = () => {
        // onclose fires right after and handles the reconnect.
        // warn, not error: Next's dev overlay treats console.error as a crash
        console.warn("WebSocket error (is the backend running?)", url.split("?")[0])
      }
    }

    connect()

    return () => {
      closedByUs = true
      if (timer) clearTimeout(timer)
      socketRef.current?.close()
    }
  }, [url, reconnect])

  const sendMessage = useCallback((data: unknown) => {
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(typeof data === "string" ? data : JSON.stringify(data))
      return true
    }
    console.warn("WebSocket is not connected. Message not sent.")
    return false
  }, [])

  return { isConnected, lastMessage, sendMessage }
}