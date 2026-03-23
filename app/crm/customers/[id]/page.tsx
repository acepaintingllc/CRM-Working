'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  Circle,
  Copy,
  ExternalLink,
  Filter,
  Mail,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  Search,
  Trash2,
  User,
} from 'lucide-react'

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
  link_path: string | null
  link_label: string | null
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
    <div className="mt-3.5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 flex items-center">
        <div className="flex-1 text-base font-semibold text-gray-900">{value ?? '-'}</div>
      </div>
    </div>
  )

  const actionButtonClass =
    'inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70'
  const filterButtonClass =
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold transition focus:outline-none focus:ring-2 focus:ring-black/70'
  const smallActionChipClass =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70'

  const timelineVisual = (event: CustomerTimelineEvent) => {
    const combined = `${event.type} ${event.title ?? ''} ${event.link_label ?? ''}`.toLowerCase()
    if (combined.includes('note')) {
      return { icon: NotebookPen, nodeClass: 'bg-white text-gray-700 border-gray-300' }
    }
    if (combined.includes('estimate') && combined.includes('sched')) {
      return { icon: CalendarClock, nodeClass: 'bg-white text-gray-700 border-gray-300' }
    }
    if (combined.includes('job')) {
      return { icon: BriefcaseBusiness, nodeClass: 'bg-white text-gray-700 border-gray-300' }
    }
    return { icon: Circle, nodeClass: 'bg-white text-gray-500 border-gray-300' }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="hidden w-full min-w-[220px] flex-1 md:block md:max-w-[320px]">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="mb-2 text-sm font-black text-gray-900">Customers</div>
              <div className="relative">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => updateParams({ q: e.target.value || null })}
                  placeholder="Search customers"
                  className="h-10 w-full rounded-xl border border-gray-300 pl-8 pr-3 text-sm text-gray-900 outline-none ring-black/70 transition placeholder:text-gray-400 focus:ring-2"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  const next = new Set(hasSet)
                  if (next.has('email')) next.delete('email')
                  else next.add('email')
                  updateParams({ has: next.size ? Array.from(next).join(',') : null })
                }}
                className={`${filterButtonClass} ${
                  hasEmail
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Mail size={13} aria-hidden="true" />
                <span>Has email</span>
              </button>
              <button
                onClick={() => {
                  const next = new Set(hasSet)
                  if (next.has('phone')) next.delete('phone')
                  else next.add('phone')
                  updateParams({ has: next.size ? Array.from(next).join(',') : null })
                }}
                className={`${filterButtonClass} ${
                  hasPhone
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Phone size={13} aria-hidden="true" />
                <span>Has phone</span>
              </button>
              {(query || hasSet.size) && (
                <button
                  onClick={() => updateParams({ q: null, has: null })}
                  className={`${filterButtonClass} border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100`}
                >
                  <Filter size={13} aria-hidden="true" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="mt-2 text-xs text-gray-500">
              {listCustomers.length === 0
                ? 'No customers yet'
                : `Showing ${filteredList.length} of ${listCustomers.length}`}
            </div>

            <div className="mt-2">
              {listLoading && <div className="text-sm text-gray-500">Loading...</div>}
              {!listLoading && listError && <div className="text-sm text-red-700">{listError}</div>}
              {!listLoading && !listError && filteredList.length === 0 && (
                <div className="text-sm text-gray-500">No matches.</div>
              )}
              {!listLoading &&
                !listError &&
                filteredList.map((c) => {
                  const active = c.id === id
                  return (
                    <Link
                      key={c.id}
                      href={`/crm/customers/${c.id}${listQueryString ? `?${listQueryString}` : ''}`}
                      className={`mt-2 block rounded-xl border px-3 py-2 text-sm transition ${
                        active
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="inline-flex items-center gap-1.5 font-bold">
                        <User size={13} aria-hidden="true" />
                        <span>{c.name}</span>
                      </div>
                      {(c.email || c.phone) && (
                        <div className={`mt-0.5 text-xs leading-4 ${active ? 'text-gray-200' : 'text-gray-500'}`}>
                          {c.email && <div className="break-all">{c.email}</div>}
                          {c.phone && <div>{c.phone}</div>}
                        </div>
                      )}
                    </Link>
                  )
                })}
            </div>
          </div>
        </div>

        <div className="w-full min-w-0 flex-[3_1_480px]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="m-0 text-2xl font-bold text-gray-900">Customer details</h1>
              <p className="m-0 text-sm text-gray-500">Customer profile and quick actions.</p>
            </div>
            <button
              onClick={() => router.back()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back</span>
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {loading && <div className="text-gray-500">Loading customer...</div>}
            {!loading && message && <div className="text-red-700">{message}</div>}
            {!loading && !message && !customer && <div className="text-gray-500">Customer not found.</div>}

            {!loading && customer && (
              <>
                <div className="text-2xl font-bold text-gray-900">{customer.name}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className={actionButtonClass}>
                      <Mail size={16} aria-hidden="true" />
                      <span>Email</span>
                    </a>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className={actionButtonClass}>
                      <Phone size={16} aria-hidden="true" />
                      <span>Call</span>
                    </a>
                  )}
                  {customer.email && (
                    <button onClick={() => void copy('Email', customer.email)} className={actionButtonClass}>
                      <Copy size={16} aria-hidden="true" />
                      <span>Copy email</span>
                    </button>
                  )}
                  {customer.phone && (
                    <button onClick={() => void copy('Phone', customer.phone)} className={actionButtonClass}>
                      <Copy size={16} aria-hidden="true" />
                      <span>Copy phone</span>
                    </button>
                  )}
                  {customer.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={actionButtonClass}
                    >
                      <MapPin size={16} aria-hidden="true" />
                      <span>Map</span>
                    </a>
                  )}
                  <Link
                    href={`/crm/jobs/new?customerId=${customer.id}`}
                    className={actionButtonClass}
                  >
                    <BriefcaseBusiness size={16} aria-hidden="true" />
                    <span>Create job</span>
                  </Link>
                  <Link
                    href={`/crm/customers/${customer.id}/edit?returnTo=${encodeURIComponent(detailPathWithQuery)}`}
                    className={actionButtonClass}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    <span>Edit</span>
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
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
                    disabled={deleting}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>

                {renderRow('Email', customer.email)}
                {renderRow('Phone', customer.phone)}
                {renderRow(
                  'Created',
                  customer.created_at ? new Date(customer.created_at).toLocaleString() : null
                )}
              </>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold text-gray-900">Timeline</div>
                <div className="text-xs text-gray-500">Notes and key moments.</div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 text-sm font-semibold text-gray-800">Add a note</div>
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note about this customer..."
                rows={3}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 transition placeholder:text-gray-400 focus:ring-2"
              />
              <div className="mt-2 flex justify-end">
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black bg-black px-3 text-sm font-semibold text-white transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-black/80"
                  disabled={noteSaving}
                  aria-label={noteSaving ? 'Saving note' : 'Add note'}
                >
                  <NotebookPen size={16} aria-hidden="true" />
                  <span>{noteSaving ? 'Saving...' : 'Add note'}</span>
                </button>
              </div>
            </div>

            <div className="relative mt-4 pl-8">
              <div className="absolute bottom-0 left-3 top-0 w-px bg-gray-200" aria-hidden="true" />
              {timelineLoading && <div className="text-gray-500">Loading timeline...</div>}
              {!timelineLoading && timelineError && <div className="text-red-700">{timelineError}</div>}
              {!timelineLoading && !timelineError && timelineEvents.length === 0 && (
                <div className="text-gray-500">No timeline events yet.</div>
              )}
              {!timelineLoading &&
                !timelineError &&
                timelineEvents.map((event) => {
                  const visual = timelineVisual(event)
                  const EventIcon = visual.icon
                  return (
                    <div key={event.id} className="relative mb-3 last:mb-0">
                      <div
                        className={`absolute left-[-23px] top-3 inline-flex h-5 w-5 items-center justify-center rounded-full border ${visual.nodeClass}`}
                        aria-hidden="true"
                      >
                        <EventIcon size={12} />
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                        {event.title && (
                          <div className="font-semibold text-gray-900">{event.title}</div>
                        )}
                        <div className="mt-1 text-sm whitespace-pre-wrap text-gray-700">{event.body}</div>
                        {event.link_path && (
                          <div className="mt-2">
                            {event.link_path.startsWith('/api/') || event.link_path.startsWith('http') ? (
                              <a
                                href={event.link_path}
                                target="_blank"
                                rel="noreferrer"
                                className={smallActionChipClass}
                              >
                                <ExternalLink size={14} aria-hidden="true" />
                                <span>{event.link_label ?? 'Open'}</span>
                              </a>
                            ) : (
                              <Link href={event.link_path} className={smallActionChipClass}>
                                <ExternalLink size={14} aria-hidden="true" />
                                <span>{event.link_label ?? 'Open'}</span>
                              </Link>
                            )}
                          </div>
                        )}
                        <div className="mt-1.5 text-xs text-gray-400">
                          {event.created_at ? new Date(event.created_at).toLocaleString() : 'Unknown time'}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <Link
            href="/crm/customers"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-black bg-black px-3 py-2 text-sm font-semibold text-white transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-black/80"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to customers</span>
          </Link>
        </div>
      </div>
    </div>
    </div>
  )
}
