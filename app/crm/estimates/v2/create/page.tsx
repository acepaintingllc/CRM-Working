'use client'

import { loadData } from '@/lib/client/api'
import { createQuoteVersion, loadQuoteList } from '@/lib/quotes/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type JobRow = {
  id: string
  title: string
  customer_id: string
  customer_name: string | null
  customer_address?: string | null
  status: string
}

type EstimateRow = {
  id: string
  job_id: string
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  updated_at: string | null
}

const VERSION_KIND_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'alternate', label: 'Alternate' },
  { value: 'split', label: 'Split' },
  { value: 'combined', label: 'Combined' },
  { value: 'revision', label: 'Revision' },
] as const

function formatVersionState(value: string | null | undefined) {
  return String(value ?? 'draft')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function estimateWorkspaceHref(estimateId: string) {
  return `/crm/quotes/${estimateId}`
}

export default function EstimatorV2CreatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job') ?? ''

  const [job, setJob] = useState<JobRow | null>(null)
  const [estimates, setEstimates] = useState<EstimateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [versionName, setVersionName] = useState('')
  const [versionKind, setVersionKind] = useState<(typeof VERSION_KIND_OPTIONS)[number]['value']>('standard')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!jobId) return
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [jobsPayload, estimatesPayload] = await Promise.all([
          loadData<JobRow[]>('/api/jobs', { cache: 'no-store' }),
          loadQuoteList<{ estimates?: EstimateRow[] }>(),
        ])

        if (!active) return

        const found = jobsPayload.find((j) => j.id === jobId) ?? null
        setJob(found)
        setEstimates((estimatesPayload?.estimates ?? []) as EstimateRow[])
      } catch (error) {
        if (!active) return
        setError(error instanceof Error ? error.message : 'Failed to load quote creation data.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [jobId])

  const jobVersions = useMemo(
    () =>
      estimates
        .filter((e) => e.job_id === jobId)
        .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')),
    [estimates, jobId]
  )

  const createVersion = async () => {
    if (!job) return
    setCreating(true)
    setError(null)

    try {
      const payload = await createQuoteVersion<{ id: string }>({
        job_id: job.id,
        customer_id: job.customer_id,
        version_kind: versionKind,
        ...(versionName.trim() ? { version_name: versionName.trim() } : {}),
      })
      router.push(`/crm/quotes/${payload.id}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create quote.')
    } finally {
      setCreating(false)
    }
  }

  const mono: React.CSSProperties = { fontFamily: 'var(--v2-mono)' }
  const label: React.CSSProperties = { ...mono, fontSize: 10, color: 'var(--v2-ink-3)', letterSpacing: '0.16em', textTransform: 'uppercase' }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--v2-bg)',
        color: 'var(--v2-ink)',
        padding: '0 0 80px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 16px 14px',
          borderBottom: '1px solid var(--v2-line)',
          background: 'var(--v2-bg-2)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Link
          href="/crm/quotes"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid var(--v2-line)',
            background: 'transparent',
            color: 'var(--v2-ink-2)',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ← Back
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...label, marginBottom: 2 }}>Create Quote</div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--v2-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? '...' : (job?.title ?? 'Unknown job')}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px', display: 'grid', gap: 20 }}>
        {/* Error */}
        {error && (
          <div
            style={{
              borderRadius: 14,
              border: '1px solid rgba(248,113,113,0.28)',
              background: 'rgba(127,29,29,0.18)',
              color: '#fecaca',
              padding: 14,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* Job info */}
        {!loading && job && (
          <div
            style={{
              borderRadius: 16,
              border: '1px solid var(--v2-line)',
              background: 'var(--v2-bg-2)',
              padding: 16,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{job.title}</div>
            <div style={{ fontSize: 14, color: 'var(--v2-ink-2)' }}>
              {job.customer_name ?? 'Unknown customer'}
              {job.customer_address ? ` · ${job.customer_address}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                href={`/crm/jobs/${job.id}`}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--v2-line)',
                  background: '#111111',
                  color: 'var(--v2-ink)',
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Open job
              </Link>
            </div>
          </div>
        )}

        {/* Existing versions */}
        {!loading && jobVersions.length > 0 && (
          <div
            style={{
              borderRadius: 16,
              border: '1px solid var(--v2-line)',
              background: 'var(--v2-bg-2)',
              padding: 16,
              display: 'grid',
              gap: 0,
            }}
          >
            <div style={{ ...label, marginBottom: 12 }}>
              Existing Quotes ({jobVersions.length})
            </div>
            {jobVersions.map((estimate, i) => (
              <div
                key={estimate.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 12,
                  alignItems: 'center',
                  paddingTop: i === 0 ? 0 : 14,
                  paddingBottom: i < jobVersions.length - 1 ? 14 : 0,
                  borderBottom: i < jobVersions.length - 1 ? '1px solid var(--v2-line)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                    {estimate.version_name ?? 'Quote Version'}
                  </div>
                  <div style={{ ...mono, fontSize: 12, color: 'var(--v2-ink-3)', lineHeight: 1.6 }}>
                    {formatVersionState(estimate.version_state)} / {formatVersionState(estimate.version_kind)}
                    <br />
                    Updated {formatDateTime(estimate.updated_at)}
                  </div>
                </div>
                <Link
                  href={estimateWorkspaceHref(estimate.id)}
                  prefetch={false}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(134,239,172,0.24)',
                    background: 'rgba(74,222,128,0.08)',
                    color: '#b7f3c9',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Create form */}
        <div
          style={{
            borderRadius: 16,
            border: '1px solid rgba(134,239,172,0.2)',
            background: 'var(--v2-bg-2)',
            padding: 16,
            display: 'grid',
            gap: 16,
          }}
        >
          <div>
            <div style={{ ...label, marginBottom: 8 }}>New Version</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Add the next quote version
            </div>
          </div>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={label}>Version Name</span>
            <input
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="Leave blank for default name"
              style={{
                width: '100%',
                padding: '13px 14px',
                borderRadius: 12,
                border: '1px solid var(--v2-line)',
                background: '#111111',
                color: 'var(--v2-ink)',
                fontSize: 15,
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={label}>Version Kind</span>
            <select
              value={versionKind}
              onChange={(e) =>
                setVersionKind(e.target.value as (typeof VERSION_KIND_OPTIONS)[number]['value'])
              }
              style={{
                width: '100%',
                padding: '13px 14px',
                borderRadius: 12,
                border: '1px solid var(--v2-line)',
                background: '#111111',
                color: 'var(--v2-ink)',
                fontSize: 15,
              }}
            >
              {VERSION_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void createVersion()}
            disabled={!job || creating || loading}
            style={{
              width: '100%',
              padding: '15px 16px',
              borderRadius: 12,
              border: '1px solid rgba(134,239,172,0.34)',
              background: !job || creating || loading ? 'rgba(74,222,128,0.12)' : '#8ad39b',
              color: !job || creating || loading ? '#9cd7ae' : '#062410',
              fontSize: 15,
              fontWeight: 800,
              cursor: !job || creating || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {creating ? 'Creating version...' : 'Create version'}
          </button>
        </div>
      </div>
    </div>
  )
}
