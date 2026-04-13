'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Camera, FolderOpenDot, Settings, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { supabaseBrowser } from '@/lib/supabase/client'
import { syncQueuedSitePhotos } from '@/lib/field/localSitePhotos'

function safeNextPath(value: string | null, fallback: string) {
  const next = (value ?? '').trim()
  if (!next) return fallback
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//')) return fallback
  if (next.startsWith('/\\')) return fallback
  return next
}

function FieldSyncBootstrap() {
  useEffect(() => {
    const runSync = () => {
      void syncQueuedSitePhotos()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        runSync()
      }
    }

    runSync()
    window.addEventListener('online', runSync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', runSync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}

export default function FieldLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(true)
  const [logoError, setLogoError] = useState(false)
  const logoSrc = process.env.NEXT_PUBLIC_CRM_LOGO || '/ace-logo-clean.png'

  useEffect(() => {
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let alive = true

    ;(async () => {
      const nextPath = encodeURIComponent(
        safeNextPath(
          typeof window !== 'undefined' ? window.location.pathname : '/field/jobs',
          '/field/jobs'
        )
      )

      let { data, error } = await supabaseBrowser.auth.getSession()
      if (!data?.session) {
        const refreshed = await supabaseBrowser.auth.refreshSession()
        data = refreshed.data
        error = refreshed.error
      }
      if (!alive) return

      if (error || !data?.session) {
        router.replace(`/login?next=${nextPath}`)
        return
      }

      try {
        const bootstrapRes = await authedFetch('/api/bootstrap-org', { method: 'POST' })
        if (bootstrapRes.status === 401) {
          router.replace(`/login?next=${nextPath}`)
          return
        }
      } catch {
        router.replace(`/login?next=${nextPath}`)
        return
      }

      setReady(true)
    })()

    return () => {
      alive = false
    }
  }, [router])

  if (!ready) return null

  const navItems = [
    { href: '/field/jobs', label: 'Jobs', Icon: FolderOpenDot },
    { href: '/field/activity', label: 'Activity', Icon: Camera },
    { href: '/field/settings', label: 'Settings', Icon: Settings },
  ]

  return (
    <div
      className="crm-shell"
      style={{
        minHeight: '100vh',
        background: 'var(--crm-bg)',
        color: 'var(--crm-text)',
      }}
    >
      <FieldSyncBootstrap />
      <div className="mx-auto flex min-h-screen w-full max-w-[640px] flex-col pb-6">
        <header className="crm-topbar" style={{ marginBottom: 12 }}>
          <div
            style={{
              width: '100%',
              borderRadius: 16,
              border: '1px solid var(--crm-border)',
              background: 'var(--crm-nav-bg)',
              boxShadow: 'var(--crm-shadow)',
              backdropFilter: 'blur(8px)',
              padding: 10,
              display: 'grid',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/crm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  fontWeight: 900,
                  fontSize: 18,
                  color: 'var(--crm-text)',
                  textDecoration: 'none',
                }}
              >
                {!logoError && (
                  <span
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: 'var(--crm-card)',
                      border: '1px solid var(--crm-border)',
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
                    }}
                  >
                    <Image
                      src={logoSrc}
                      alt="ACE Painting"
                      onError={() => setLogoError(true)}
                      width={34}
                      height={34}
                      unoptimized
                      style={{ width: 34, height: 34, objectFit: 'contain' }}
                    />
                  </span>
                )}
                <span>ACE Field Camera</span>
              </Link>
              <Link
                href="/crm/jobs"
                style={{
                  height: 34,
                  padding: '0 10px',
                  borderRadius: 10,
                  border: '1px solid var(--crm-border)',
                  background: 'var(--crm-card)',
                  color: 'var(--crm-text)',
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                CRM Jobs
              </Link>
            </div>
            <nav className="crm-nav" style={{ gap: 8 }}>
              {navItems.map(({ href, label, Icon }) => {
                const selected = pathname === href || pathname?.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 12,
                      textDecoration: 'none',
                      fontWeight: 700,
                      fontSize: 14,
                      color: selected ? 'var(--crm-accent-text)' : 'var(--crm-text-soft)',
                      background: selected
                        ? 'linear-gradient(135deg, var(--crm-accent) 0%, var(--crm-accent-strong) 100%)'
                        : 'var(--crm-nav-link)',
                      border: selected ? '1px solid var(--crm-accent)' : '1px solid var(--crm-border)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      boxShadow: selected ? 'var(--crm-shadow-active)' : 'none',
                    }}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
          {!online && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 12,
                border: '1px solid var(--crm-warning-border)',
                background: 'var(--crm-warning-bg)',
                color: 'var(--crm-warning-text)',
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <WifiOff size={14} />
              <span>Offline mode. Captures stay queued on this device until sync returns.</span>
            </div>
          )}
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
