import { useSyncExternalStore } from 'react'

/**
 * Connectivity as the app sees it. `simulated` lets you rehearse the offline
 * flow in a browser where you cannot easily pull the network cable.
 */
let browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine
let simulated = false
const listeners = new Set<() => void>()
let snapshot = { online: browserOnline && !simulated, simulated, browserOnline }

function emit() {
  snapshot = { online: browserOnline && !simulated, simulated, browserOnline }
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    browserOnline = true
    emit()
  })
  window.addEventListener('offline', () => {
    browserOnline = false
    emit()
  })
}

export function setSimulatedOffline(value: boolean) {
  simulated = value
  emit()
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
