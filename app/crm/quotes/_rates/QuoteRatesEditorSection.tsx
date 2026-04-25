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
    'saveCurrent' | 'cancelEdit' | 'setDraftActive' | 'updateDraftValue' | 'formatDraftValue'
  >
}

export function QuoteRatesEditorSection({ vm, templateVersion, actions }: Props) {
  return (
    <CrmSectionCard
      title={vm.isCreating ? 'New row' : vm.selectedRow ? vm.selectedRow.display_name || vm.selectedRow.id : 'No selection'}
      description={
        vm.activeCategory ? `${vm.activeCategory.label} | template v${templateVersion ?? 'n/a'}` : 'No active category.'
      }
      actions={
        vm.showLegacyCategoryNotice ? null : (
          <div className="flex flex-wrap gap-2">
            <CrmButton
              type="button"
              tone="primary"
              onClick={() => void actions.saveCurrent()}
              disabled={!vm.canSave}
            >
              {vm.saving ? 'Saving...' : vm.isCreating ? 'Create row' : 'Save changes'}
            </CrmButton>
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
              {field.type === 'select' ? (
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
              ) : (
                <input
                  className="ace-crm-input text-sm"
                  type={field.type === 'number' ? 'number' : 'text'}
                  readOnly={field.readOnly || vm.busy}
                  value={actions.formatDraftValue(field.key)}
                  onChange={(event) => actions.updateDraftValue(field.key, event.target.value)}
                />
              )}
            </CrmField>
          ))}
        </div>
      )}
    </CrmSectionCard>
  )
}
