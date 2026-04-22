'use client'

import { CrmEntityFormPage } from '@/app/crm/_components/CrmEntityFormPage'
import { CrmField } from '@/app/crm/_components/CrmField'
import { crmButtonClassName, crmInputClassName } from '@/app/crm/_components/crmStyles'
import type {
  EmailTemplateStage,
} from './useEmailTemplatesController'

const inputClassName = crmInputClassName('min-h-[3rem] text-sm')

const availableVars = [
  '{{customerName}}',
  '{{customerEmail}}',
  '{{customerPhone}}',
  '{{customerAddress}}',
  '{{jobTitle}}',
  '{{estimateDate}}',
  '{{scheduledDate}}',
  '{{scheduledBlocks}}',
  '{{estimateFileName}}',
  '{{estimateFileLink}}',
  '{{estimateFileNames}}',
  '{{estimateFileLinks}}',
  '{{estimate_file_name}}',
  '{{estimate_file_link}}',
  '{{estimate_file_names}}',
  '{{estimate_file_links}}',
  '{{scheduled_blocks}}',
  '{{reviewLink}}',
]

type EmailTemplateEditorProps = {
  active: EmailTemplateStage
  activeLabel: string
  subject: string
  body: string
  setActive: (stage: EmailTemplateStage) => void
  setSubject: (value: string) => void
  setBody: (value: string) => void
  insertVariable: (value: string) => void
  stages: Array<{ key: EmailTemplateStage; label: string }>
  saving: boolean
  canSave: boolean
  error: string | null
  notice: string | null
  onSave: () => void
}

export function EmailTemplateEditor({
  active,
  activeLabel,
  subject,
  body,
  setActive,
  setSubject,
  setBody,
  insertVariable,
  stages,
  saving,
  canSave,
  error,
  notice,
  onSave,
}: EmailTemplateEditorProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="ace-crm-surface px-5 py-5">
        <div className="mb-4">
          <h2 className="text-lg font-black tracking-[-0.02em] text-[color:var(--crm-ui-text)]">
            Stages
          </h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--crm-ui-muted)]">
            Switch between the reusable templates for each workflow stage.
          </p>
        </div>
        <div className="grid gap-2">
          {stages.map((stage) => (
            <button
              key={stage.key}
              type="button"
              onClick={() => setActive(stage.key)}
              className={`rounded-2xl border px-3 py-2.5 text-left text-sm font-bold transition ${
                active === stage.key
                  ? 'border-[color:var(--crm-ui-accent)] bg-[color:var(--crm-ui-accent)] text-[#f6f4ef]'
                  : 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-strong)] text-[color:var(--crm-ui-text)] hover:bg-[color:var(--crm-ui-surface-muted)]'
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      <CrmEntityFormPage
        title={activeLabel}
        description="Write the subject and body once, then reuse it anywhere that stage appears."
        error={error}
        notice={notice}
        saveLabel="Save changes"
        savingLabel="Saving..."
        saving={saving}
        canSave={canSave}
        onSave={onSave}
      >
        <div className="grid gap-4">
          <CrmField label="Subject">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="ex: Your estimate is scheduled"
              className={inputClassName}
            />
          </CrmField>

          <CrmField label="Body">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write the email template here..."
              className={`${inputClassName} min-h-[220px] resize-y`}
            />
          </CrmField>

          <div className="text-xs text-[color:var(--crm-ui-muted)]">
            For Quote sent/follow up, one or more quote PDFs can be attached. Use{' '}
            {'{{estimateFileName}}'} / {'{{estimateFileLink}}'} for the primary file, or{' '}
            {'{{estimateFileNames}}'} / {'{{estimateFileLinks}}'} for all selected files.
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-[color:var(--crm-ui-text)]">
              <span aria-hidden="true">ðŸ§©</span>
              <span>Variables</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableVars.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => insertVariable(value)}
                  className={crmButtonClassName(
                    'secondary',
                    'min-h-0 rounded-full px-2.5 py-1 text-xs font-extrabold text-[color:var(--crm-ui-muted)]'
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CrmEntityFormPage>
    </div>
  )
}
