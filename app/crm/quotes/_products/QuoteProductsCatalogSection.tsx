'use client'

import { FlaskConical, Paintbrush } from 'lucide-react'
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
    | 'setSearch'
    | 'setStatusFilter'
    | 'setScopeFilter'
    | 'setActiveFamily'
    | 'setSelectedId'
    | 'startCreate'
  >
}

export function QuoteProductsCatalogSection({ vm, actions }: Props) {
  return (
    <>
      <div className="ace-crm-surface grid gap-3 px-4 py-4">
        <div className="text-xs font-black uppercase text-[color:var(--crm-ui-muted)]">
          Product family
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {vm.families.map((family) => {
            const active = family === vm.activeFamily
            const Icon = family === 'Paint' ? Paintbrush : FlaskConical
            return (
              <button
                key={family}
                type="button"
                aria-pressed={active}
                onClick={() => actions.setActiveFamily(family as ProductFamily)}
                className={`flex min-h-16 items-center justify-center gap-3 rounded-lg border px-4 py-3 text-base font-black transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[color:var(--crm-ui-accent-border)] ${
                  active
                    ? 'border-[color:var(--crm-ui-accent)] bg-[color:var(--crm-ui-accent)] text-[#062410] shadow-[0_16px_34px_rgba(132,204,147,0.22)]'
                    : 'border-[color:var(--crm-ui-border-strong)] bg-[color:var(--crm-ui-surface-strong)] text-[color:var(--crm-ui-text)] hover:border-[color:var(--crm-ui-accent-border)]'
                }`}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{family}</span>
              </button>
            )
          })}
        </div>
      </div>

      <CrmSearchBar
        value={vm.search}
        onChange={actions.setSearch}
        placeholder={`Search ${vm.activeFamily.toLowerCase()} products...`}
        actions={
          <>
            <select
              className="ace-crm-input min-w-[120px] text-sm"
              aria-label="Product status"
              value={vm.statusFilter}
              onChange={(event) => actions.setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
            <select
              className="ace-crm-input min-w-[130px] text-sm"
              aria-label="Product scope"
              value={vm.scopeFilter}
              onChange={(event) => actions.setScopeFilter(event.target.value)}
            >
              {vm.scopeFilters.map((scope) => (
                <option key={scope} value={scope}>
                  {scope === 'all' ? 'All scopes' : scope}
                </option>
              ))}
            </select>
          </>
        }
      />

      <CrmSectionCard
        title={`${vm.activeFamily} catalog`}
        description="Select a product row from the current family and scope to edit its defaults and pricing."
      >
        <div className="grid gap-3">
          <CrmButton type="button" tone="secondary" onClick={actions.startCreate}>
            New product
          </CrmButton>
          {vm.products.length === 0 ? (
            <CrmEmptyState
              title="No products found"
              description="Try a different search, family, scope, or status filter."
            />
          ) : (
            vm.products.map((product) => (
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
