'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type {
  QuoteProductsActions,
  QuoteProductsEditorVm,
} from '@/app/crm/quotes/_hooks/useQuoteProductsPage'
import {
  QUOTE_PRODUCT_FAMILIES,
  QUOTE_PRODUCT_SCOPE_OPTIONS,
  QUOTE_PRODUCT_SHEEN_OPTIONS,
  QUOTE_PRODUCT_STATUSES,
} from '@/lib/quotes/productsForm'

type Props = {
  vm: QuoteProductsEditorVm
  actions: Pick<
    QuoteProductsActions,
    'updateDraftField' | 'save' | 'cancelEdit' | 'requestDelete'
  >
}

export function QuoteProductEditorSection({ vm, actions }: Props) {
  function setDraftField<K extends keyof typeof vm.draft>(field: K, value: (typeof vm.draft)[K]) {
    actions.updateDraftField(field, value)
  }

  const fieldErrors = vm.validation.fields

  return (
    <CrmSectionCard
      title={vm.isCreating ? 'New product' : vm.selected ? vm.selected.name : 'Product editor'}
      description={
        vm.isCreating
          ? 'Create a new quote product row with explicit family, status, and estimator defaults.'
          : 'Dense admin editor for catalog defaults, pricing, and lifecycle status.'
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <CrmButton
            type="button"
            tone="primary"
            disabled={!vm.canSave}
            onClick={() => void actions.save()}
          >
            {vm.saving ? (vm.isCreating ? 'Creating...' : 'Saving...') : vm.isCreating ? 'Create product' : 'Save changes'}
          </CrmButton>
          <CrmButton type="button" onClick={actions.cancelEdit}>
            {vm.isCreating ? 'Cancel create' : 'Reset'}
          </CrmButton>
          <CrmButton
            type="button"
            tone="danger"
            disabled={!vm.canDelete}
            onClick={() => void actions.requestDelete()}
          >
            Archive
          </CrmButton>
        </div>
      }
    >
      {!vm.selected && !vm.isCreating ? (
        <CrmEmptyState
          title="Select a product"
          description="Choose a product row from the list to edit it."
        />
      ) : (
        <div className="grid gap-4">
          {vm.inlineValidation ? (
            <CrmNotice tone="info" compact>
              {vm.inlineValidation}
            </CrmNotice>
          ) : null}

          {vm.selectionNotice ? (
            <CrmNotice tone="info" compact>
              {vm.selectionNotice}
            </CrmNotice>
          ) : null}

          <CrmField label="Product name" error={fieldErrors.name}>
            <input
              aria-label="Product name"
              className="ace-crm-input text-sm"
              value={vm.draft.name}
              onChange={(event) => setDraftField('name', event.target.value)}
            />
          </CrmField>

          <div className="grid gap-4 md:grid-cols-3">
            <CrmField label="Family" error={fieldErrors.family}>
              <select
                aria-label="Family"
                className="ace-crm-input text-sm"
                value={vm.draft.family}
                onChange={(event) => setDraftField('family', event.target.value)}
              >
                {QUOTE_PRODUCT_FAMILIES.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
            </CrmField>
            <CrmField label="Base" error={fieldErrors.base}>
              <input
                aria-label="Base"
                className="ace-crm-input text-sm"
                value={vm.draft.base}
                onChange={(event) => setDraftField('base', event.target.value)}
              />
            </CrmField>
            <CrmField label="Status" error={fieldErrors.status}>
              <select
                aria-label="Status"
                className="ace-crm-input text-sm"
                value={vm.draft.status}
                onChange={(event) => setDraftField('status', event.target.value)}
              >
                {QUOTE_PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </CrmField>
          </div>

          <CrmField label="Subtype" error={fieldErrors.subtype}>
            <input
              aria-label="Subtype"
              className="ace-crm-input text-sm"
              value={vm.draft.subtype}
              onChange={(event) => setDraftField('subtype', event.target.value)}
            />
          </CrmField>

          <div className="grid gap-4 md:grid-cols-3">
            <CrmField label="Cost / unit" error={fieldErrors.cost_per_unit}>
              <input
                aria-label="Cost / unit"
                className="ace-crm-input text-sm"
                type="number"
                step="0.01"
                value={vm.draft.cost_per_unit}
                onChange={(event) => setDraftField('cost_per_unit', event.target.value)}
              />
            </CrmField>
            <CrmField label="Coverage (sqft)" error={fieldErrors.coverage_sqft_per_gal_per_coat}>
              <input
                aria-label="Coverage (sqft)"
                className="ace-crm-input text-sm"
                type="number"
                step="0.01"
                value={vm.draft.coverage_sqft_per_gal_per_coat}
                onChange={(event) =>
                  setDraftField('coverage_sqft_per_gal_per_coat', event.target.value)
                }
              />
            </CrmField>
            <CrmField label="Efficiency (%)" error={fieldErrors.efficiency_pct}>
              <input
                aria-label="Efficiency (%)"
                className="ace-crm-input text-sm"
                type="number"
                step="0.01"
                value={vm.draft.efficiency_pct}
                onChange={(event) => setDraftField('efficiency_pct', event.target.value)}
              />
            </CrmField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CrmField label="Default coats" error={fieldErrors.default_coats}>
              <input
                aria-label="Default coats"
                className="ace-crm-input text-sm"
                type="number"
                step="1"
                value={vm.draft.default_coats}
                onChange={(event) => setDraftField('default_coats', event.target.value)}
              />
            </CrmField>
            <CrmField label="Default sheen" error={fieldErrors.default_sheen}>
              <select
                aria-label="Default sheen"
                className="ace-crm-input text-sm"
                value={vm.draft.default_sheen}
                onChange={(event) => setDraftField('default_sheen', event.target.value)}
              >
                {QUOTE_PRODUCT_SHEEN_OPTIONS.map((sheen) => (
                  <option key={sheen} value={sheen}>
                    {sheen}
                  </option>
                ))}
              </select>
            </CrmField>
          </div>

          <CrmField label="Applies to" error={fieldErrors.default_scopes}>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUOTE_PRODUCT_SCOPE_OPTIONS.map((scope) => {
                const currentScopes = vm.draft.default_scopes
                const checked = currentScopes.includes(scope)
                return (
                  <label
                    key={scope}
                    className="flex items-center gap-2 rounded-xl border border-[color:var(--crm-ui-border)] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setDraftField(
                          'default_scopes',
                          event.target.checked
                            ? [...currentScopes, scope]
                            : currentScopes.filter((value) => value !== scope)
                        )
                      }
                    />
                    <span>{scope}</span>
                  </label>
                )
              })}
            </div>
          </CrmField>

          <CrmField label="Notes" error={fieldErrors.notes}>
            <textarea
              aria-label="Notes"
              className="ace-crm-input min-h-[120px] resize-y text-sm"
              value={vm.draft.notes}
              onChange={(event) => setDraftField('notes', event.target.value)}
            />
          </CrmField>
        </div>
      )}
    </CrmSectionCard>
  )
}
