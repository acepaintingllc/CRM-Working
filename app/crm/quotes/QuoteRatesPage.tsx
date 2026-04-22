'use client'

import { Calculator } from 'lucide-react'
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
import {
  FLAGS_SECTIONS,
  RATE_SECTIONS,
  RATE_SUBGROUPS,
  ROOM_DEFAULTS_SECTIONS,
  useQuoteRatesPage,
} from '@/app/crm/quotes/_hooks/useQuoteRatesPage'
import type { RatesFlagsTab } from '@/types/estimator/ratesFlags'

export default function QuoteRatesPage() {
  const controller = useQuoteRatesPage()

  const sectionActions = (
    <>
      {(['rates', 'flags', 'room_defaults'] as RatesFlagsTab[]).map((tab) => (
        <CrmButton
          key={tab}
          type="button"
          tone={controller.activeTab === tab ? 'primary' : 'secondary'}
          onClick={() => controller.setActiveTab(tab)}
        >
          {tab === 'room_defaults' ? 'Room Defaults' : tab === 'flags' ? 'Flags' : 'Rates'}
        </CrmButton>
      ))}
    </>
  )

  return (
    <CrmPageShell className="max-w-7xl">
      <CrmPageHeader
        eyebrow="Quotes"
        emoji="📐"
        title="Rates, Flags, and Room Defaults"
        description="Dense admin editor for estimator configuration. This remains an intentional exception, but now uses standard CRM shells and resource states."
        backHref="/crm/quotes"
        backLabel="Back to quotes"
        meta={<Calculator size={16} aria-hidden="true" />}
      />

      <CrmSearchBar
        value={controller.search}
        onChange={controller.setSearch}
        placeholder="Search rows..."
        actions={
          <>
            <select
              className="ace-crm-input min-w-[120px] text-sm"
              value={controller.statusFilter}
              onChange={(event) =>
                controller.setStatusFilter(
                  event.target.value as 'active' | 'archived' | 'all'
                )
              }
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
            <CrmButton type="button" onClick={() => void controller.reload(controller.selectedId || undefined)}>
              Refresh
            </CrmButton>
          </>
        }
      />

      <CrmResourceState
        loading={controller.resource.loading}
        error={controller.resource.error}
        hasData={
          controller.resource.data.categories.length > 0 ||
          (!controller.resource.loading && !controller.resource.error)
        }
        loadingTitle="Loading rates and flags"
        loadingDescription="Loading rates and flags..."
        errorTitle="Rates and flags unavailable"
        onRetry={() => void controller.reload(controller.selectedId || undefined)}
      >
        {controller.notice ? <CrmNotice tone="success">{controller.notice}</CrmNotice> : null}
        {controller.error && !controller.resource.error ? (
          <CrmNotice tone="error">{controller.error}</CrmNotice>
        ) : null}

        <CrmDetailLayout
          main={
            <div className="grid gap-4">
              <CrmSectionCard
                title="Configuration sections"
                description={controller.activeCategory?.description ?? 'Select a category to edit rows.'}
                actions={sectionActions}
              >
                <div className="grid gap-3">
                  {controller.activeTab === 'rates' ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {RATE_SECTIONS.map((section) => (
                          <CrmButton
                            key={section.key}
                            type="button"
                            tone={controller.rateSection === section.key ? 'primary' : 'secondary'}
                            onClick={() => {
                              controller.setRateSection(section.key)
                              controller.setRateCategory(RATE_SUBGROUPS[section.key][0].key)
                            }}
                          >
                            {section.label}
                          </CrmButton>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {RATE_SUBGROUPS[controller.rateSection].map((subgroup) => (
                          <CrmButton
                            key={subgroup.key}
                            type="button"
                            tone={
                              controller.rateCategory === subgroup.key ? 'primary' : 'secondary'
                            }
                            onClick={() => controller.setRateCategory(subgroup.key)}
                          >
                            {subgroup.label}
                          </CrmButton>
                        ))}
                      </div>
                    </>
                  ) : controller.activeTab === 'flags' ? (
                    <div className="flex flex-wrap gap-2">
                      {FLAGS_SECTIONS.map((section) => (
                        <CrmButton
                          key={section.key}
                          type="button"
                          tone={
                            controller.flagsSection === section.key ? 'primary' : 'secondary'
                          }
                          onClick={() => controller.setFlagsSection(section.key)}
                        >
                          {section.label}
                        </CrmButton>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ROOM_DEFAULTS_SECTIONS.map((section) => (
                        <CrmButton
                          key={section.key}
                          type="button"
                          tone={
                            controller.roomDefaultsSection === section.key
                              ? 'primary'
                              : 'secondary'
                          }
                          onClick={() => controller.setRoomDefaultsSection(section.key)}
                        >
                          {section.label}
                        </CrmButton>
                      ))}
                    </div>
                  )}
                  <div className="text-sm text-[color:var(--crm-ui-muted)]">
                    {controller.activeCategory?.label ?? 'Loading category metadata...'}
                  </div>
                </div>
              </CrmSectionCard>

              <CrmSectionCard
                title={controller.activeCategory?.table_title ?? 'Rows'}
                description="Catalog rows in the active category."
                actions={
                  <div className="flex flex-wrap gap-2">
                    <CrmButton type="button" onClick={controller.startCreate}>
                      Add
                    </CrmButton>
                    <CrmButton
                      type="button"
                      onClick={controller.startDuplicate}
                      disabled={!controller.selectedRow || controller.saving}
                    >
                      Duplicate
                    </CrmButton>
                    <CrmButton
                      type="button"
                      tone={controller.selectedRow?.active ? 'danger' : 'secondary'}
                      onClick={() =>
                        void controller.archiveOrReactivate(!(controller.selectedRow?.active ?? false))
                      }
                      disabled={!controller.selectedRow || controller.isCreating || controller.saving}
                    >
                      {controller.selectedRow?.active ? 'Archive' : 'Reactivate'}
                    </CrmButton>
                  </div>
                }
              >
                {!controller.activeCategory ? (
                  <CrmEmptyState title="No category" description="Choose a category to view rows." />
                ) : controller.filteredRows.length === 0 ? (
                  <CrmEmptyState
                    title="No rows found"
                    description="Try a broader search or a different status filter."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[color:var(--crm-ui-border)]">
                          {controller.activeCategory.columns.map((column) => (
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
                        {controller.filteredRows.map((row) => (
                          <tr
                            key={row.id}
                            className={`cursor-pointer border-b border-[color:var(--crm-ui-border)] ${
                              !controller.isCreating && controller.selectedId === row.id
                                ? 'bg-[color:var(--crm-ui-accent-soft)]'
                                : ''
                            }`}
                            onClick={() => {
                              controller.setSelectedId(row.id)
                            }}
                          >
                            {controller.activeCategory?.columns.map((column) => (
                              <td key={`${row.id}-${column.key}`} className="px-3 py-2">
                                {column.key === 'active' ? (
                                  <span className="inline-flex rounded-full border border-[color:var(--crm-ui-accent-border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--crm-ui-accent)]">
                                    {row.active ? 'ACTIVE' : 'ARCHIVED'}
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
            </div>
          }
          side={
            <CrmSectionCard
              title={
                controller.isCreating
                  ? 'New row'
                  : controller.selectedRow
                    ? controller.selectedRow.display_name || controller.selectedRow.id
                    : 'No selection'
              }
              description={
                controller.activeCategory
                  ? `${controller.activeCategory.label} | template v${controller.resource.data.template_version ?? 'n/a'}`
                  : 'No active category.'
              }
              actions={
                <div className="flex flex-wrap gap-2">
                  <CrmButton
                    type="button"
                    tone="primary"
                    onClick={() => void controller.saveCurrent()}
                    disabled={!controller.activeCategory || controller.saving}
                  >
                    {controller.saving
                      ? 'Saving...'
                      : controller.isCreating
                        ? 'Create row'
                        : 'Save changes'}
                  </CrmButton>
                  <CrmButton type="button" onClick={controller.cancelEdit}>
                    Cancel
                  </CrmButton>
                </div>
              }
            >
              {!controller.activeCategory ? (
                <CrmEmptyState title="No active category" description="Select a tab and category." />
              ) : (
                <div className="grid gap-4">
                  <CrmField label="Status">
                    <select
                      className="ace-crm-input text-sm"
                      value={controller.draftActive ? 'Y' : 'N'}
                      onChange={(event) => controller.setDraftActive(event.target.value === 'Y')}
                    >
                      <option value="Y">Active</option>
                      <option value="N">Archived</option>
                    </select>
                  </CrmField>
                  {controller.activeCategory.fields.map((field) => (
                    <CrmField
                      key={field.key}
                      label={`${field.label}${field.required ? ' *' : ''}`}
                      help={field.helperText}
                    >
                      {field.type === 'select' ? (
                        <select
                          className="ace-crm-input text-sm"
                          disabled={field.readOnly}
                          value={controller.draft[field.key] ?? ''}
                          onChange={(event) =>
                            controller.setDraft((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                        >
                          {(field.options ?? ['']).map((option) => (
                            <option key={option || 'blank'} value={option}>
                              {option || '--'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="ace-crm-input text-sm"
                          type={field.type === 'number' ? 'number' : 'text'}
                          readOnly={field.readOnly}
                          value={controller.draft[field.key] ?? ''}
                          onChange={(event) =>
                            controller.setDraft((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                      )}
                    </CrmField>
                  ))}
                </div>
              )}
            </CrmSectionCard>
          }
        />
      </CrmResourceState>
    </CrmPageShell>
  )
}
