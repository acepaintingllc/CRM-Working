'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmButtonClassName, crmInputClassName } from '@/app/crm/_components/crmStyles'
import {
  useEmailTemplatesController,
  emailTemplateStages,
  type EmailTemplateStage,
} from './useEmailTemplatesController'

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

export default function EmailTemplatesPage() {
  const controller = useEmailTemplatesController()

  return (
    <CrmPageShell className="max-w-[900px]">
      <CrmPageHeader
        eyebrow="Message system"
        emoji="📬"
        title="Email templates"
        description="Draft templates per job stage. Variables will be filled later from the customer and job."
        badge={<CrmChip tone="accent">Quote-family CRM UI</CrmChip>}
        actions={
          <CrmButton
            onClick={() => void controller.saveChanges()}
            disabled={!controller.dirty || controller.saving}
            tone="primary"
          >
            {controller.saving ? 'Saving...' : 'Save changes'}
          </CrmButton>
        }
      />

      {controller.error ? <CrmNotice tone="error" emoji="⚠️">{controller.error}</CrmNotice> : null}
      {controller.notice ? <CrmNotice tone="success" emoji="✨">{controller.notice}</CrmNotice> : null}

      <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
        <CrmSectionCard
          title="Stages"
          emoji="🗂️"
          description="Switch between the reusable templates for each workflow stage."
        >
          <div className="mt-3 grid gap-2">
            {emailTemplateStages.map((stage) => (
              <button
                key={stage.key}
                type="button"
                onClick={() => controller.setActive(stage.key as EmailTemplateStage)}
                className={`rounded-2xl border px-3 py-2.5 text-left text-sm font-bold transition ${
                  controller.active === stage.key
                    ? 'border-[color:var(--crm-ui-accent)] bg-[color:var(--crm-ui-accent)] text-[#f6f4ef]'
                    : 'border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface-strong)] text-[color:var(--crm-ui-text)] hover:bg-[color:var(--crm-ui-surface-muted)]'
                }`}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </CrmSectionCard>

        <CrmSectionCard
          title={controller.activeLabel}
          emoji="✍️"
          description="Write the subject and body once, then reuse it anywhere that stage appears."
        >
          <div className="mt-4">
            <div className={labelClassName}>Subject</div>
            <input
              value={controller.subject}
              onChange={(event) => controller.setSubject(event.target.value)}
              placeholder="ex: Your estimate is scheduled"
              className={inputClassName}
            />
          </div>

          <div className="mt-4">
            <div className={labelClassName}>Body</div>
            <textarea
              value={controller.body}
              onChange={(event) => controller.setBody(event.target.value)}
              placeholder="Write the email template here..."
              className={`${inputClassName} min-h-[220px] resize-y`}
            />
          </div>

          <div className="mt-2 text-xs text-[color:var(--crm-ui-muted)]">
            For Quote sent/follow up, one or more quote PDFs can be attached. Use{' '}
            {'{{estimateFileName}}'} / {'{{estimateFileLink}}'} for the primary file, or{' '}
            {'{{estimateFileNames}}'} / {'{{estimateFileLinks}}'} for all selected files.
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-[color:var(--crm-ui-text)]">
              <span aria-hidden="true">🧩</span>
              <span>Variables</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableVars.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => controller.insertVariable(value)}
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
        </CrmSectionCard>
      </div>
    </CrmPageShell>
  )
}

const inputClassName = crmInputClassName('min-h-[3rem] text-sm')

const labelClassName = 'ace-crm-mono mb-1.5 text-[11px] font-bold text-[color:var(--crm-ui-muted)]'
