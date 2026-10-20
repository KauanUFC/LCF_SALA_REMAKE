import { useEffect, useRef } from 'react'
import type { SseEvent } from '../types/types'

/**
 * Subscribes to the backend SSE stream (/events) and invokes onEvent
 * for every device_update event. Handles auto-reconnect with backoff.
 */
export function useSse(onEvent: (event: SseEvent) => void, enabled = true) {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    if (!enabled) return
    let source: EventSource | null = null
    let retryMs = 1000
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const connect = () => {
      if (stopped) return
      source = new EventSource('/events')
      source.addEventListener('device_update', (e) => {
        retryMs = 1000
        try {
          const msg = JSON.parse((e as MessageEvent).data) as SseEvent
          handlerRef.current(msg)
        } catch {
          // ignore malformed payload
        }
      })
      source.onerror = () => {
        source?.close()
        retryTimer = setTimeout(connect, retryMs)
        retryMs = Math.min(retryMs * 2, 15000)
      }
    }

    connect()
    return () => {
      stopped = true
      source?.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [enabled])
}