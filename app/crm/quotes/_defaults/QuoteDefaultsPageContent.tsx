'use client'

import { CrmEntityFormPage } from '@/app/crm/_components/CrmEntityFormPage'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { QuoteDefaultsForm } from '@/app/crm/quotes/_components/QuoteDefaultsForm'
import { useQuoteDefaultsPage } from '@/app/crm/quotes/_hooks/useQuoteDefaultsPage'

export function QuoteDefaultsPageContent() {
  const controller = useQuoteDefaultsPage()

  return (
    <CrmResourceState
      loading={controller.feedbackVm.loading}
      error={controller.feedbackVm.error}
      hasData={controller.feedbackVm.hasLoaded}
      loadingTitle="Loading quote defaults"
      loadingDescription="Loading quote defaults..."
      errorTitle="Quote defaults unavailable"
      onRetry={() => void controller.actions.reload()}
    >
      <CrmEntityFormPage
        title="Quote defaults"
        description="Paint, primer, and labor defaults follow the shared CRM editable-resource pattern."
        error={controller.feedbackVm.error}
        notice={controller.feedbackVm.notice}
        validationError={controller.formVm.validationError}
        saveLabel="Save defaults"
        savingLabel="Saving..."
        saving={controller.feedbackVm.saving}
        canSave={controller.formVm.canSave}
        onSave={() => void controller.actions.save()}
      >
        <QuoteDefaultsForm
          value={controller.formVm.settings}
          productDefaultFields={controller.formVm.productDefaultFields}
          onChange={controller.actions.setSettings}
        />
      </CrmEntityFormPage>
    </CrmResourceState>
  )
}
