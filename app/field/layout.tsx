'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarDays,
  Calculator,
  Camera,
  Cog,
  FileText,
  FolderOpenDot,
  Home,
  Settings,
  Users,
  WifiOff,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { getBrandLogoUrl } from '@/lib/brand/logo'
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
  const logoSrc = getBrandLogoUrl()

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

  const crmNavItems: Array<{ href: string; label: string; Icon: LucideIcon }> = [
    { href: '/crm', label: 'Home', Icon: Home },
    { href: '/crm/customers', label: 'Customers', Icon: Users },
    { href: '/crm/jobs', label: 'Job Center', Icon: Wrench },
    { href: '/crm/estimates', label: 'Estimates', Icon: Calculator },
    { href: '/crm/notes', label: 'Notes', Icon: FileText },
    { href: '/crm/calendar', label: 'Calendar', Icon: CalendarDays },
    { href: '/field/jobs', label: 'Field Cam', Icon: Camera },
    { href: '/crm/settings', label: 'Settings', Icon: Cog },
  ]
  const fieldNavItems = [
    { href: '/field/jobs', label: 'Jobs', Icon: FolderOpenDot },
    { href: '/field/activity', label: 'Activity', Icon: Camera },
    { href: '/field/settings', label: 'Settings', Icon: Settings },
  ]
  const isCameraRoute = Boolean(pathname?.startsWith('/field/jobs/'))
  const isJobsRoute = pathname === '/field/jobs'
  const showPrimaryCrmHeader = isJobsRoute
  const containerMaxWidth = isJobsRoute ? 'max-w-[1200px]' : 'max-w-[640px]'

  if (isCameraRoute) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--crm-bg)',
          color: 'var(--crm-text)',
        }}
      >
        <FieldSyncBootstrap />
        <main>{children}</main>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'var(--crm-bg)',
        color: 'var(--crm-text)',
      }}
    >
      <FieldSyncBootstrap />

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex"
        style={{
          width: 220,
          flexShrink: 0,
          flexDirection: 'column',
          background: 'var(--crm-card)',
          borderRight: '1px solid var(--crm-border)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Brand */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--crm-border)' }}>
          <Link
            href="/crm"
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
          >
            {!logoError && (
              <span
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--crm-bg)', border: '1px solid var(--crm-border)',
                  display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0,
                }}
              >
                <Image src={logoSrc} alt="ACE Painting" onError={() => setLogoError(true)} width={28} height={28} unoptimized style={{ width: 28, height: 28, objectFit: 'contain' }} />
              </span>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--crm-text)', lineHeight: 1.2 }}>ACE Painting</div>
              <div style={{ fontSize: 11, color: 'var(--crm-muted)', fontWeight: 600, marginTop: 1 }}>Field Cam</div>
            </div>
          </Link>
        </div>

        {/* CRM nav */}
        <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--crm-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 12px 6px' }}>
            CRM
          </div>
          {crmNavItems.map(({ href, label, Icon }) => {
            const selected = pathname === href || (href !== '/crm' && Boolean(pathname?.startsWith(href)))
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                  fontWeight: selected ? 700 : 500, fontSize: 14,
                  color: selected ? 'var(--crm-accent-text)' : 'var(--crm-text-soft)',
                  background: selected ? 'linear-gradient(135deg, var(--crm-accent) 0%, var(--crm-accent-strong) 100%)' : 'transparent',
                  transition: 'background 120ms, color 120ms',
                }}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--crm-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 12px 6px', borderTop: '1px solid var(--crm-border)', marginTop: 6 }}>
            Field
          </div>
          {fieldNavItems.map(({ href, label, Icon }) => {
            const selected = pathname === href || Boolean(pathname?.startsWith(`${href}/`))
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
                  fontWeight: selected ? 700 : 500, fontSize: 14,
                  color: selected ? 'var(--crm-accent-text)' : 'var(--crm-text-soft)',
                  background: selected ? 'linear-gradient(135deg, var(--crm-accent) 0%, var(--crm-accent-strong) 100%)' : 'transparent',
                  transition: 'background 120ms, color 120ms',
                }}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {!online && (
          <div style={{ margin: '0 10px 10px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--crm-warning-border)', background: 'var(--crm-warning-bg)', color: 'var(--crm-warning-text)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <WifiOff size={12} />
            Offline
          </div>
        )}
      </aside>

      {/* ── Main content column ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

      {/* Mobile sticky top bar */}
      <div
        className="lg:hidden"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          borderBottom: '1px solid var(--crm-border)',
          background: 'var(--crm-nav-bg)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Brand row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '10px 14px',
          }}
        >
          <Link
            href="/crm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 800,
              fontSize: 15,
              color: 'var(--crm-text)',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            {!logoError && (
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'var(--crm-card)',
                  border: '1px solid var(--crm-border)',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                }}
              >
                <Image
                  src={logoSrc}
                  alt="ACE Painting"
                  onError={() => setLogoError(true)}
                  width={22}
                  height={22}
                  unoptimized
                  style={{ width: 22, height: 22, objectFit: 'contain' }}
                />
              </span>
            )}
            ACE Field Cam
          </Link>
          <Link
            href="/crm"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--crm-muted)',
              textDecoration: 'none',
              border: '1px solid var(--crm-border)',
              borderRadius: 8,
              padding: '4px 10px',
            }}
          >
            ← CRM
          </Link>
        </div>

        {/* CRM nav (scrollable) — shown on jobs route */}
        {showPrimaryCrmHeader && (
          <div
            style={{
              overflowX: 'auto',
              display: 'flex',
              gap: 6,
              padding: '0 14px 8px',
              scrollbarWidth: 'none',
            }}
          >
            {crmNavItems.map(({ href, label, Icon }) => {
              const selected = pathname === href || (href !== '/crm' && Boolean(pathname?.startsWith(href)))
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: 13,
                    color: selected ? 'var(--crm-accent-text)' : 'var(--crm-text-soft)',
                    background: selected
                      ? 'linear-gradient(135deg, var(--crm-accent) 0%, var(--crm-accent-strong) 100%)'
                      : 'var(--crm-nav-link)',
                    border: selected ? '1px solid var(--crm-accent)' : '1px solid var(--crm-border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        )}

        {/* Field sub-nav */}
        <div
          style={{
            overflowX: 'auto',
            display: 'flex',
            gap: 6,
            padding: showPrimaryCrmHeader ? '0 14px 10px' : '0 14px 10px',
            scrollbarWidth: 'none',
            borderTop: showPrimaryCrmHeader ? '1px solid var(--crm-border)' : 'none',
            marginTop: showPrimaryCrmHeader ? 0 : 0,
            paddingTop: showPrimaryCrmHeader ? 8 : 0,
          }}
        >
          {fieldNavItems.map(({ href, label, Icon }) => {
            const selected = pathname === href || Boolean(pathname?.startsWith(`${href}/`))
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: '7px 12px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  color: selected ? 'var(--crm-accent-text)' : 'var(--crm-text-soft)',
                  background: selected
                    ? 'linear-gradient(135deg, var(--crm-accent) 0%, var(--crm-accent-strong) 100%)'
                    : 'var(--crm-nav-link)',
                  border: selected ? '1px solid var(--crm-accent)' : '1px solid var(--crm-border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>

        {!online && (
          <div
            style={{
              margin: '0 14px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 10,
              border: '1px solid var(--crm-warning-border)',
              background: 'var(--crm-warning-bg)',
              color: 'var(--crm-warning-text)',
              padding: '7px 10px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <WifiOff size={13} />
            <span>Offline — captures queued until sync returns.</span>
          </div>
        )}
      </div>{/* end mobile top bar */}

        <div className={`mx-auto w-full ${containerMaxWidth} px-4 pb-6 pt-4`}>
          {children}
        </div>
      </div>{/* end main content column */}
    </div>
  )
}
