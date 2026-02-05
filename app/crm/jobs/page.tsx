'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type JobStatus = 'estimate_scheduled' | 'estimate_sent' | 'scheduled' | 'completed' | 'lost'

type Job = {
  id: string
  customer_id: string
  customer_name: string | null
  customer_address: string | null
  title: string
  description: string | null
  status: JobStatus
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  completed_at: string | null
}

const columns: { key: JobStatus; title: string }[] = [
  { key: 'estimate_scheduled', title: 'Estimate scheduled' },
  { key: 'estimate_sent', title: 'Estimate sent' },
  { key: 'scheduled', title: 'Scheduled' },
  { key: 'completed', title: 'Completed' },
  { key: 'lost', title: 'Lost' },
]

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedQuery, setCompletedQuery] = useState('')
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  const [showLost, setShowLost] = useState(false)

  const grouped = useMemo(() => {
    const map: Record<JobStatus, Job[]> = {
      estimate_scheduled: [],
      estimate_sent: [],
      scheduled: [],
      completed: [],
      lost: [],
    }
    for (const j of jobs) map[j.status]?.push(j)
    return map
  }, [jobs])

  const load = async () => {
    setLoading(true)
    setError(null)

    const res = await authedFetch('/api/jobs', { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      setJobs([])
      setLoading(false)
      return
    }

    setJobs(payload?.jobs ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const patchJob = async (id: string, patch: any) => {
    const res = await authedFetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }

    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...payload.job } : j)))
  }

  const addToGoogleCalendar = async (args: {
    summary: string
    description?: string | null
    location?: string | null
    startIso: string
    endIso: string
  }) => {
    setError(null)
    const res = await authedFetch('/api/google-calendar/create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: args.summary,
        description: args.description ?? undefined,
        location: args.location ?? undefined,
        calendar_name: "Austin's work",
        start: args.startIso,
        end: args.endIso,
      }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return null
    }
    return payload?.event ?? null
  }

  const nowIso = () => new Date().toISOString()

  const formatDate = (iso: string | null) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  const addHours = (startIso: string, hours: number) => {
    const start = new Date(startIso)
    return new Date(start.getTime() + hours * 60 * 60 * 1000).toISOString()
  }

  const filteredCompleted = useMemo(() => {
    const q = completedQuery.trim().toLowerCase()
    let list = grouped.completed
    if (q) {
      list = list.filter((job) => {
        const address = (job.customer_address ?? '')
        const streetOnly = address.split(',')[0] ?? address
        const hay = `${job.title} ${job.customer_name ?? ''} ${address} ${streetOnly} ${job.description ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
    }
    list = [...list].sort((a, b) => {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bTime - aTime
    })
    if (!showAllCompleted && !q) return list.slice(0, 5)
    return list
  }, [completedQuery, grouped.completed, showAllCompleted])

  const stop =
    (fn: () => void) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      fn()
    }

  return (
    <div className="crm-page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="crm-topbar">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Jobs</h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Jobs move automatically when you set dates or mark things sent/completed.
          </div>
        </div>

        <div className="crm-actions" style={{ alignItems: 'center' }}>
          <button
            onClick={() => setShowLost((prev) => !prev)}
            style={{ ...actionButton, background: showLost ? '#111' : 'white', color: showLost ? 'white' : '#111', border: showLost ? '1px solid #111' : '1px solid #e5e7eb' }}
          >
            {showLost ? 'Hide lost' : 'Show lost'}
          </button>
          <button
            onClick={() => void load()}
            style={{ ...actionButton, background: 'white' }}
          >
            Refresh
          </button>
          <Link href="/crm/jobs/new" style={{ ...actionButton, background: '#111', color: 'white', border: '1px solid #111', textDecoration: 'none' }}>
            + Add job
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, background: '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: 12, color: '#991b1b' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 12, color: '#6b7280' }}>Loading...</div>
      ) : (
        <div className="crm-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 12 }}>
          {columns.filter((col) => (col.key === 'lost' ? showLost : true)).map((col) => (
            <div key={col.key} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>{col.title}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {col.key === 'completed' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input
                      type="search"
                      placeholder="Search completed..."
                      value={completedQuery}
                      onChange={(e) => setCompletedQuery(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: '1px solid #d1d5db',
                        fontSize: 13,
                        background: 'white',
                      }}
                    />
                    {!completedQuery && grouped.completed.length > 5 && (
                      <button
                        onClick={() => setShowAllCompleted((prev) => !prev)}
                        style={{ ...smallButton, width: 'fit-content' }}
                      >
                        {showAllCompleted ? 'Show last 5' : 'Show all'}
                      </button>
                    )}
                  </div>
                )}
                {(col.key === 'completed' ? filteredCompleted : grouped[col.key]).length === 0 && (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>No jobs</div>
                )}
                {(col.key === 'completed' ? filteredCompleted : grouped[col.key]).map((job) => (
                  <div
                    key={job.id}
                    onClick={() => router.push(`/crm/jobs/${job.id}`)}
                    style={{
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{job.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {job.customer_name ? job.customer_name : `Customer: ${job.customer_id}`}
                    </div>

                    {job.description && (
                      <div style={{ fontSize: 13, color: '#374151', marginTop: 8 }}>
                        {job.description}
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                      {job.estimate_date && <div>Estimate: {formatDate(job.estimate_date)}</div>}
                      {job.scheduled_date && <div>Scheduled: {formatDate(job.scheduled_date)}</div>}
                      {job.completed_at && <div>Completed: {formatDate(job.completed_at)}</div>}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      {job.status === 'estimate_scheduled' && (
                        <>
                          <button
                            onClick={stop(() => {
                              router.push(`/crm/jobs/${job.id}?compose=estimate_sent`)
                            })}
                            style={smallButton}
                          >
                            Review &amp; send estimate
                          </button>
                          <button
                            onClick={stop(() => void patchJob(job.id, { estimate_sent_at: nowIso() }))}
                            style={smallButton}
                          >
                            Mark estimate sent
                          </button>
                          <Link
                            href={`/crm/jobs/${job.id}/estimate`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                          >
                            Set estimate date
                          </Link>
                        </>
                      )}

                      {job.status === 'estimate_sent' && (
                        <>
                          <Link
                            href={`/crm/jobs/${job.id}/schedule`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                          >
                            Schedule job
                          </Link>
                          <button
                            onClick={stop(async () => {
                              router.push(`/crm/jobs/${job.id}?compose=follow_up`)
                            })}
                            style={smallButton}
                          >
                            Send follow up
                          </button>
                          <button
                            onClick={stop(() => {
                              const ok = window.confirm('Mark this job as lost?')
                              if (!ok) return
                              void patchJob(job.id, { status: 'lost' })
                            })}
                            style={{ ...smallButton, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}
                          >
                            Mark lost
                          </button>
                        </>
                      )}

                      {job.status === 'scheduled' && (
                        <>
                          <button
                            onClick={stop(() => {
                              router.push(`/crm/jobs/${job.id}?compose=scheduled`)
                            })}
                            style={smallButton}
                          >
                            Edit & send scheduled email
                          </button>
                          <button
                            onClick={stop(() => void patchJob(job.id, { completed_at: nowIso() }))}
                            style={smallButton}
                          >
                            Mark completed
                          </button>
                          <Link
                            href={`/crm/jobs/${job.id}/schedule`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                          >
                            Change scheduled date
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const actionButton: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: 'white',
  color: '#111',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
}

const smallButton: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  background: 'white',
  color: '#111',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}
