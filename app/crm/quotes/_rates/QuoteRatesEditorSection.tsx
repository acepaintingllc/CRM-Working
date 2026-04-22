'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useQuoteRatesPage } from '@/app/crm/quotes/_hooks/useQuoteRatesPage'

type QuoteRatesController = ReturnType<typeof useQuoteRatesPage>

export function QuoteRatesEditorSection({
  controller,
}: {
  controller: QuoteRatesController
}) {
  return (
    <CrmSectionCard
      title={
        controller.isCreating
        
          ? 'New row'
          : controller.tableVm.selectedRow
            ? controller.tableVm.selectedRow.display_name || controller.tableVm.selectedRow.id
            : 'No selection'
      }
      description={
        controller.editorVm.activeCategory
          ? `${controller.editorVm.activeCategory.label} | template v${
              controller.resource.data.template_version ?? 'n/a'
            }`
          : 'No active category.'
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <CrmButton
            type="button"
            tone="primary"
            onClick={() => void controller.actions.saveCurrent()}
            disabled={!controller.editorVm.canSave}
          >
            {controller.editorVm.saving
              ? 'Saving...'
              : controller.editorVm.isCreating
                ? 'Create row'
                : 'Save changes'}
          </CrmButton>
          <CrmButton type="button" onClick={controller.actions.cancelEdit}>
            Cancel
          </CrmButton>
        </div>
      }
    >
      {!controller.editorVm.activeCategory ? (
        <CrmEmptyState title="No active category" description="Select a tab and category." />
      ) : (
        <div className="grid gap-4">
          {controller.editorVm.inlineValidation ? (
            <CrmNotice tone="info" compact>
              {controller.editorVm.inlineValidation}
            </CrmNotice>
          ) : null}
          <CrmField label="Status">
            <select
              className="ace-crm-input text-sm"
              value={controller.editorVm.draftActive ? 'Y' : 'N'}
              onChange={(event) => controller.actions.setDraftActive(event.target.value === 'Y')}
            >
              <option value="Y">Active</option>
              <option value="N">Archived</option>
            </select>
          </CrmField>
          {controller.editorVm.activeCategory.fields.map((field) => (
            <CrmField
              key={field.key}
              label={`${field.label}${field.required ? ' *' : ''}`}
              help={field.helperText}
            >
              {field.type === 'select' ? (
                <select
                  className="ace-crm-input text-sm"
                  disabled={field.readOnly}
                  value={controller.editorVm.formatDraftValue(field.key)}
                  onChange={(event) => controller.actions.updateDraftValue(field.key, event.target.value)}
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
                  value={controller.editorVm.formatDraftValue(field.key)}
                  onChange={(event) => controller.actions.updateDraftValue(field.key, event.target.value)}
                />
              )}
            </CrmField>
          ))}
        </div>
      )}
    </CrmSectionCard>
  )
}
