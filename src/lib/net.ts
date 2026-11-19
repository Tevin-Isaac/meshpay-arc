import { useSyncExternalStore } from 'react'

/**
 * Connectivity as the browser reports it (navigator.onLine and the online/offline events).
 * There is no manual override: what the app shows is the real state of the connection.
 */
let online = typeof navigator === 'undefined' ? true : navigator.onLine
const listeners = new Set<() => void>()
let snapshot = { online }

function emit() {
  if (snapshot.online === online) return
  snapshot = { online }
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    online = true
    emit()
  })
  window.addEventListener('offline', () => {
    online = false
    emit()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useNet() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
}

export function getOnline(): boolean {
  return snapshot.online
}
