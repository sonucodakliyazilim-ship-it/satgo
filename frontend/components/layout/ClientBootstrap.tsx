'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store'

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
  cancelIdleCallback?: (id: number) => void
}

export default function ClientBootstrap() {
  const hydrateFromClientStorage = useAuthStore((state) => state.hydrateFromClientStorage)
  const fetchMe = useAuthStore((state) => state.fetchMe)

  useEffect(() => {
    hydrateFromClientStorage()

    const runAuthCheck = () => {
      fetchMe().catch(() => {})
    }

    const w = window as WindowWithIdleCallback
    if (typeof w.requestIdleCallback === 'function') {
      const idleId = w.requestIdleCallback(runAuthCheck, { timeout: 1500 })
      return () => w.cancelIdleCallback?.(idleId)
    }

    const timeoutId = window.setTimeout(runAuthCheck, 250)
    return () => window.clearTimeout(timeoutId)
  }, [fetchMe, hydrateFromClientStorage])

  return null
}
