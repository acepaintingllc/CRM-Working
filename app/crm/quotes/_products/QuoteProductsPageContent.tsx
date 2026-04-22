'use client'

import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { useQuoteProductsPage } from '@/app/crm/quotes/_hooks/useQuoteProductsPage'
import { QuoteProductEditorSection } from './QuoteProductEditorSection'
import { QuoteProductsCatalogSection } from './QuoteProductsCatalogSection'

export function QuoteProductsPageContent() {
  const controller = useQuoteProductsPage()
  const handleRetry = controller.uiState.canRetry ? () => void controller.resource.refresh() : null

  return (
    <CrmResourceState
      loading={controller.uiState.loading}
      error={controller.uiState.loadError}
      hasData={controller.uiState.hasData}
      loadingTitle="Loading quote products"
      loadingDescription="Loading quote products..."
      errorTitle="Quote products unavailable"
      onRetry={handleRetry}
    >
      {controller.uiState.pageBanner ? (
        <CrmNotice tone={controller.uiState.pageBanner.tone}>
          {controller.uiState.pageBanner.message}
        </CrmNotice>
      ) : null}

      <CrmDetailLayout
        main={<QuoteProductsCatalogSection controller={controller} />}
        side={<QuoteProductEditorSection controller={controller} />}
      />
    </CrmResourceState>
  )
}
