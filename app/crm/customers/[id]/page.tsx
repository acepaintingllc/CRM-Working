'use client'

import { useParams, useRouter } from 'next/navigation'
import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CustomerDetailCard } from '@/app/crm/customers/_components/CustomerDetailCard'
import { CustomerTimelinePanel } from '@/app/crm/customers/_components/CustomerTimelinePanel'
import { useEntityDetailActions } from '@/app/crm/_hooks/useEntityDetailActions'
import { useCustomerDetail } from '@/app/crm/customers/_hooks/useCustomerDetail'
import { useCustomerTimeline } from '@/app/crm/customers/_hooks/useCustomerTimeline'
import { useOrg } from '@/app/crm/customers/customers-orgproviders'

export default function CustomerDetailPage() {
  useOrg()
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()

  const {
    customer,
    loading,
    deleting,
    error,
    deleteCustomer,
  } = useCustomerDetail(id)
  const { timelineEvents, timelineLoading, timelineError, noteBody, setNoteBody, noteSaving, saveNote } =
    useCustomerTimeline(id)

  const detailPathWithQuery = typeof id === 'string' && id ? `/crm/customers/${id}` : '/crm/customers'
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
      />
    </CrmPageShell>
  )
}
