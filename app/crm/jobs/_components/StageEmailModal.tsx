'use client'

import type { EmailSendStatus } from '@/lib/email/types'
import type { JobDetail } from '@/types/jobs/api'
import { type StageEmailStage } from '@/lib/jobs/types'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalSection } from '@/app/crm/_components/CrmModalSection'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import {
  emailBodyTextareaClassName,
  emailBodyTextareaStyle,
} from '@/app/crm/_components/emailComposerStyles'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import { useEmailComposer } from '@/app/crm/jobs/_components/hooks/useEmailComposer'
import { Mail, Send } from 'lucide-react'

export type { StageEmailStage } from '@/lib/jobs/types'
export { stageEmailActionLabel } from '@/lib/jobs/types'

export type StageEmailSentResult = {
  job?: Partial<JobDetail> | null
  stage: StageEmailStage
  status: EmailSendStatus
  replayed: boolean
  warning?: string | null
}

type StageEmailModalProps = {
  jobId: string | null
  stage: StageEmailStage | null
  open: boolean
  onClose: () => void
  onSent?: (result: StageEmailSentResult) => void
}

export default function StageEmailModal({
  jobId,
  stage,
  open,
  onClose,
  onSent,
}: StageEmailModalProps) {
  const {
    job,
    subject,
    setSubject,
    body,
    setBody,
    loading,
    sending,
    error,
    blockingIssues,
    estimateFiles,
    selectedEstimateFiles,
    selectedEstimateFileIds,
    setSelectedEstimateFileIds,
    showEstimatePicker,
    setShowEstimatePicker,
    needsEstimateAttachment,
    missingEstimateSelection,
    canSend,
    closeLabel,
    actionLabel,
    alreadySent,
    send,
  } = useEmailComposer({
    jobId,
    stage,
    open,
  })

  if (!open || !jobId || !stage) return null

  const sendComposed = async () => {
    const result = await send()
    if (result) {
      onSent?.(result)
      onClose()
    }
  }

  return (
    <CrmModalShell labelledBy="stage-email-modal-title" onClose={onClose} widthClassName="max-w-3xl">
      <CrmModalHeader
        eyebrow="Stage email"
        title={actionLabel}
        description={job?.customer_email ? `To: ${job.customer_email}` : 'Customer email required'}
        labelledBy="stage-email-modal-title"
        onClose={onClose}
        closeLabel="Close email composer"
      />

      <div className="grid max-h-[72vh] gap-4 overflow-y-auto px-5 py-4">
        {error ? <CrmNotice tone="error" compact>{error}</CrmNotice> : null}
        {blockingIssues.length > 0 ? (
          <CrmNotice tone="warning" title="Blocking issues" compact>
            {blockingIssues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </CrmNotice>
        ) : null}
        {needsEstimateAttachment ? (
          <CrmNotice
            tone={selectedEstimateFiles.length > 0 ? 'success' : 'warning'}
            compact
          >
            {selectedEstimateFiles.length > 0
              ? `Estimate attachments ready: ${selectedEstimateFiles.length} selected`
              : 'Estimate attachment is required before this email can be sent.'}
          </CrmNotice>
        ) : null}
        {needsEstimateAttachment && missingEstimateSelection ? (
          <CrmNotice tone="warning" compact>
            Select at least one estimate PDF.
          </CrmNotice>
        ) : null}

        {needsEstimateAttachment && estimateFiles.length > 0 ? (
          <CrmModalSection
            title="Estimate attachments"
            description="Select which estimate PDFs go out with this stage email."
            tone="muted"
            actions={
              <CrmButton
                type="button"
                onClick={() => setShowEstimatePicker((prev) => !prev)}
                className="min-h-0 px-2.5 py-1.5 text-xs"
              >
                {showEstimatePicker ? 'Hide estimate picker' : 'Choose estimate PDFs'}
              </CrmButton>
            }
          >
            {showEstimatePicker ? (
              <div className="grid gap-2">
                {estimateFiles.map((file) => {
                  const checked = selectedEstimateFileIds.includes(file.id)
                  const versionLabel = typeof file.version === 'number' ? `v${file.version}` : null
                  const matchLabel =
                    typeof file.matchMode === 'string' && file.matchMode ? file.matchMode : null
                  const meta = [versionLabel, matchLabel].filter(Boolean).join(' | ')
                  return (
                    <label
                      key={file.id}
                      className="ace-crm-surface-muted flex cursor-pointer items-start gap-2 rounded-[14px] px-3 py-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const isChecked = event.target.checked
                          setSelectedEstimateFileIds((prev) => {
                            if (isChecked) {
                              return Array.from(new Set([...prev, file.id]))
                            }
                            return prev.filter((id) => id !== file.id)
                          })
                        }}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[color:var(--crm-ui-text)]">
                          {file.name}
                        </span>
                        {meta ? (
                          <span className="block text-[color:var(--crm-ui-muted)]">{meta}</span>
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : null}
          </CrmModalSection>
        ) : null}

        <CrmModalSection title="Message" description="Review the subject and body before sending.">
          {loading ? (
            <div className="text-sm text-[color:var(--crm-ui-muted)]">Loading email template...</div>
          ) : (
            <div className="grid gap-4">
              <CrmField label="Subject">
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className={crmInputClassName()}
                />
              </CrmField>
              <CrmField label="Body">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className={emailBodyTextareaClassName()}
                  style={emailBodyTextareaStyle}
                />
              </CrmField>
            </div>
          )}
        </CrmModalSection>
      </div>

      <div className="border-t border-[color:var(--crm-ui-border)] px-5 py-4">
        <CrmFormActions>
          <div className="inline-flex items-center gap-2 text-sm text-[color:var(--crm-ui-muted)]">
            <Mail size={16} />
            <span>{alreadySent ? 'This stage email has already been sent once.' : 'Ready to send.'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <CrmButton type="button" onClick={onClose}>
              {closeLabel}
            </CrmButton>
            <CrmButton type="button" onClick={() => void sendComposed()} disabled={!canSend} tone="primary">
              <Send size={16} />
              <span>{sending ? 'Sending...' : actionLabel}</span>
            </CrmButton>
          </div>
        </CrmFormActions>
      </div>
    </CrmModalShell>
  )
}
