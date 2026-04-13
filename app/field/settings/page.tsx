'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, HardDriveDownload, RefreshCw, WifiOff } from 'lucide-react'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  listPendingLocalSitePhotos,
  listRecentLocalSitePhotos,
  subscribeToLocalSitePhotoChanges,
  syncQueuedSitePhotos,
} from '@/lib/field/localSitePhotos'

export default function FieldSettingsPage() {
  const [queueCount, setQueueCount] = useState(0)
  const [deviceCount, setDeviceCount] = useState(0)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [running, setRunning] = useState(false)
  const [fieldSwActive, setFieldSwActive] = useState<boolean | null>(null)
  const [fieldSwScope, setFieldSwScope] = useState<string | null>(null)
  const [themeSource, setThemeSource] = useState<'crm_tokens' | 'unknown'>('unknown')
  const fieldBuildVersion =
    process.env.NEXT_PUBLIC_APP_VERSION ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    'local-dev'

  const load = useCallback(async () => {
    const [pending, allRows] = await Promise.all([
      listPendingLocalSitePhotos(),
      listRecentLocalSitePhotos(10000),
    ])
    setQueueCount(pending.filter((row) => row.status !== 'uploaded').length)
    setDeviceCount(allRows.length)
  }, [])

  useEffect(() => {
    void load()
    return subscribeToLocalSitePhotoChanges(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    const loadStatus = async () => {
      const res = await authedFetch('/api/google-calendar/status', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      setConnected(res.ok ? Boolean(payload?.connected) : false)
    }
    void loadStatus()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const crmBgToken = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--crm-bg')
      .trim()
    if (crmBgToken) {
      setThemeSource('crm_tokens')
    } else {
      setThemeSource('unknown')
    }

    if (!('serviceWorker' in navigator)) {
      setFieldSwActive(false)
      setFieldSwScope(null)
      return
    }

    const loadSw = async () => {
      const registration = await navigator.serviceWorker.getRegistration('/').catch(() => null)
      const scriptUrls = [registration?.active, registration?.waiting, registration?.installing]
        .map((worker) => worker?.scriptURL ?? '')
        .filter(Boolean)
      const isFieldSw = scriptUrls.some((url) => url.includes('/sw.js'))
      setFieldSwActive(isFieldSw)
      setFieldSwScope(isFieldSw ? registration?.scope ?? null : null)
    }

    void loadSw()
  }, [])

  const canInstall = useMemo(() => typeof window !== 'undefined' && 'serviceWorker' in navigator, [])

  const retryAll = async () => {
    setRunning(true)
    await syncQueuedSitePhotos()
    await load()
    setRunning(false)
  }

  return (
    <div className="grid gap-3">
      <section className="rounded-[30px] border border-white/75 bg-white/92 p-4 shadow-[0_22px_50px_rgba(15,23,42,0.12)]">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Settings</div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Field route status.</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quick checks for sync, install support, and device-stored captures.
        </p>
      </section>

      <section className="grid gap-3">
        <div className="rounded-[28px] border border-white/75 bg-white/92 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="text-sm font-black text-slate-900">Field build info</div>
          <div className="mt-3 grid gap-1 text-sm text-slate-600">
            <div>
              <span className="font-semibold text-slate-900">Version:</span> {fieldBuildVersion}
            </div>
            <div>
              <span className="font-semibold text-slate-900">Field service worker:</span>{' '}
              {fieldSwActive == null ? 'Checking...' : fieldSwActive ? 'Active' : 'Not active'}
            </div>
            {fieldSwScope && (
              <div className="truncate">
                <span className="font-semibold text-slate-900">SW scope:</span> {fieldSwScope}
              </div>
            )}
            <div>
              <span className="font-semibold text-slate-900">Theme source:</span>{' '}
              {themeSource === 'crm_tokens' ? 'CRM tokens (--crm-*)' : 'Unknown'}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/75 bg-white/92 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <CheckCircle2 size={18} className="text-slate-700" />
            <span>Google connection</span>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            {connected == null ? 'Checking connection...' : connected ? 'Connected for Drive uploads.' : 'Google integration is not connected yet.'}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/75 bg-white/92 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <WifiOff size={18} className="text-amber-500" />
            <span>Offline queue</span>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900">{queueCount}</div>
          <div className="text-sm text-slate-500">captures waiting to upload or retry</div>
          <button
            onClick={() => void retryAll()}
            disabled={running}
            className="crm-btn-primary mt-4 inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-black"
          >
            <RefreshCw size={16} className={running ? 'animate-spin' : ''} />
            <span>Retry all now</span>
          </button>
        </div>

        <div className="rounded-[28px] border border-white/75 bg-white/92 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <HardDriveDownload size={18} className="text-slate-700" />
            <span>Device storage</span>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900">{deviceCount}</div>
          <div className="text-sm text-slate-500">field capture records stored on this device</div>
        </div>

        <div className="rounded-[28px] border border-white/75 bg-white/92 p-4 text-sm text-slate-600 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="font-black text-slate-900">PWA install</div>
          <div className="mt-2">
            {canInstall
              ? 'This route registers a service worker and can be installed from the browser menu on supported devices.'
              : 'This browser does not expose service worker support for install behavior.'}
          </div>
        </div>
      </section>
    </div>
  )
}
