'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useQuoteRatesPage } from '@/app/crm/quotes/_hooks/useQuoteRatesPage'
import { getRatesRowStatusLabel } from './quoteRatesPresentation'

type QuoteRatesController = ReturnType<typeof useQuoteRatesPage>

export function QuoteRatesTableSection({
  controller,
}: {
  controller: QuoteRatesController
}) {
  return (
    <CrmSectionCard
      title={controller.tableVm.activeCategory?.table_title ?? 'Rows'}
      description="Catalog rows in the active category."
      actions={
        <div className="flex flex-wrap gap-2">
          <CrmButton type="button" onClick={controller.actions.startCreate}>
            Add
          </CrmButton>
          <CrmButton
            type="button"
            onClick={controller.actions.startDuplicate}
            disabled={!controller.tableVm.selectedRow || controller.editorVm.saving}
          >
            Duplicate
          </CrmButton>
          <CrmButton
            type="button"
            tone={controller.tableVm.selectedRow?.active ? 'danger' : 'secondary'}
            onClick={() =>
              void controller.actions.archiveOrReactivate(!(controller.tableVm.selectedRow?.active ?? false))
            }
            disabled={!controller.tableVm.selectedRow || controller.tableVm.isCreating || controller.editorVm.saving}
          >
            {controller.tableVm.selectedRow?.active ? 'Archive' : 'Reactivate'}
          </CrmButton>
        </div>
      }
    >
      {!controller.tableVm.activeCategory ? (
        <CrmEmptyState title="No category" description="Choose a category to view rows." />
      ) : controller.tableVm.filteredRows.length === 0 ? (
        <CrmEmptyState
          title="No rows found"
          description="Try a broader search or a different status filter."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--crm-ui-border)]">
                {controller.tableVm.activeCategory.columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--crm-ui-muted)]"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {controller.tableVm.filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-[color:var(--crm-ui-border)] ${
                    !controller.tableVm.isCreating && controller.tableVm.selectedId === row.id
                      ? 'bg-[color:var(--crm-ui-accent-soft)]'
                      : ''
                  }`}
                  onClick={() => {
                    controller.actions.setSelectedId(row.id)
                  }}
                >
                  {controller.tableVm.activeCategory?.columns.map((column) => (
                    <td key={`${row.id}-${column.key}`} className="px-3 py-2">
                      {column.key === 'active' ? (
                        <span className="inline-flex rounded-full border border-[color:var(--crm-ui-accent-border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--crm-ui-accent)]">
                          {getRatesRowStatusLabel(row.active)}
                        </span>
                      ) : (
                        controller.valueFromRow(row, column.key) || '--'
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CrmSectionCard>
  )
}
