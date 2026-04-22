'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useQuoteProductsPage } from '@/app/crm/quotes/_hooks/useQuoteProductsPage'
import type { ProductFamily } from '@/lib/quotes/productsForm'
import { QUOTE_PRODUCT_SCOPE_OPTIONS } from './quoteProductPresentation'

type QuoteProductsController = ReturnType<typeof useQuoteProductsPage>

export function QuoteProductEditorSection({
  controller,
}: {
  controller: QuoteProductsController
}) {
  function setFormField<K extends keyof typeof controller.formState>(
    field: K,
    value: (typeof controller.formState)[K]
  ) {
    controller.actions.setFormState((current) => ({ ...current, [field]: value }))
  }

  return (
    <CrmSectionCard
      title={controller.selected ? controller.selected.name : 'Product editor'}
      
      description="This remains a dense admin editor, but it now uses the shared CRM shell and resource states."
      actions={
        <div className="flex flex-wrap gap-2">
          <CrmButton
            type="button"
            tone="primary"
            disabled={!controller.editorVm.selected || controller.editorVm.saving || Boolean(controller.editorVm.validationError)}
            onClick={() => void controller.actions.save()}
          >
            {controller.editorVm.saving ? 'Saving...' : 'Save changes'}
          </CrmButton>
          <CrmButton
            type="button"
            tone="danger"
            disabled={!controller.editorVm.selected || controller.editorVm.saving}
            onClick={() => void controller.actions.remove()}
          >
            Delete
          </CrmButton>
        </div>
      }
    >
      {!controller.editorVm.selected ? (
        <CrmEmptyState
          title="Select a product"
          description="Choose a product row from the list to edit it."
        />
      ) : (
        <div className="grid gap-4">
          {controller.editorVm.validationError ? (
            <CrmNotice tone="info" compact>
              {controller.editorVm.validationError}
            </CrmNotice>
          ) : null}

          <CrmField label="Product name">
            <input
              className="ace-crm-input text-sm"
              value={controller.formState.name ?? ''}
              onChange={(event) => setFormField('name', event.target.value)}
            />
          </CrmField>

          <div className="grid gap-4 md:grid-cols-2">
            <CrmField label="Family">
              <select
                className="ace-crm-input text-sm"
                value={controller.formState.family ?? 'Paint'}
                onChange={(event) =>
                  setFormField('family', event.target.value as ProductFamily)
                }
              >
                <option value="Paint">Paint</option>
                <option value="Primer">Primer</option>
              </select>
            </CrmField>
            <CrmField label="Base">
              <input
                className="ace-crm-input text-sm"
                value={controller.formState.base ?? ''}
                onChange={(event) => setFormField('base', event.target.value)}
              />
            </CrmField>
          </div>

          <CrmField label="Subtype">
            <input
              className="ace-crm-input text-sm"
              value={controller.formState.subtype ?? ''}
              onChange={(event) => setFormField('subtype', event.target.value)}
            />
          </CrmField>

          <div className="grid gap-4 md:grid-cols-3">
            <CrmField label="Cost / unit">
              <input
                className="ace-crm-input text-sm"
                type="number"
                step="0.01"
                value={controller.formState.cost_per_unit ?? ''}
                onChange={(event) =>
                  setFormField(
                    'cost_per_unit',
                    event.target.value ? Number(event.target.value) : null
                  )
                }
              />
            </CrmField>
            <CrmField label="Coverage (sqft)">
              <input
                className="ace-crm-input text-sm"
                type="number"
                step="0.01"
                value={controller.formState.coverage_sqft_per_gal_per_coat ?? ''}
                onChange={(event) =>
                  setFormField(
                    'coverage_sqft_per_gal_per_coat',
                    event.target.value ? Number(event.target.value) : null
                  )
                }
              />
            </CrmField>
            <CrmField label="Efficiency (%)">
              <input
                className="ace-crm-input text-sm"
                type="number"
                step="0.01"
                value={controller.formState.efficiency_pct ?? ''}
                onChange={(event) =>
                  setFormField(
                    'efficiency_pct',
                    event.target.value ? Number(event.target.value) : null
                  )
                }
              />
            </CrmField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CrmField label="Default coats">
              <input
                className="ace-crm-input text-sm"
                type="number"
                value={controller.formState.default_coats ?? ''}
                onChange={(event) =>
                  setFormField(
                    'default_coats',
                    event.target.value ? Number(event.target.value) : null
                  )
                }
              />
            </CrmField>
            <CrmField label="Default sheen">
              <select
                className="ace-crm-input text-sm"
                value={controller.formState.default_sheen ?? 'N/A'}
                onChange={(event) => setFormField('default_sheen', event.target.value)}
              >
                <option value="Eggshell">Eggshell</option>
                <option value="Satin">Satin</option>
                <option value="Flat">Flat</option>
                <option value="Semi-Gloss">Semi-Gloss</option>
                <option value="N/A">N/A</option>
              </select>
            </CrmField>
          </div>

          <CrmField label="Applies to">
            <div className="grid gap-2 sm:grid-cols-2">
              {QUOTE_PRODUCT_SCOPE_OPTIONS.map((scope) => {
                const currentScopes = controller.formState.default_scopes ?? []
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
                        setFormField(
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

          <CrmField label="Notes">
            <textarea
              className="ace-crm-input min-h-[120px] resize-y text-sm"
              value={controller.formState.notes ?? ''}
              onChange={(event) => setFormField('notes', event.target.value)}
            />
          </CrmField>
        </div>
      )}
    </CrmSectionCard>
  )
}
