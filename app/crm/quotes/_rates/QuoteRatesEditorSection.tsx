'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { QuoteRatesActions, QuoteRatesEditorVm } from '@/app/crm/quotes/_hooks/useQuoteRatesPage'

type Props = {
  vm: QuoteRatesEditorVm
  templateVersion: number | null
  actions: Pick<
    QuoteRatesActions,
    | 'cancelEdit'
    | 'setDraftActive'
    | 'updateDraftValue'
    | 'formatDraftValue'
  >
}

export function QuoteRatesEditorSection({ vm, templateVersion, actions }: Props) {
  function renderFieldControl(field: NonNullable<QuoteRatesEditorVm['activeCategory']>['fields'][number]) {
    if (field.type === 'checkbox_group') {
      const selected = new Set(
        actions
          .formatDraftValue(field.key)
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
      return (
        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
          {(field.options ?? []).map((option) => {
            const checked = selected.has(option)
            return (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                  disabled={field.readOnly || vm.busy}
                  checked={checked}
                  onChange={(event) => {
                    const next = new Set(selected)
                    if (event.target.checked) next.add(option)
                    else next.delete(option)
                    actions.updateDraftValue(field.key, (field.options ?? []).filter((entry) => next.has(entry)).join(','))
                  }}
                />
                <span>{option}</span>
              </label>
            )
          })}
        </div>
      )
    }

    if (field.type === 'select') {
      return (
        <select
          className="ace-crm-input text-sm"
          disabled={field.readOnly || vm.busy}
          value={actions.formatDraftValue(field.key)}
          onChange={(event) => actions.updateDraftValue(field.key, event.target.value)}
        >
          {(field.options ?? ['']).map((option) => (
            <option key={option || 'blank'} value={option}>
              {option || '--'}
            </option>
          ))}
        </select>
      )
    }

    return (
      <input
        className="ace-crm-input text-sm"
        type={field.type === 'number' ? 'number' : 'text'}
        readOnly={field.readOnly || vm.busy}
        value={actions.formatDraftValue(field.key)}
        onChange={(event) => actions.updateDraftValue(field.key, event.target.value)}
      />
    )
  }

  return (
    <CrmSectionCard
      title={vm.isCreating ? 'New row' : vm.selectedRow ? vm.selectedRow.display_name || vm.selectedRow.id : 'No selection'}
      description={
        vm.activeCategory
          ? `${vm.activeCategory.label} | active v${vm.activeSettingSet?.version_number ?? templateVersion ?? 'n/a'}`
          : 'No active category.'
      }
      actions={
        vm.showLegacyCategoryNotice ? null : (
          <div className="flex flex-wrap gap-2">
            <CrmButton type="button" onClick={actions.cancelEdit} disabled={vm.busy}>
              Cancel
            </CrmButton>
          </div>
        )
      }
    >
      {!vm.activeCategory ? (
        <CrmEmptyState title="No active category" description="Select a tab and category." />
      ) : vm.showLegacyCategoryNotice ? (
        <CrmNotice tone="info">
          This category is a legacy data type and cannot be edited here.
        </CrmNotice>
      ) : (
        <div className="grid gap-4">
          <CrmNotice tone="info" compact>
            Unsaved global changes apply to draft quotes after saving. Sent and accepted quotes keep their saved pricing.
          </CrmNotice>
          {vm.inlineValidation ? (
            <CrmNotice tone="info" compact>
              {vm.inlineValidation}
            </CrmNotice>
          ) : null}
          <CrmField label="Status">
            <select
              className="ace-crm-input text-sm"
              disabled={vm.busy}
              value={vm.draftActive ? 'Y' : 'N'}
              onChange={(event) => actions.setDraftActive(event.target.value === 'Y')}
            >
              <option value="Y">Active</option>
              <option value="N">Archived</option>
            </select>
          </CrmField>
          {vm.activeCategory.fields.map((field) => (
            <CrmField
              key={field.key}
              label={`${field.label}${field.required ? ' *' : ''}`}
              help={field.helperText}
            >
              {renderFieldControl(field)}
            </CrmField>
          ))}
        </div>
      )}
    </CrmSectionCard>
  )
}
