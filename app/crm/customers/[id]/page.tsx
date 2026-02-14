'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type CustomerDetail = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  created_at: string | null
}

type CustomerListItem = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
}

type CustomerTimelineEvent = {
  id: string
  type: string
  title: string | null
  body: string
  created_at: string | null
  created_by: string | null
}

export default function CustomerDetailPage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query = searchParams.get('q') ?? ''
  const hasParam = searchParams.get('has') ?? ''
  const hasSet = useMemo(
    () => new Set(hasParam.split(',').map((v) => v.trim()).filter(Boolean)),
    [hasParam]
  )
  const hasEmail = hasSet.has('email')
  const hasPhone = hasSet.has('phone')

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (!value) params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [listCustomers, setListCustomers] = useState<CustomerListItem[]>([])

  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const [timelineEvents, setTimelineEvents] = useState<CustomerTimelineEvent[]>([])
  const [noteBody, setNoteBody] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  const copy = async (label: string, value: string | null) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const el = document.createElement('textarea')
      el.value = value
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setMessage(`${label} copied`)
    window.setTimeout(() => setMessage(null), 1200)
  }

  const loadCustomer = useCallback(async () => {
    if (typeof id !== 'string' || !id) {
      setCustomer(null)
      setLoading(false)
      setMessage('Missing customer id in URL.')
      return
    }

    setLoading(true)
    setMessage(null)

    const response = await authedFetch(`/api/customers/${id}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setCustomer(null)
      setLoading(false)
      setMessage(payload?.error ?? response.statusText)
      return
    }

    setCustomer(payload?.customer ?? null)
    setLoading(false)
  }, [id])

  const loadList = useCallback(async () => {
    setListLoading(true)
    setListError(null)

    const response = await authedFetch('/api/customers', { cache: 'no-store' })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setListError(payload?.error ?? response.statusText)
      setListCustomers([])
      setListLoading(false)
      return
    }

    setListCustomers(payload?.customers ?? [])
    setListLoading(false)
  }, [])

  const loadTimeline = useCallback(async () => {
    if (typeof id !== 'string' || !id) {
      setTimelineEvents([])
      setTimelineLoading(false)
      return
    }

    setTimelineLoading(true)
    setTimelineError(null)

    const response = await authedFetch(`/api/customers/${id}/timeline`, { cache: 'no-store' })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setTimelineError(payload?.error ?? response.statusText)
      setTimelineEvents([])
      setTimelineLoading(false)
      return
    }

    setTimelineEvents(payload?.events ?? [])
    setTimelineLoading(false)
  }, [id])

  useEffect(() => {
    void loadCustomer()
  }, [loadCustomer])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    void loadTimeline()
  }, [loadTimeline])

  useEffect(() => {
    const handler = () => {
      void loadCustomer()
      void loadList()
      void loadTimeline()
    }
    window.addEventListener('customers:refresh', handler)
    return () => window.removeEventListener('customers:refresh', handler)
  }, [loadCustomer, loadList, loadTimeline])

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase()
    return listCustomers.filter((c) => {
      const matchesHas =
        (!hasEmail || Boolean(c.email)) && (!hasPhone || Boolean(c.phone))
      if (!matchesHas) return false
      if (!q) return true
      const hay = `${c.name} ${c.email ?? ''} ${c.phone ?? ''} ${c.address ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [hasEmail, hasPhone, listCustomers, query])

  const listQueryString = searchParams.toString()
  const detailPathWithQuery = `${pathname}${listQueryString ? `?${listQueryString}` : ''}`

  const renderRow = (label: string, value: string | null | undefined) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', color: '#9ca3af' }}>
        {label}
      </div>
      <div className="crm-row-body" style={{ marginTop: 2 }}>
        <div style={{ fontSize: 16, fontWeight: 600, flex: '1 1 auto' }}>
          {value ?? '-'}
        </div>
      </div>
    </div>
  )

  return (
    <div className="crm-page" style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 12 }}>
      <div className="crm-split" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 220, maxWidth: 320 }}>
          <div className="crm-card" style={{ borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Customers</div>
            <input
              type="search"
              value={query}
              onChange={(e) => updateParams({ q: e.target.value || null })}
              placeholder="Search customers"
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: 14,
                width: '100%',
              }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button
                onClick={() => {
                  const next = new Set(hasSet)
                  if (next.has('email')) next.delete('email')
                  else next.add('email')
                  updateParams({ has: next.size ? Array.from(next).join(',') : null })
                }}
                style={{
                  ...filterButton,
                  background: hasEmail ? '#111' : 'white',
                  border: hasEmail ? '1px solid #111' : '1px solid #e5e7eb',
                  color: hasEmail ? 'white' : '#111',
                }}
              >
                Has email
              </button>
              <button
                onClick={() => {
                  const next = new Set(hasSet)
                  if (next.has('phone')) next.delete('phone')
                  else next.add('phone')
                  updateParams({ has: next.size ? Array.from(next).join(',') : null })
                }}
                style={{
                  ...filterButton,
                  background: hasPhone ? '#111' : 'white',
                  border: hasPhone ? '1px solid #111' : '1px solid #e5e7eb',
                  color: hasPhone ? 'white' : '#111',
                }}
              >
                Has phone
              </button>
              {(query || hasSet.size) && (
                <button
                  onClick={() => updateParams({ q: null, has: null })}
                  style={{ ...filterButton, background: '#f9fafb', border: '1px solid #e5e7eb' }}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
              {listCustomers.length === 0
                ? 'No customers yet'
                : `Showing ${filteredList.length} of ${listCustomers.length}`}
            </div>

            <div style={{ marginTop: 10 }}>
              {listLoading && <div style={{ fontSize: 13, color: '#6b7280' }}>Loading...</div>}
              {!listLoading && listError && (
                <div style={{ fontSize: 13, color: '#b91c1c' }}>{listError}</div>
              )}
              {!listLoading && !listError && filteredList.length === 0 && (
                <div style={{ fontSize: 13, color: '#6b7280' }}>No matches.</div>
              )}
              {!listLoading &&
                !listError &&
                filteredList.map((c) => {
                  const active = c.id === id
                  return (
                    <Link
                      key={c.id}
                      href={`/crm/customers/${c.id}${listQueryString ? `?${listQueryString}` : ''}`}
                      style={{
                        display: 'block',
                        padding: '8px 10px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        color: active ? 'white' : '#111',
                        background: active ? '#111' : 'white',
                        border: active ? '1px solid #111' : '1px solid #e5e7eb',
                        marginTop: 8,
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      <div>{c.name}</div>
                      {(c.email || c.phone) && (
                        <div style={{ fontSize: 11, color: active ? '#e5e7eb' : '#6b7280', marginTop: 2 }}>
                          {[c.email, c.phone].filter(Boolean).join(' | ')}
                        </div>
                      )}
                    </Link>
                  )
                })}
            </div>
          </div>
        </div>

        <div style={{ flex: '3 1 480px', minWidth: 280 }}>
          <div className="crm-topbar" style={{ marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Customer details</h1>
              <p style={{ margin: 0, color: '#6b7280' }}>Customer profile and contact info.</p>
            </div>
            <button
              onClick={() => router.back()}
              style={{
                border: '1px solid #d1d5db',
                borderRadius: 10,
                background: 'white',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          </div>

          <div className="crm-card" style={{ borderRadius: 12, padding: 20 }}>
            {loading && <div style={{ color: '#6b7280' }}>Loading customer...</div>}
            {!loading && message && <div style={{ color: '#b91c1c' }}>{message}</div>}
            {!loading && !message && !customer && <div style={{ color: '#6b7280' }}>Customer not found.</div>}

            {!loading && customer && (
              <>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{customer.name}</div>
                <div className="crm-actions" style={{ marginTop: 10 }}>
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} style={actionButton}>
                      Email
                    </a>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} style={actionButton}>
                      Call
                    </a>
                  )}
                  {customer.email && (
                    <button onClick={() => void copy('Email', customer.email)} style={actionButton}>
                      Copy email
                    </button>
                  )}
                  {customer.phone && (
                    <button onClick={() => void copy('Phone', customer.phone)} style={actionButton}>
                      Copy phone
                    </button>
                  )}
                  {customer.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...actionButton, textDecoration: 'none' }}
                    >
                      Map
                    </a>
                  )}
                  <Link
                    href={`/crm/jobs/new?customerId=${customer.id}`}
                    style={{ ...actionButton, textDecoration: 'none' }}
                  >
                    Create job
                  </Link>
                  <Link
                    href={`/crm/customers/${customer.id}/edit?returnTo=${encodeURIComponent(detailPathWithQuery)}`}
                    style={{ ...actionButton, textDecoration: 'none' }}
                  >
                    Edit
                  </Link>
                  <button
                    onClick={async () => {
                      if (!id || typeof id !== 'string') return
                      const ok = window.confirm('Delete this customer? This cannot be undone.')
                      if (!ok) return
                      setDeleting(true)
                      const res = await authedFetch(`/api/customers/${id}`, { method: 'DELETE' })
                      const payload = await res.json().catch(() => null)
                      setDeleting(false)
                      if (!res.ok) {
                        setMessage(payload?.error ?? res.statusText)
                        return
                      }
                      router.push('/crm/customers')
                    }}
                style={{ ...actionButton, background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b' }}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>

                {renderRow('Email', customer.email)}
                {renderRow('Phone', customer.phone)}
                {renderRow('Address', customer.address)}
                {renderRow(
                  'Created',
                  customer.created_at ? new Date(customer.created_at).toLocaleString() : null
                )}
              </>
            )}
          </div>

          <div className="crm-card" style={{ borderRadius: 12, padding: 20, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Timeline</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Notes and key moments.</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note about this customer..."
                rows={3}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: '1px solid #d1d5db',
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={async () => {
                    if (!noteBody.trim() || !id || typeof id !== 'string') return
                    setNoteSaving(true)
                    const res = await authedFetch(`/api/customers/${id}/timeline`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ body: noteBody.trim() }),
                    })
                    const payload = await res.json().catch(() => null)
                    setNoteSaving(false)
                    if (!res.ok) {
                      setTimelineError(payload?.error ?? res.statusText)
                      return
                    }
                    setNoteBody('')
                    void loadTimeline()
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: '#111',
                    color: 'white',
                    border: '1px solid #111',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  disabled={noteSaving}
                >
                  {noteSaving ? 'Saving...' : 'Add note'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              {timelineLoading && <div style={{ color: '#6b7280' }}>Loading timeline...</div>}
              {!timelineLoading && timelineError && <div style={{ color: '#b91c1c' }}>{timelineError}</div>}
              {!timelineLoading && !timelineError && timelineEvents.length === 0 && (
                <div style={{ color: '#6b7280' }}>No timeline events yet.</div>
              )}
              {!timelineLoading &&
                !timelineError &&
                timelineEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      padding: '10px 12px',
                      marginTop: 10,
                      background: 'white',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>
                      {event.type.toUpperCase()}
                    </div>
                    {event.title && (
                      <div style={{ marginTop: 4, fontWeight: 700 }}>{event.title}</div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 14, whiteSpace: 'pre-wrap' }}>{event.body}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#9ca3af' }}>
                      {event.created_at ? new Date(event.created_at).toLocaleString() : 'Unknown time'}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <Link
            href="/crm/customers"
            style={{
              display: 'inline-flex',
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#111',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Back to customers
          </Link>
        </div>
      </div>
    </div>
  )
}

const actionButton: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 10,
  background: 'white',
  padding: '6px 10px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 13,
}

const filterButton: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
}
