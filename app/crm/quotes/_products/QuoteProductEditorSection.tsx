'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useQuoteProductsPage } from '@/app/crm/quotes/_hooks/useQuoteProductsPage'
import {
  QUOTE_PRODUCT_FAMILIES,
  QUOTE_PRODUCT_SCOPE_OPTIONS,
  QUOTE_PRODUCT_SHEEN_OPTIONS,
  QUOTE_PRODUCT_STATUSES,
} from '@/lib/quotes/productsForm'

type QuoteProductsController = ReturnType<typeof useQuoteProductsPage>

export function QuoteProductEditorSection({
  controller,
}: {
  controller: QuoteProductsController
}) {
  function setDraftField<K extends keyof typeof controller.draft>(
    field: K,
    value: (typeof controller.draft)[K]
  ) {
    controller.actions.updateDraftField(field, value)
  }

  const fieldErrors = controller.editorVm.validation.fields

  return (
    <CrmSectionCard
      title={
        controller.editorVm.isCreating
          ? 'New product'
          : controller.selected
            ? controller.selected.name
            : 'Product editor'
      }
      description={
        controller.editorVm.isCreating
          ? 'Create a new quote product row with explicit family, status, and estimator defaults.'
          : 'Dense admin editor for catalog defaults, pricing, and lifecycle status.'
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <CrmButton
            type="button"
            tone="primary"
            disabled={!controller.editorVm.canSave}
            onClick={() => void controller.actions.save()}
          >
            {controller.editorVm.saving
              ? controller.editorVm.isCreating
                ? 'Creating...'
                : 'Saving...'
              : controller.editorVm.isCreating
                ? 'Create product'
                : 'Save changes'}
          </CrmButton>
          <CrmButton type="button" onClick={controller.actions.cancelEdit}>
            {controller.editorVm.isCreating ? 'Cancel create' : 'Reset'}
          </CrmButton>
          <CrmButton
            type="button"
            tone="danger"
            disabled={!controller.editorVm.canDelete}
            onClick={() => void controller.actions.remove()}
          >
            Delete
          </CrmButton>
        </div>
      }
    >
      {!controller.editorVm.selected && !controller.editorVm.isCreating ? (
        <CrmEmptyState
          title="Select a product"
          description="Choose a product row from the list to edit it."
        />
      ) : (
        <div className="grid gap-4">
          {controller.editorVm.inlineValidation ? (
            <CrmNotice tone="info" compact>
              {controller.editorVm.inlineValidation}
            </CrmNotice>
          ) : null}

          <CrmField label="Product name" error={fieldErrors.name}>
            <input
              aria-label="Product name"
              className="ace-crm-input text-sm"
              value={controller.draft.name}
              onChange={(event) => setDraftField('name', event.target.value)}
            />
          </CrmField>

          <div className="grid gap-4 md:grid-cols-3">
            <CrmField label="Family" error={fieldErrors.family}>
              <select
                aria-label="Family"
                className="ace-crm-input text-sm"
                value={controller.draft.family}
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
                value={controller.draft.base}
                onChange={(event) => setDraftField('base', event.target.value)}
              />
            </CrmField>
            <CrmField label="Status" error={fieldErrors.status}>
              <select
                aria-label="Status"
                className="ace-crm-input text-sm"
                value={controller.draft.status}
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
              value={controller.draft.subtype}
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
                value={controller.draft.cost_per_unit}
                onChange={(event) => setDraftField('cost_per_unit', event.target.value)}
              />
            </CrmField>
            <CrmField
              label="Coverage (sqft)"
              error={fieldErrors.coverage_sqft_per_gal_per_coat}
            >
              <input
                aria-label="Coverage (sqft)"
                className="ace-crm-input text-sm"
                type="number"
                step="0.01"
                value={controller.draft.coverage_sqft_per_gal_per_coat}
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
                value={controller.draft.efficiency_pct}
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
                value={controller.draft.default_coats}
                onChange={(event) => setDraftField('default_coats', event.target.value)}
              />
            </CrmField>
            <CrmField label="Default sheen" error={fieldErrors.default_sheen}>
              <select
                aria-label="Default sheen"
                className="ace-crm-input text-sm"
                value={controller.draft.default_sheen}
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
                const currentScopes = controller.draft.default_scopes
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
              value={controller.draft.notes}
              onChange={(event) => setDraftField('notes', event.target.value)}
            />
          </CrmField>
        </div>
      )}
    </CrmSectionCard>
  )
}
