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
              onClick={() => void controller.actions.reload(controller.selectedId || undefined)}
            >
              Refresh
            </CrmButton>
          </>
        }
      />

      <CrmResourceState
        loading={controller.feedbackVm.loading}
        error={controller.resource.error}
        hasData={controller.feedbackVm.hasData}
        loadingTitle="Loading rates and flags"
        loadingDescription="Loading rates and flags..."
        errorTitle="Rates and flags unavailable"
        onRetry={() => void controller.actions.reload(controller.selectedId || undefined)}
      >
        {controller.feedbackVm.notice ? <CrmNotice tone="success">{controller.feedbackVm.notice}</CrmNotice> : null}
        {controller.error && !controller.resource.error ? (
          <CrmNotice tone="error">{controller.error}</CrmNotice>
        ) : null}

        <CrmDetailLayout
          main={
            <div className="grid gap-4">
              <QuoteRatesCategorySection controller={controller} />
              <QuoteRatesTableSection controller={controller} />
            </div>
          }
          side={<QuoteRatesEditorSection controller={controller} />}
        />
      </CrmResourceState>
    </>
  )
}
