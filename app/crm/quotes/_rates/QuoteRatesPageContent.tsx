'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { QuoteAdminPageBanner } from '@/app/crm/quotes/_components/QuoteAdminPageBanner'
import { useQuoteRatesPage } from '@/app/crm/quotes/_hooks/useQuoteRatesPage'
import { QuoteRatesCategorySection } from './QuoteRatesCategorySection'
import { QuoteRatesDiscardDialog } from './QuoteRatesDiscardDialog'
import { QuoteRatesEditorSection } from './QuoteRatesEditorSection'
import { QuoteMeasurementAssumptionsSection } from './QuoteMeasurementAssumptionsSection'
import { QuoteRatesTableSection } from './QuoteRatesTableSection'
import { QuoteRatesUnsavedNavigationDialog } from './QuoteRatesUnsavedNavigationDialog'

export function QuoteRatesPageContent() {
  const controller = useQuoteRatesPage()
  const handleRetry = controller.uiState.canRetry
    ? () => void controller.actions.reload(controller.tableVm.selectedId || undefined)
    : null

  return (
    <>
      <CrmSearchBar
        value={controller.filtersVm.search}
        onChange={controller.actions.setSearch}
        placeholder="Search rows..."
        actions={
          <>
            <select
              className="ace-crm-input min-w-[120px] text-sm"
              value={controller.filtersVm.statusFilter}
              onChange={(event) =>
                controller.actions.setStatusFilter(event.target.value as 'active' | 'archived' | 'all')
              }
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
            <CrmButton
              type="button"
              disabled={!controller.uiState.canRetry}
              onClick={() => void controller.actions.reload(controller.tableVm.selectedId || undefined)}
            >
              Refresh
            </CrmButton>
            <CrmButton
              type="button"
              disabled={controller.editorVm.pendingChangesCount === 0 || controller.editorVm.busy}
              onClick={() => void controller.actions.discardBatch()}
            >
              Discard
            </CrmButton>
            <CrmButton
              type="button"
              tone="primary"
              disabled={!controller.uiState.canSave}
              onClick={() => void controller.actions.saveBatch()}
            >
              {controller.editorVm.saving ? 'Saving...' : 'Save changes'}
            </CrmButton>
          </>
        }
      />

      <CrmResourceState
        loading={controller.uiState.loading}
        error={controller.uiState.loadError}
        hasData={controller.uiState.hasData}
        loadingTitle="Loading rates and flags"
        loadingDescription="Loading rates and flags..."
        errorTitle="Rates and flags unavailable"
        onRetry={handleRetry}
      >
        <QuoteAdminPageBanner banner={controller.uiState.pageBanner} />

        {controller.filtersVm.activeTab === 'assumptions' ? (
          <div className="grid content-start gap-4">
            <QuoteRatesCategorySection
              filtersVm={controller.filtersVm}
              tableVm={{ activeCategory: controller.tableVm.activeCategory }}
              actions={{
                setActiveTab: controller.actions.setActiveTab,
                setRateSection: controller.actions.setRateSection,
                setRateCategory: controller.actions.setRateCategory,
                setFlagsSection: controller.actions.setFlagsSection,
                setRoomDefaultsSection: controller.actions.setRoomDefaultsSection,
              }}
            />
            <QuoteMeasurementAssumptionsSection />
          </div>
        ) : (
          <CrmDetailLayout
            main={
              <div className="grid content-start gap-4">
                <QuoteRatesCategorySection
                  filtersVm={controller.filtersVm}
                  tableVm={{ activeCategory: controller.tableVm.activeCategory }}
                  actions={{
                    setActiveTab: controller.actions.setActiveTab,
                    setRateSection: controller.actions.setRateSection,
                    setRateCategory: controller.actions.setRateCategory,
                    setFlagsSection: controller.actions.setFlagsSection,
                    setRoomDefaultsSection: controller.actions.setRoomDefaultsSection,
                  }}
                />
                <QuoteRatesTableSection
                  vm={controller.tableVm}
                  valueFromRow={controller.valueFromRow}
                  actions={{
                    startCreate: controller.actions.startCreate,
                    startDuplicate: controller.actions.startDuplicate,
                    archiveOrReactivate: controller.actions.archiveOrReactivate,
                    setSelectedId: controller.actions.setSelectedId,
                  }}
                />
              </div>
            }
            side={
              <QuoteRatesEditorSection
                vm={controller.editorVm}
                templateVersion={controller.resource.data.template_version}
                actions={{
                  cancelEdit: controller.actions.cancelEdit,
                  setDraftActive: controller.actions.setDraftActive,
                  updateDraftValue: controller.actions.updateDraftValue,
                  formatDraftValue: controller.actions.formatDraftValue,
                }}
              />
            }
          />
        )}
        <QuoteRatesDiscardDialog
          vm={controller.discardVm}
          onConfirm={() => void controller.actions.confirmDiscard()}
          onCancel={controller.actions.cancelDiscard}
        />
        <QuoteRatesUnsavedNavigationDialog
          vm={controller.leavePageVm}
          onSave={() => void controller.actions.saveAndLeave()}
          onDiscard={() => void controller.actions.discardAndLeave()}
          onCancel={controller.actions.cancelDiscard}
        />
      </CrmResourceState>
    </>
  )
}
