'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { QuoteRatesActions, QuoteRatesTableVm } from '@/app/crm/quotes/_hooks/useQuoteRatesPage'
import { getRatesRowStatusLabel } from './quoteRatesPresentation'

type Props = {
  vm: QuoteRatesTableVm
  valueFromRow: (row: QuoteRatesTableVm['filteredRows'][number], key: string) => string
  actions: Pick<
    QuoteRatesActions,
    'startCreate' | 'startDuplicate' | 'archiveOrReactivate' | 'setSelectedId'
  >
}

export function QuoteRatesTableSection({ vm, valueFromRow, actions }: Props) {
  const activeCategory = vm.activeCategory

  return (
    <CrmSectionCard
      title={vm.activeCategory?.table_title ?? 'Rows'}
      description="Catalog rows in the active category."
      actions={
        <div className="flex flex-wrap gap-2">
          <CrmButton type="button" onClick={actions.startCreate}>
            Add
          </CrmButton>
          <CrmButton type="button" onClick={actions.startDuplicate} disabled={!vm.canDuplicate}>
            Duplicate
          </CrmButton>
          <CrmButton
            type="button"
            tone={vm.selectedRow?.active ? 'danger' : 'secondary'}
            onClick={() => void actions.archiveOrReactivate(!(vm.selectedRow?.active ?? false))}
            disabled={!vm.canArchiveToggle}
          >
            {vm.selectedRow?.active ? 'Archive' : 'Reactivate'}
          </CrmButton>
        </div>
      }
    >
      {!activeCategory ? (
        <CrmEmptyState title="No category" description="Choose a category to view rows." />
      ) : vm.filteredRows.length === 0 ? (
        <CrmEmptyState
          title="No rows found"
          description="Try a broader search or a different status filter."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--crm-ui-border)]">
                {activeCategory.columns.map((column) => (
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
              {vm.filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-[color:var(--crm-ui-border)] ${
                    !vm.isCreating && vm.selectedId === row.id ? 'bg-[color:var(--crm-ui-accent-soft)]' : ''
                  }`}
                  onClick={() => {
                    actions.setSelectedId(row.id)
                  }}
                >
                  {activeCategory.columns.map((column) => (
                    <td key={`${row.id}-${column.key}`} className="px-3 py-2">
                      {column.key === 'active' ? (
                        <span className="inline-flex rounded-full border border-[color:var(--crm-ui-accent-border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--crm-ui-accent)]">
                          {getRatesRowStatusLabel(row.active)}
                        </span>
                      ) : (
                        valueFromRow(row, column.key) || '--'
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
