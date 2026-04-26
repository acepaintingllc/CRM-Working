'use client'

import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { QuoteAdminPageBanner } from '@/app/crm/quotes/_components/QuoteAdminPageBanner'
import { useQuoteProductsPage } from '@/app/crm/quotes/_hooks/useQuoteProductsPage'
import { QuoteProductDeleteDialog } from './QuoteProductDeleteDialog'
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
      <QuoteAdminPageBanner banner={controller.uiState.pageBanner} />

      <CrmDetailLayout
        main={
          <QuoteProductsCatalogSection
            vm={controller.catalogVm}
            actions={{
              setSearch: controller.actions.setSearch,
              setStatusFilter: controller.actions.setStatusFilter,
              setScopeFilter: controller.actions.setScopeFilter,
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
              requestDelete: controller.actions.requestDelete,
            }}
          />
        }
      />
      <QuoteProductDiscardDialog
        vm={controller.discardVm}
        onConfirm={() => void controller.actions.confirmDiscard()}
        onCancel={controller.actions.cancelDiscard}
      />
      <QuoteProductDeleteDialog
        vm={controller.deleteVm}
        onConfirm={() => void controller.actions.confirmDelete()}
        onCancel={controller.actions.cancelDelete}
      />
    </CrmResourceState>
  )
}
