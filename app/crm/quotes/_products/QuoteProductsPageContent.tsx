'use client'

import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { useQuoteProductsPage } from '@/app/crm/quotes/_hooks/useQuoteProductsPage'
import { QuoteProductEditorSection } from './QuoteProductEditorSection'
import { QuoteProductsCatalogSection } from './QuoteProductsCatalogSection'

export function QuoteProductsPageContent() {
  const controller = useQuoteProductsPage()

  return (
    <CrmResourceState
      loading={controller.feedbackVm.loading}
      error={controller.feedbackVm.error}
      hasData={controller.feedbackVm.hasData}
      loadingTitle="Loading quote products"
      loadingDescription="Loading quote products..."
      errorTitle="Quote products unavailable"
      onRetry={() => void controller.resource.refresh()}
    >
      {controller.feedbackVm.notice ? (
        <CrmNotice tone="success">{controller.feedbackVm.notice}</CrmNotice>
      ) : null}
      {controller.error ? <CrmNotice tone="error">{controller.error}</CrmNotice> : null}

      <CrmDetailLayout
        main={<QuoteProductsCatalogSection controller={controller} />}
        side={<QuoteProductEditorSection controller={controller} />}
      />
    </CrmResourceState>
  )
}
