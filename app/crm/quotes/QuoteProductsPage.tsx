'use client'

import { Boxes } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDetailLayout } from '@/app/crm/_components/CrmDetailLayout'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useQuoteProductsPage } from '@/app/crm/quotes/_hooks/useQuoteProductsPage'
import type { ProductFamily } from '@/lib/quotes/productsForm'

const SCOPE_OPTIONS = ['Walls', 'Ceilings', 'Trim', 'Doors', 'Cabinetry', 'Other']

export default function QuoteProductsPage() {
  const controller = useQuoteProductsPage()

  function setFormField<K extends keyof typeof controller.formState>(
    field: K,
    value: (typeof controller.formState)[K]
  ) {
    controller.setFormState((current) => ({ ...current, [field]: value }))
  }

  return (
    <CrmPageShell className="max-w-6xl">
      <CrmPageHeader
        eyebrow="Quotes"
        emoji="📦"
        title="Quote Products"
        description="Dense admin editor for quote paint and primer catalog rows."
        backHref="/crm/quotes"
        backLabel="Back to quotes"
        meta={<Boxes size={16} aria-hidden="true" />}
      />

      <CrmSearchBar
        value={controller.search}
        onChange={controller.setSearch}
        placeholder={`Search ${controller.activeFamily.toLowerCase()} products...`}
        actions={
          <>
            {controller.families.map((family) => (
              <CrmButton
                key={family}
                type="button"
                tone={family === controller.activeFamily ? 'primary' : 'secondary'}
                onClick={() => controller.setActiveFamily(family as ProductFamily)}
              >
                {family}
              </CrmButton>
            ))}
          </>
        }
      />

      <CrmResourceState
        loading={controller.resource.loading}
        error={controller.resource.error}
        hasData={
          controller.resource.data.length > 0 ||
          (!controller.resource.loading && !controller.resource.error)
        }
        loadingTitle="Loading quote products"
        loadingDescription="Loading quote products..."
        errorTitle="Quote products unavailable"
        onRetry={() => void controller.resource.refresh()}
      >
        {controller.notice ? <CrmNotice tone="success">{controller.notice}</CrmNotice> : null}
        {controller.error ? <CrmNotice tone="error">{controller.error}</CrmNotice> : null}

        <CrmDetailLayout
          main={
            <CrmSectionCard
              title={`${controller.activeFamily} catalog`}
              description="Select a product row from the current family to edit its defaults and pricing."
            >
              <div className="grid gap-3">
                {controller.filtered.length === 0 ? (
                  <CrmEmptyState
                    title="No products found"
                    description="Try a different search or family filter."
                  />
                ) : (
                  controller.filtered.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => controller.setSelectedId(product.id)}
                      className={`rounded-2xl border px-4 py-3 text-left ${
                        controller.selected?.id === product.id
                          ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)]'
                          : 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)]'
                      }`}
                    >
                      <div className="font-black text-[color:var(--crm-ui-text)]">{product.name}</div>
                      <div className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">
                        {product.base ?? 'N/A'} / {product.subtype ?? 'N/A'}
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--crm-ui-muted)]">
                        Cost: ${Number(product.cost_per_unit ?? 0).toFixed(2)} | Coverage:{' '}
                        {product.coverage_sqft_per_gal_per_coat ?? 'N/A'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CrmSectionCard>
          }
          side={
            <CrmSectionCard
              title={controller.selected ? controller.selected.name : 'Product editor'}
              description="This remains a dense admin editor, but it now uses the shared CRM shell and resource states."
              actions={
                <div className="flex flex-wrap gap-2">
                  <CrmButton
                    type="button"
                    tone="primary"
                    disabled={!controller.selected || controller.saving || Boolean(controller.validationError)}
                    onClick={() => void controller.save()}
                  >
                    {controller.saving ? 'Saving...' : 'Save changes'}
                  </CrmButton>
                  <CrmButton
                    type="button"
                    tone="danger"
                    disabled={!controller.selected || controller.saving}
                    onClick={() => void controller.remove()}
                  >
                    Delete
                  </CrmButton>
                </div>
              }
            >
              {!controller.selected ? (
                <CrmEmptyState
                  title="Select a product"
                  description="Choose a product row from the list to edit it."
                />
              ) : (
                <div className="grid gap-4">
                  {controller.validationError ? (
                    <CrmNotice tone="info" compact>
                      {controller.validationError}
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
                      {SCOPE_OPTIONS.map((scope) => {
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
          }
        />
      </CrmResourceState>
    </CrmPageShell>
  )
}
