'use client'

import { CrmEntityFormPage } from '@/app/crm/_components/CrmEntityFormPage'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { QuoteAdminPageBanner } from '@/app/crm/quotes/_components/QuoteAdminPageBanner'
import { QuoteDefaultsForm } from '@/app/crm/quotes/_components/QuoteDefaultsForm'
import { useQuoteDefaultsPage } from '@/app/crm/quotes/_hooks/useQuoteDefaultsPage'

export function QuoteDefaultsPageContent() {
  const controller = useQuoteDefaultsPage()

  return (
    <CrmResourceState
      loading={controller.feedback.loading}
      error={controller.feedback.loadError}
      hasData={controller.feedback.hasLoaded}
      loadingTitle="Loading quote defaults"
      loadingDescription="Loading quote defaults..."
      errorTitle="Quote defaults unavailable"
      onRetry={() => void controller.actions.reload()}
    >
      <QuoteAdminPageBanner banner={controller.feedback.pageBanner} />
      <CrmEntityFormPage
        title="Quote defaults"
        description="Paint, primer, and labor defaults follow the shared CRM editable-resource pattern."
        error={null}
        notice={null}
        validationError={controller.form.validationError}
        saveLabel="Save defaults"
        savingLabel="Saving..."
        saving={controller.feedback.saving}
        canSave={controller.form.canSave}
        onSave={() => void controller.actions.save()}
      >
        <QuoteDefaultsForm
          value={controller.form.settings}
          sections={controller.form.sections}
          onChange={controller.actions.setSettings}
        />
      </CrmEntityFormPage>
    </CrmResourceState>
  )
}
