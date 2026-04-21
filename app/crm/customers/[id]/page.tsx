'use client'

import { CustomerDetailCard } from '@/app/crm/customers/_components/CustomerDetailCard'
import { CustomerListSidebar } from '@/app/crm/customers/_components/CustomerListSidebar'
import { CustomerTimelinePanel } from '@/app/crm/customers/_components/CustomerTimelinePanel'
import { useCustomerDetail } from '@/app/crm/customers/_hooks/useCustomerDetail'
import { useCustomerList } from '@/app/crm/customers/_hooks/useCustomerList'
import { useCustomerTimeline } from '@/app/crm/customers/_hooks/useCustomerTimeline'
import { useOrg } from '@/app/crm/customers/customers-orgproviders'
import { useCallback, useMemo } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function CustomerDetailPage() {
  useOrg()
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query = searchParams.get('q') ?? ''
  const hasParam = searchParams.get('has') ?? ''
  const hasSet = useMemo(
    () => new Set(hasParam.split(',').map((value) => value.trim()).filter(Boolean)),
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

  const {
    customer,
    loading,
    deleting,
    error,
    statusMessage,
    setStatusMessage,
    deleteCustomer,
  } = useCustomerDetail(id)
  const { listCustomers, listLoading, listError } = useCustomerList()
  const { timelineEvents, timelineLoading, timelineError, noteBody, setNoteBody, noteSaving, saveNote } =
    useCustomerTimeline(id)

  const filteredList = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase()
    return listCustomers.filter((customerRow) => {
      const matchesHas = (!hasEmail || Boolean(customerRow.email)) && (!hasPhone || Boolean(customerRow.phone))
      if (!matchesHas) return false
      if (!loweredQuery) return true
      const haystack =
        `${customerRow.name} ${customerRow.email ?? ''} ${customerRow.phone ?? ''} ${customerRow.address ?? ''}`.toLowerCase()
      return haystack.includes(loweredQuery)
    })
  }, [hasEmail, hasPhone, listCustomers, query])

  const listQueryString = searchParams.toString()
  const detailPathWithQuery = `${pathname}${listQueryString ? `?${listQueryString}` : ''}`

  const copy = useCallback(async (label: string, value: string | null) => {
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
    setStatusMessage(`${label} copied`)
    window.setTimeout(() => setStatusMessage(null), 1200)
  }, [setStatusMessage])

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="hidden w-full min-w-[220px] flex-1 md:block md:max-w-[320px]">
            <CustomerListSidebar
              activeCustomerId={id}
              query={query}
              hasEmail={hasEmail}
              hasPhone={hasPhone}
              hasSet={hasSet}
              listCustomers={listCustomers}
              filteredList={filteredList}
              listLoading={listLoading}
              listError={listError}
              listQueryString={listQueryString}
              updateParams={updateParams}
            />
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

            <CustomerDetailCard
              customer={customer}
              loading={loading}
              error={error}
              statusMessage={statusMessage}
              deleting={deleting}
              detailPathWithQuery={detailPathWithQuery}
              onBack={() => router.push('/crm/customers')}
              onCopy={(label, value) => void copy(label, value)}
              onDelete={async () => {
                if (!id || typeof id !== 'string') return
                const ok = window.confirm('Delete this customer? This cannot be undone.')
                if (!ok) return
                const deleted = await deleteCustomer()
                if (deleted) router.push('/crm/customers')
              }}
            />

            <CustomerTimelinePanel
              timelineEvents={timelineEvents}
              timelineLoading={timelineLoading}
              timelineError={timelineError}
              noteBody={noteBody}
              noteSaving={noteSaving}
              setNoteBody={setNoteBody}
              onAddNote={() => void saveNote()}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
