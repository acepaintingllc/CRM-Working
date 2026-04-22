'use client'

import { SlidersHorizontal } from 'lucide-react'
import { CrmEntityFormPage } from '@/app/crm/_components/CrmEntityFormPage'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { QuoteDefaultsForm } from '@/app/crm/quotes/_components/QuoteDefaultsForm'
import { useQuoteDefaultsPage } from '@/app/crm/quotes/_hooks/useQuoteDefaultsPage'

export default function QuoteDefaultsPage() {
  const controller = useQuoteDefaultsPage()

  return (
    <CrmPageShell className="max-w-5xl">
      <CrmPageHeader
        eyebrow="Quotes"
        emoji="🧰"
        title="Quote Defaults"
        description="Org-level defaults for new quotes. Quote validity and terms stay on the send settings page."
        backHref="/crm/quotes"
        backLabel="Back to quotes"
        meta={<SlidersHorizontal size={16} aria-hidden="true" />}
      />

      <CrmResourceState
        loading={controller.resource.loading}
        error={controller.resource.error}
        hasData={controller.resource.hasLoaded}
        loadingTitle="Loading quote defaults"
        loadingDescription="Loading quote defaults..."
        errorTitle="Quote defaults unavailable"
        onRetry={() => void controller.resource.reload()}
      >
        <CrmEntityFormPage
          title="Quote defaults"
          description="Paint, primer, and labor defaults follow the shared CRM editable-resource pattern."
          error={controller.resource.error}
          notice={controller.resource.notice}
          validationError={controller.validationError}
          saveLabel="Save defaults"
          savingLabel="Saving..."
          saving={controller.resource.saving}
          canSave={controller.canSave}
          onSave={() => void controller.resource.saveChanges()}
        >
          <QuoteDefaultsForm
            value={controller.resource.data.settings}
            productDefaultFields={controller.productDefaultFields}
            onChange={(next) =>
              controller.resource.setData((current) => ({ ...current, settings: next }))
            }
          />
        </CrmEntityFormPage>
      </CrmResourceState>
    </CrmPageShell>
  )
}
