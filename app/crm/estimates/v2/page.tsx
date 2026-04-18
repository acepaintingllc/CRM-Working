'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type NavItem = {
  label: string
  href?: string
  disabled?: boolean
}

type HomeEstimate = {
  estimate_id: string
  job_id: string
  customer_id: string
  version_name: string
  version_state: string
  version_kind: string
  version_sort_order: number
  job_title: string
  customer_name: string
  final_total: number | null
  updated_at: string | null
  created_at: string | null
  is_sent_estimate: boolean
}

type HomeData = {
  summary: {
    draft_count: number
    sent_or_awaiting_count: number
    live_count: number
    pipeline_total: number
  }
  recent_estimates: HomeEstimate[]
  snapshot: (HomeEstimate & { total_versions: number }) | null
  search_estimates: HomeEstimate[]
}

type JobRow = {
  id: string
  title: string
  customer_id: string
  customer_name: string | null
  customer_address?: string | null
  status: string
  created_at?: string | null
}

const VERSION_KIND_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'alternate', label: 'Alternate' },
  { value: 'split', label: 'Split' },
  { value: 'combined', label: 'Combined' },
  { value: 'revision', label: 'Revision' },
] as const

const SETTINGS_LINKS: NavItem[] = [
  { label: 'Products', disabled: true },
  { label: 'Rates & Flags', disabled: true },
  { label: 'Settings', href: '/crm/settings' },
]

const S = {
  main: {
    display: 'block',
    minWidth: 0,
    minHeight: '100vh',
    background: 'var(--v2-bg)',
    color: 'var(--v2-ink)',
    overflowX: 'hidden' as const,
  },
  content: {
    width: '100%',
    padding: '24px 28px 48px',
    maxWidth: 'none',
    margin: 0,
    scrollBehavior: 'smooth' as const,
  },
  desktopWrap: {
    display: 'block',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    paddingBottom: 20,
    borderBottom: '1px solid var(--v2-line)',
    marginBottom: 32,
  },
  brandWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'linear-gradient(180deg, #092b16 0%, #04180d 100%)',
    border: '1px solid var(--v2-green-dim)',
    color: 'var(--v2-green-2)',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'var(--v2-mono)',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  brandName: {
    fontWeight: 800,
    fontSize: 18,
    color: 'var(--v2-ink)',
    letterSpacing: '-0.02em',
  },
  brandSub: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 10,
    color: 'var(--v2-ink-3)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    marginTop: 2,
  },
  crumbs: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 11,
    color: 'var(--v2-ink-3)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    marginTop: 8,
  },
  topControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-end',
  },
  settingsMenu: {
    position: 'relative' as const,
  },
  settingsSummary: {
    listStyle: 'none' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 14px',
    borderRadius: 12,
    border: '1px solid var(--v2-line)',
    background: 'var(--v2-bg-2)',
    color: 'var(--v2-ink)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  settingsPanel: {
    position: 'absolute' as const,
    right: 0,
    top: 'calc(100% + 10px)',
    width: 240,
    padding: 10,
    borderRadius: 14,
    border: '1px solid var(--v2-line)',
    background: 'var(--v2-bg-2)',
    boxShadow: '0 16px 42px rgba(0,0,0,0.38)',
    display: 'grid',
    gap: 6,
    zIndex: 20,
  },
  settingsLink: {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--v2-ink-2)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  settingsDisabled: {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 10,
    color: 'var(--v2-ink-3)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'default',
  },
  searchWrap: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  search: {
    width: 380,
    minWidth: 0,
    padding: '13px 14px',
    borderRadius: 12,
    border: '1px solid var(--v2-line)',
    background: 'var(--v2-bg-2)',
    color: 'var(--v2-ink-2)',
    fontSize: 14,
  },
  searchResults: {
    position: 'absolute' as const,
    top: 'calc(100% + 10px)',
    left: 0,
    width: 380,
    maxHeight: 320,
    overflowY: 'auto' as const,
    borderRadius: 14,
    border: '1px solid var(--v2-line)',
    background: 'var(--v2-bg-2)',
    boxShadow: '0 16px 42px rgba(0,0,0,0.38)',
    zIndex: 20,
    padding: 8,
    display: 'grid',
    gap: 6,
  },
  searchResultLink: {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid transparent',
    color: 'var(--v2-ink)',
    textDecoration: 'none',
    background: 'rgba(255,255,255,0.02)',
  },
  eyebrow: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 11,
    color: 'var(--v2-ink-3)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    marginBottom: 10,
  },
  heroRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 24,
    marginBottom: 28,
  },
  h1: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.12,
    letterSpacing: '-0.03em',
    fontWeight: 700,
    color: 'var(--v2-ink)',
  },
  subhead: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 1.7,
    color: 'var(--v2-ink-2)',
    maxWidth: 760,
  },
  card: {
    background: 'var(--v2-bg-2)',
    border: '1px solid var(--v2-line)',
    borderRadius: 16,
    padding: 20,
  },
  cardLabel: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 10,
    color: 'var(--v2-ink-3)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: 'var(--v2-ink)',
    marginBottom: 8,
  },
  statSub: {
    fontSize: 13,
    color: 'var(--v2-ink-3)',
  },
  estimateTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--v2-ink)',
    marginBottom: 4,
  },
  estimateMeta: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 12,
    color: 'var(--v2-ink-3)',
    lineHeight: 1.6,
  },
  emptyState: {
    padding: '14px 0',
    color: 'var(--v2-ink-3)',
    fontSize: 14,
  },
  mobileScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '18px 16px 100px',
    background: 'var(--v2-bg)',
  },
  mobileHeaderBar: {
    display: 'flex',
    justifyContent: 'center',
    fontFamily: 'var(--v2-mono)',
    fontSize: 11,
    color: 'var(--v2-ink-3)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    marginBottom: 14,
  },
  mobilePanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 18,
    padding: '14px 14px 22px',
    borderRadius: 30,
    border: '1px solid var(--v2-line)',
    background: 'linear-gradient(180deg, #0b0b0b 0%, #111111 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
  },
  mobileStatus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontFamily: 'var(--v2-mono)',
    fontSize: 12,
    color: 'var(--v2-ink)',
    padding: '4px 4px 0',
  },
  mobileStatusRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  mobileBrandRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '2px 4px 16px',
    borderBottom: '1px solid var(--v2-line)',
  },
  mobileBrandWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  mobileBrandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: 'linear-gradient(180deg, #f3f4f6 0%, #d4d4d8 100%)',
    color: '#0b0b0b',
    display: 'grid',
    placeItems: 'center',
    fontSize: 13,
    fontWeight: 800,
  },
  mobileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: 'rgba(74,222,128,0.14)',
    color: 'var(--v2-green-2)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'var(--v2-mono)',
  },
  mobileDate: {
    fontSize: 14,
    color: '#d8d8d8',
    fontWeight: 600,
  },
  mobileTitle: {
    margin: '4px 0 0',
    fontSize: 19,
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
    fontWeight: 700,
    color: 'var(--v2-ink)',
  },
  mobileStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  mobileStatCard: {
    background: 'var(--v2-bg-2)',
    border: '1px solid var(--v2-line)',
    borderRadius: 14,
    padding: 14,
  },
  mobileSectionLabel: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 10,
    color: 'var(--v2-ink-3)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
} as const

function formatToday() {
  const now = new Date()
  return now
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .replace(',', ' /')
    .toUpperCase()
}

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatVersionState(value: string | null | undefined) {
  return String(value ?? 'draft')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function buildSearchHaystack(estimate: HomeEstimate) {
  return `${estimate.version_name} ${estimate.job_title} ${estimate.customer_name} ${estimate.version_kind} ${estimate.version_state}`.toLowerCase()
}

export default function EstimatorV2HomePage() {
  const router = useRouter()

  const [data, setData] = useState<HomeData | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [jobQuery, setJobQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [versionName, setVersionName] = useState('')
  const [versionKind, setVersionKind] = useState<(typeof VERSION_KIND_OPTIONS)[number]['value']>('standard')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)

      const [homeRes, jobsRes] = await Promise.all([
        authedFetch('/api/estimates/v2/home', { cache: 'no-store' }),
        authedFetch('/api/jobs', { cache: 'no-store' }),
      ])

      const [homePayload, jobsPayload] = await Promise.all([
        homeRes.json().catch(() => null),
        jobsRes.json().catch(() => null),
      ])

      if (!active) return

      if (!homeRes.ok) {
        setError((homePayload as { error?: string } | null)?.error ?? homeRes.statusText)
        setData(null)
        setLoading(false)
        return
      }

      setData(homePayload as HomeData)

      const liveJobs = ((jobsPayload?.jobs ?? []) as JobRow[]).filter((j) => j.customer_id)
      setJobs(liveJobs)
      setSelectedJobId((current) => {
        if (current && liveJobs.some((j) => j.id === current)) return current
        return liveJobs[0]?.id ?? ''
      })
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const createVersion = async () => {
    if (!selectedJob) {
      setError('Select a job before creating a version.')
      return
    }
    setCreating(true)
    setError(null)
    const response = await authedFetch('/api/estimates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: selectedJob.id,
        customer_id: selectedJob.customer_id,
        version_kind: versionKind,
        ...(versionName.trim() ? { version_name: versionName.trim() } : {}),
      }),
    })
    const payload = await response.json().catch(() => null)
    setCreating(false)
    if (!response.ok) {
      setError(payload?.error ?? response.statusText)
      return
    }
    router.push(`/crm/estimates/${payload.id}/v2`)
  }

  // Reset form fields when selected job changes
  useEffect(() => {
    setVersionName('')
    setVersionKind('standard')
  }, [selectedJobId])

  const summaryCards = useMemo(() => {
    const summary = data?.summary ?? {
      draft_count: 0,
      sent_or_awaiting_count: 0,
      live_count: 0,
      pipeline_total: 0,
    }
    return [
      {
        label: 'Drafts',
        value: String(summary.draft_count),
        subtext: summary.draft_count === 1 ? '1 draft version' : `${summary.draft_count} draft versions`,
      },
      {
        label: 'Sent / Awaiting',
        value: String(summary.sent_or_awaiting_count),
        subtext:
          summary.sent_or_awaiting_count === 1
            ? '1 version attached to sent jobs'
            : `${summary.sent_or_awaiting_count} versions attached to sent jobs`,
      },
      {
        label: 'Live Versions',
        value: String(summary.live_count),
        subtext: summary.live_count === 1 ? '1 live version' : `${summary.live_count} live versions`,
        valueColor: 'var(--v2-green-2)',
        subtextColor: 'var(--v2-green-2)',
      },
      {
        label: 'Pipeline',
        value: formatCurrency(summary.pipeline_total),
        subtext: 'Rollup-backed total',
        valueColor: '#f9e2b7',
        subtextColor: 'var(--v2-ink-3)',
      },
    ]
  }, [data])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return (data?.search_estimates ?? [])
      .filter((estimate) => buildSearchHaystack(estimate).includes(q))
      .slice(0, 8)
  }, [data, searchQuery])

  const heroSummaryText = data
    ? `${data.search_estimates.length} total versions | ${data.summary.draft_count} drafts | ${data.summary.sent_or_awaiting_count} sent/awaiting | ${data.summary.live_count} live`
    : 'Build and track estimator versions with live status, totals, and search.'

  const filteredJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((j) => {
      const hay = `${j.title} ${j.customer_name ?? ''} ${j.customer_address ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [jobQuery, jobs])

  const selectedJob = useMemo(
  () => jobs.find((j) => j.id === selectedJobId) ?? null,
)

  const selectedJobVersions = useMemo(() => {
    if (!selectedJobId) return []
    return (data?.search_estimates ?? [])
      .filter((e) => e.job_id === selectedJobId)
      .sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return bTime - aTime
      })
  }, [data, selectedJobId])

  // Pre-compute version count per job to avoid O(n*m) in render
  const versionCountByJob = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of data?.search_estimates ?? []) {
      map[e.job_id] = (map[e.job_id] ?? 0) + 1
    }
    return map
  }, [data])

  const mobileSummaryCards = useMemo(() => [summaryCards[0], summaryCards[3]], [summaryCards])

  return (
    <div className="ace-v2-shell" style={S.main}>
      {/* ── Mobile view ── */}
      <div className="ace-v2-mobile-only" style={S.mobileScreen}>
        <div style={S.mobilePanel}>
          <div style={S.mobileBrandRow}>
            <div style={S.mobileBrandWrap}>
              <div style={S.mobileBrandMark}>A</div>
              <div style={{ ...S.brandName, fontSize: 16 }}>ACE CRM</div>
            </div>
            <div style={S.mobileAvatar}>AE</div>
          </div>

          <div>
            <div style={S.mobileDate}>{formatToday()}</div>
            <h1 style={S.mobileTitle}>Estimator home</h1>
          </div>

          <div style={S.mobileStats}>
            {mobileSummaryCards.map((card) => (
              <div key={`mobile-${card.label}`} style={S.mobileStatCard}>
                <div style={S.cardLabel}>{card.label}</div>
                <div style={{ ...S.statValue, fontSize: 18, marginBottom: 0 }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Mobile: job list — tap to go to create page */}
          <div>
            <div style={S.mobileSectionLabel}>Jobs</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {loading && (
                <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>Loading...</div>
              )}
              {!loading && jobs.length === 0 && (
                <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>
                  No eligible jobs yet.{' '}
                  <Link href="/crm/customers/new" style={{ color: 'var(--v2-green-2)' }}>
                    Add a contact
                  </Link>{' '}
                  first.
                </div>
              )}
              {jobs.slice(0, 10).map((job) => {
                const vCount = versionCountByJob[job.id] ?? 0
                return (
                  <Link
                    key={job.id}
                    href={`/crm/estimates/v2/create?job=${job.id}`}
                    style={{
                      display: 'block',
                      borderRadius: 14,
                      border: '1px solid var(--v2-line)',
                      background: '#111111',
                      padding: 14,
                      color: 'var(--v2-ink)',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ fontSize: 14, marginBottom: 3 }}>{job.title}</div>
                    <div style={{ fontSize: 14, color: 'var(--v2-ink-3)' }}>
                      {job.customer_name ?? 'Unknown customer'} · {vCount} version{vCount === 1 ? '' : 's'}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Desktop view ── */}
      <div className="ace-v2-desktop-only" style={{ ...S.content, ...S.desktopWrap }}>
        {/* Top bar */}
        <div style={S.topRow}>
          <div>
            <div style={S.brandWrap}>
              <div style={S.brandMark}>A</div>
              <div>
                <div style={S.brandName}>ACE CRM</div>
                <div style={S.brandSub}>Estimator V2</div>
              </div>
            </div>
            <div style={S.crumbs}>ACE CRM / ESTIMATOR V2 / HOME</div>
          </div>

          <div style={S.topControls}>
            <div style={S.searchWrap}>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Search estimate versions"
                style={S.search}
                aria-label="Search estimate versions"
              />
              {searchFocused && searchResults.length > 0 && (
                <div style={S.searchResults}>
                  {searchResults.map((estimate) => (
                    <Link
                      key={estimate.estimate_id}
                      href={`/crm/estimates/${estimate.estimate_id}/v2`}
                      style={S.searchResultLink}
                    >
                      <div style={S.estimateTitle}>{estimate.version_name}</div>
                      <div style={S.estimateMeta}>
                        {estimate.job_title}
                        <br />
                        {estimate.customer_name} / {formatVersionState(estimate.version_state)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <details style={S.settingsMenu}>
                <summary style={S.settingsSummary}>Settings & Constants</summary>
                <div style={S.settingsPanel}>
                  {SETTINGS_LINKS.map((item) =>
                    item.disabled ? (
                      <span key={item.label} style={S.settingsDisabled}>
                        {item.label}
                      </span>
                    ) : (
                      <Link key={item.label} href={item.href ?? '#'} style={S.settingsLink}>
                        {item.label}
                      </Link>
                    )
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Hero */}
        <div style={S.heroRow}>
          <div>
            <div style={S.eyebrow}>{formatToday()}</div>
            <h1 style={S.h1}>Estimator home</h1>
            <div style={S.subhead}>{heroSummaryText}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <Link
              href="/crm/jobs/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 18px',
                borderRadius: 12,
                border: '1px solid var(--v2-line)',
                background: 'var(--v2-bg-2)',
                color: 'var(--v2-ink)',
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              Create job
            </Link>
            <a
              href="#job-hub"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 18px',
                borderRadius: 12,
                border: '1px solid rgba(134,239,172,0.34)',
                background: '#8ad39b',
                color: '#062410',
                fontSize: 15,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              New estimate
            </a>
          </div>
        </div>

        {error && (
          <div
            style={{
              ...S.card,
              color: 'var(--v2-red)',
              marginBottom: 18,
              borderColor: 'rgba(248,113,113,0.28)',
              background: 'rgba(127,29,29,0.18)',
            }}
          >
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="ace-v2-home-stats">
          {summaryCards.map((card) => (
            <div key={card.label} style={S.card}>
              <div style={S.cardLabel}>{card.label}</div>
              <div style={{ ...S.statValue, color: ('valueColor' in card ? card.valueColor : undefined) ?? 'var(--v2-ink)' }}>
                {loading ? '...' : card.value}
              </div>
              <div style={{ ...S.statSub, color: ('subtextColor' in card ? card.subtextColor : undefined) ?? 'var(--v2-ink-3)' }}>
                {card.subtext}
              </div>
            </div>
          ))}
        </div>

        {/* Hub grid */}
        <div
          id="job-hub"
          className="v2-hub-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
            gap: 22,
          }}
        >
          {/* Left: job list */}
          <section
            style={{
              borderRadius: 18,
              border: '1px solid var(--v2-line)',
              background: 'var(--v2-bg-2)',
              padding: 18,
              display: 'grid',
              gap: 16,
              alignSelf: 'start',
            }}
          >
            <div>
              <div style={{ ...S.cardLabel, marginBottom: 10 }}>Jobs</div>
              <input
                value={jobQuery}
                onChange={(event) => setJobQuery(event.target.value)}
                placeholder="Search jobs by title, customer, or address"
                aria-label="Search jobs"
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--v2-line)',
                  background: '#111111',
                  color: 'var(--v2-ink)',
                  fontSize: 14,
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gap: 10,
                maxHeight: 620,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {loading && (
                <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>Loading jobs...</div>
              )}

              {!loading && filteredJobs.length === 0 && jobs.length > 0 && (
                <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>
                  No jobs match this search.
                </div>
              )}

              {!loading && jobs.length === 0 && (
                <div
                  style={{
                    borderRadius: 14,
                    border: '1px solid var(--v2-line)',
                    background: '#111111',
                    padding: 16,
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700 }}>No eligible jobs yet</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--v2-ink-3)' }}>
                    V2 creation starts from a job with a linked customer. Add the contact first,
                    then create the job in the normal CRM flow.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link
                      href="/crm/customers/new"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(134,239,172,0.24)',
                        background: 'rgba(74,222,128,0.08)',
                        color: '#b7f3c9',
                        textDecoration: 'none',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Add contact
                    </Link>
                    <Link
                      href="/crm/jobs"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--v2-line)',
                        background: 'transparent',
                        color: 'var(--v2-ink-2)',
                        textDecoration: 'none',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Open jobs
                    </Link>
                  </div>
                </div>
              )}

              {filteredJobs.map((job) => {
                const active = job.id === selectedJobId
                const versionCount = versionCountByJob[job.id] ?? 0
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setSelectedJobId(job.id)}
                    style={{
                      textAlign: 'left',
                      borderRadius: 14,
                      border: `1px solid ${active ? 'rgba(134,239,172,0.28)' : 'var(--v2-line)'}`,
                      background: active ? 'rgba(74,222,128,0.08)' : '#111111',
                      padding: 14,
                      color: 'var(--v2-ink)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{job.title}</div>
                    <div style={{ fontSize: 14, color: 'var(--v2-ink-3)' }}>
                      {job.customer_name ?? 'Unknown customer'}
                    </div>
                    <div style={{ fontFamily: 'var(--v2-mono)', fontSize: 11, color: 'var(--v2-ink-3)', marginTop: 4 }}>
                      {versionCount} version{versionCount === 1 ? '' : 's'}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Right: selected job + versions + create form */}
          <section style={{ display: 'grid', gap: 22, alignSelf: 'start' }}>
            {/* Selected job card */}
            <div
              style={{
                borderRadius: 18,
                border: '1px solid var(--v2-line)',
                background: 'var(--v2-bg-2)',
                padding: 20,
              }}
            >
              <div style={{ ...S.cardLabel, marginBottom: 10 }}>Selected Job</div>

              {!selectedJob && !loading && (
                <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>
                  Select a job from the left to view versions and create the next one.
                </div>
              )}

              {selectedJob && (
                <div style={{ display: 'grid', gap: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 26,
                          lineHeight: 1.1,
                          letterSpacing: '-0.03em',
                          fontWeight: 700,
                          color: 'var(--v2-ink)',
                        }}
                      >
                        {selectedJob.title}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7, color: 'var(--v2-ink-2)' }}>
                        {selectedJob.customer_name ?? 'Unknown customer'}
                        {selectedJob.customer_address ? ` | ${selectedJob.customer_address}` : ''}
                      </div>
                    </div>
                    <Link
                      href={`/crm/jobs/${selectedJob.id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '11px 14px',
                        borderRadius: 12,
                        border: '1px solid var(--v2-line)',
                        background: '#111111',
                        color: 'var(--v2-ink)',
                        textDecoration: 'none',
                        fontWeight: 700,
                      }}
                    >
                      Open job
                    </Link>
                  </div>

                  <div
                    className="v2-hub-job-stats"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 12,
                    }}
                  >
                    {[
                      { label: 'Customer', value: selectedJob.customer_name ?? 'Unknown' },
                      { label: 'Job Status', value: formatVersionState(selectedJob.status) },
                      { label: 'Versions', value: String(selectedJobVersions.length) },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        style={{
                          borderRadius: 14,
                          border: '1px solid var(--v2-line)',
                          background: '#111111',
                          padding: 14,
                        }}
                      >
                        <div style={{ ...S.cardLabel, marginBottom: 8 }}>{stat.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Versions + create form */}
            <div
              className="v2-hub-detail-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
                gap: 22,
              }}
            >
              {/* Existing versions */}
              <div
                style={{
                  borderRadius: 18,
                  border: '1px solid var(--v2-line)',
                  background: 'var(--v2-bg-2)',
                  padding: 20,
                  display: 'grid',
                  gap: 14,
                  alignSelf: 'start',
                }}
              >
                <div>
                  <div style={{ ...S.cardLabel, marginBottom: 8 }}>Existing Versions</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {selectedJob
                      ? `${selectedJobVersions.length} version${selectedJobVersions.length === 1 ? '' : 's'} under this job`
                      : 'Pick a job first'}
                  </div>
                </div>

                {!selectedJob && (
                  <div style={S.emptyState}>
                    Versions will appear here once a job is selected.
                  </div>
                )}

                {selectedJob && selectedJobVersions.length === 0 && (
                  <div style={S.emptyState}>
                    No V2 versions exist under this job yet. Use the panel on the right to create
                    the first one.
                  </div>
                )}

                {selectedJobVersions.map((estimate) => (
                  <div
                    key={estimate.estimate_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: 14,
                      alignItems: 'center',
                      borderTop: '1px solid var(--v2-line)',
                      paddingTop: 14,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--v2-ink)' }}>
                          {estimate.version_name ?? 'Estimate Version'}
                        </div>
                        {estimate.final_total != null && estimate.final_total > 0 && (
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--v2-green-2)' }}>
                            {formatCurrency(estimate.final_total)}
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 5, ...S.estimateMeta }}>
                        {formatVersionState(estimate.version_state)} / {formatVersionState(estimate.version_kind)}
                        {' · '}Updated {formatDateTime(estimate.updated_at)}
                      </div>
                    </div>
                    <Link
                      href={`/crm/estimates/${estimate.estimate_id}/v2`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(134,239,172,0.24)',
                        background: 'rgba(74,222,128,0.08)',
                        color: '#b7f3c9',
                        textDecoration: 'none',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Open version
                    </Link>
                  </div>
                ))}
              </div>

              {/* Create form */}
              <div
                style={{
                  borderRadius: 18,
                  border: '1px solid var(--v2-line)',
                  background: 'var(--v2-bg-2)',
                  padding: 20,
                  display: 'grid',
                  gap: 14,
                  alignSelf: 'start',
                }}
              >
                <div>
                  <div style={{ ...S.cardLabel, marginBottom: 8 }}>Create Version</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    Add the next estimate version
                  </div>
                  <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7, color: 'var(--v2-ink-3)' }}>
                    Creates a new estimate version linked to this job, then opens it in the workspace.
                  </div>
                </div>

                <label style={{ display: 'grid', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--v2-mono)',
                      fontSize: 10,
                      color: 'var(--v2-ink-3)',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Version Name
                  </span>
                  <input
                    value={versionName}
                    onChange={(event) => setVersionName(event.target.value)}
                    placeholder="Leave blank for the next default version name"
                    style={{
                      width: '100%',
                      padding: '13px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--v2-line)',
                      background: '#111111',
                      color: 'var(--v2-ink)',
                      fontSize: 14,
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--v2-mono)',
                      fontSize: 10,
                      color: 'var(--v2-ink-3)',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Version Kind
                  </span>
                  <select
                    value={versionKind}
                    onChange={(event) =>
                      setVersionKind(
                        event.target.value as (typeof VERSION_KIND_OPTIONS)[number]['value']
                      )
                    }
                    style={{
                      width: '100%',
                      padding: '13px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--v2-line)',
                      background: '#111111',
                      color: 'var(--v2-ink)',
                      fontSize: 14,
                    }}
                  >
                    {VERSION_KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => void createVersion()}
                  disabled={!selectedJob || creating || loading}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1px solid rgba(134,239,172,0.34)',
                    background:
                      creating || !selectedJob || loading
                        ? 'rgba(74,222,128,0.12)'
                        : '#8ad39b',
                    color:
                      creating || !selectedJob || loading ? '#9cd7ae' : '#062410',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor:
                      creating || !selectedJob || loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {creating ? 'Creating version...' : 'Create version'}
                </button>
              </div>
            </div>
          </section>
        </div>

        <style jsx>{`
          @media (max-width: 980px) {
            .v2-hub-grid {
              grid-template-columns: 1fr !important;
            }
            .v2-hub-detail-grid {
              grid-template-columns: 1fr !important;
            }
          }
          @media (max-width: 720px) {
            .v2-hub-job-stats {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
