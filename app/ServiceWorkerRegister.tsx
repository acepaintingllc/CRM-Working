'use client'

import { useEffect } from 'react'

const fieldCachePrefix = 'ace-field-shell-'

function isLocalDevelopmentRuntime() {
  if (process.env.NODE_ENV === 'development') return true
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

async function clearFieldCaches() {
  if (typeof caches === 'undefined') return
  const keys = await caches.keys()
  await Promise.all(
    keys
      .filter((key) => key.startsWith(fieldCachePrefix))
      .map((key) => caches.delete(key))
  )
}

async function unregisterFieldWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(
    registrations.map(async (registration) => {
      const scriptUrls = [registration.active, registration.waiting, registration.installing]
        .map((worker) => worker?.scriptURL ?? '')
        .filter(Boolean)
      const isFieldWorker = scriptUrls.some((url) => url.includes('/sw.js'))
      if (!isFieldWorker) return
      await registration.unregister()
    })
  )
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        if (isLocalDevelopmentRuntime()) {
          await unregisterFieldWorkers()
          await clearFieldCaches()
          return
        }
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      } catch {
        // ignore registration failures; the app still works without offline shell caching
      }
    }

    void register()
  }, [])

  return null
}
