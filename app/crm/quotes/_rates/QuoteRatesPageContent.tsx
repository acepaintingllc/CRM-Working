'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { useQuoteRatesPage } from '@/app/crm/quotes/_hooks/useQuoteRatesPage'
import { QuoteRatesCategorySection } from './QuoteRatesCategorySection'
import { QuoteRatesEditorSection } from './QuoteRatesEditorSection'
import { QuoteRatesTableSection } from './QuoteRatesTableSection'

export function QuoteRatesPageContent() {
  const controller = useQuoteRatesPage()
  const handleRetry = controller.uiState.canRetry
    ? () => void controller.actions.reload(controller.selectedId || undefined)
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
              onClick={() => void controller.actions.reload(controller.selectedId || undefined)}
            >
              Refresh
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
        {controller.uiState.pageBanner ? (
          <CrmNotice tone={controller.uiState.pageBanner.tone}>
            {controller.uiState.pageBanner.message}
          </CrmNotice>
        ) : null}

        <CrmDetailLayout
          main={
            <div className="grid gap-4">
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
                saveCurrent: controller.actions.saveCurrent,
                cancelEdit: controller.actions.cancelEdit,
                setDraftActive: controller.actions.setDraftActive,
                updateDraftValue: controller.actions.updateDraftValue,
              }}
            />
          }
        />
      </CrmResourceState>
    </>
  )
}
