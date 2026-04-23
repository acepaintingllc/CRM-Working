'use client'

import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { useQuoteProductsPage } from '@/app/crm/quotes/_hooks/useQuoteProductsPage'
import { QuoteProductEditorSection } from './QuoteProductEditorSection'
import { QuoteProductDiscardDialog } from './QuoteProductDiscardDialog'
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
        main={
          <QuoteProductsCatalogSection
            vm={controller.catalogVm}
            actions={{
              setSearch: controller.actions.setSearch,
              setStatusFilter: controller.actions.setStatusFilter,
              setActiveFamily: controller.actions.setActiveFamily,
              setSelectedId: controller.actions.setSelectedId,
              startCreate: controller.actions.startCreate,
            }}
          />
        }
        side={
          <QuoteProductEditorSection
            vm={controller.editorVm}
            actions={{
              updateDraftField: controller.actions.updateDraftField,
              save: controller.actions.save,
              cancelEdit: controller.actions.cancelEdit,
              requestRemove: controller.actions.requestRemove,
            }}
          />
        }
      />
      <QuoteProductDiscardDialog
        vm={controller.discardVm}
        onConfirm={() => void controller.actions.confirmDiscard()}
        onCancel={controller.actions.cancelDiscard}
      />
    </CrmResourceState>
  )
}
