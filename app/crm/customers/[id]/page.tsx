'use client'

import { useCallback } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CustomerDetailCard } from '@/app/crm/customers/_components/CustomerDetailCard'
import { CustomerListSidebar } from '@/app/crm/customers/_components/CustomerListSidebar'
import { CustomerTimelinePanel } from '@/app/crm/customers/_components/CustomerTimelinePanel'
import { useEntityDetailActions } from '@/app/crm/_hooks/useEntityDetailActions'
import { useCustomerDetail } from '@/app/crm/customers/_hooks/useCustomerDetail'
import { useCustomerList } from '@/app/crm/customers/_hooks/useCustomerList'
import { useCustomerTimeline } from '@/app/crm/customers/_hooks/useCustomerTimeline'
import { useOrg } from '@/app/crm/customers/customers-orgproviders'

export default function CustomerDetailPage() {
  useOrg()
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query = searchParams.get('q') ?? ''
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)

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
    deleteCustomer,
  } = useCustomerDetail(id)
  const {
    customers,
    loading: listLoading,
    error: listError,
    search,
    setSearch,
  } = useCustomerList({
    initialSearch: query,
    initialPage: page,
  })
  const { timelineEvents, timelineLoading, timelineError, noteBody, setNoteBody, noteSaving, saveNote } =
    useCustomerTimeline(id)

  const listQueryString = searchParams.toString()
  const detailPathWithQuery = `${pathname}${listQueryString ? `?${listQueryString}` : ''}`
  const detailActions = useEntityDetailActions({
    deleteMessage: 'Delete this customer? This cannot be undone.',
    deleteAction: deleteCustomer,
  })

  return (
    <CrmPageShell className="max-w-6xl">
      <CrmPageHeader
        eyebrow="Relationship hub"
        emoji="👥"
        title={customer?.name ?? 'Customer details'}
        description="Customer profile, related timeline activity, and quick CRM actions."
        backHref="/crm/customers"
        backLabel="Back to customers"
      />

      <CrmDetailLayout
        main={
          <>
            <CustomerDetailCard
              customer={customer}
              loading={loading}
              error={error}
              statusMessage={detailActions.statusMessage}
              deleting={deleting}
              detailPathWithQuery={detailPathWithQuery}
              onBack={() => router.push('/crm/customers')}
              onCopy={(label, value) => void detailActions.copyValue(label, value)}
              onDelete={async () => {
                if (!id || typeof id !== 'string') return
                const deleted = await detailActions.confirmAndDelete()
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
          </>
        }
        side={
          <div className="hidden md:block">
            <CustomerListSidebar
              activeCustomerId={id}
              query={search}
              onQueryChange={(value) => {
                setSearch(value)
                updateParams({ q: value || null, page: null })
              }}
              listCustomers={customers}
              listLoading={listLoading}
              listError={listError}
              listQueryString={listQueryString}
            />
          </div>
        }
      />
    </CrmPageShell>
  )
}
