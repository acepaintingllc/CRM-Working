'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type {
  QuoteProductsActions,
  QuoteProductsCatalogVm,
} from '@/app/crm/quotes/_hooks/useQuoteProductsPage'
import type { ProductFamily } from '@/lib/quotes/productsForm'
import { formatQuoteProductMeta, formatQuoteProductStats } from './quoteProductPresentation'

type Props = {
  vm: QuoteProductsCatalogVm
  actions: Pick<
    QuoteProductsActions,
    'setSearch' | 'setStatusFilter' | 'setActiveFamily' | 'setSelectedId' | 'startCreate'
  >
}

export function QuoteProductsCatalogSection({ vm, actions }: Props) {
  return (
    <>
      <CrmSearchBar
        value={vm.search}
        onChange={actions.setSearch}
        placeholder={`Search ${vm.activeFamily.toLowerCase()} products...`}
        actions={
          <>
            <select
              className="ace-crm-input min-w-[120px] text-sm"
              value={vm.statusFilter}
              onChange={(event) => actions.setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
            {vm.families.map((family) => (
              <CrmButton
                key={family}
                type="button"
                tone={family === vm.activeFamily ? 'primary' : 'secondary'}
                onClick={() => actions.setActiveFamily(family as ProductFamily)}
              >
                {family}
              </CrmButton>
            ))}
          </>
        }
      />

      <CrmSectionCard
        title={`${vm.activeFamily} catalog`}
        description="Select a product row from the current family to edit its defaults and pricing."
      >
        <div className="grid gap-3">
          <CrmButton type="button" tone="secondary" onClick={actions.startCreate}>
            New product
          </CrmButton>
          {vm.filtered.length === 0 ? (
            <CrmEmptyState
              title="No products found"
              description="Try a different search, family, or status filter."
            />
          ) : (
            vm.filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => actions.setSelectedId(product.id)}
                className={`rounded-2xl border px-4 py-3 text-left ${
                  vm.selected?.id === product.id
                    ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)]'
                    : 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)]'
                }`}
              >
                <div className="font-black text-[color:var(--crm-ui-text)]">{product.name}</div>
                <div className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">
                  {formatQuoteProductMeta(product)}
                </div>
                <div className="mt-1 text-xs text-[color:var(--crm-ui-muted)]">
                  {formatQuoteProductStats(product)}
                </div>
              </button>
            ))
          )}
        </div>
      </CrmSectionCard>
    </>
  )
}
