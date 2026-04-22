'use client'

import type { EmailSendStatus } from '@/lib/email/types'
import type { JobDetail } from '@/lib/jobs/client'
import { type StageEmailStage } from '@/lib/jobs/types'
import { useEmailComposer } from '@/app/crm/jobs/_components/hooks/useEmailComposer'
import { Mail, Send, X } from 'lucide-react'

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-email-modal-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
              Stage Email
            </div>
            <h2 id="stage-email-modal-title" className="mt-1 text-xl font-extrabold text-gray-900">
              {actionLabel}
            </h2>
            <div className="mt-1 text-sm text-gray-600">
              {job?.customer_email ? `To: ${job.customer_email}` : 'Customer email required'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
            aria-label="Close email composer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {blockingIssues.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {blockingIssues.map((issue) => (
                <div key={issue}>{issue}</div>
              ))}
            </div>
          )}

          {needsEstimateAttachment && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                selectedEstimateFiles.length > 0
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {selectedEstimateFiles.length > 0
                ? `Estimate attachments ready: ${selectedEstimateFiles.length} selected`
                : 'Estimate attachment is required before this email can be sent.'}
            </div>
          )}

          {needsEstimateAttachment && estimateFiles.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              <button
                type="button"
                onClick={() => setShowEstimatePicker((prev) => !prev)}
                className="inline-flex h-8 items-center rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
              >
                {showEstimatePicker ? 'Hide estimate picker' : 'Choose estimate PDFs'}
              </button>
              {showEstimatePicker && (
                <div className="mt-2 grid gap-1">
                  {estimateFiles.map((file) => {
                    const checked = selectedEstimateFileIds.includes(file.id)
                    const versionLabel =
                      typeof file.version === 'number' ? `v${file.version}` : null
                    const matchLabel =
                      typeof file.matchMode === 'string' && file.matchMode
                        ? file.matchMode
                        : null
                    const meta = [versionLabel, matchLabel].filter(Boolean).join(' | ')
                    return (
                      <label
                        key={file.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900"
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
                          <span className="block truncate font-semibold">{file.name}</span>
                          {meta ? <span className="block text-gray-600">{meta}</span> : null}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {needsEstimateAttachment && missingEstimateSelection && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Select at least one estimate PDF.
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-600">
              Loading email template...
            </div>
          ) : (
            <>
              <div>
                <div className="mb-1 text-xs font-extrabold tracking-wide text-gray-500 uppercase">
                  Subject
                </div>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 focus:ring-2"
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-extrabold tracking-wide text-gray-500 uppercase">
                  Body
                </div>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="min-h-[220px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 focus:ring-2"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-4">
          <div className="inline-flex items-center gap-2 text-sm text-gray-600">
            <Mail size={16} />
            <span>{alreadySent ? 'This stage email has already been sent once.' : 'Ready to send.'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
            >
              {closeLabel}
            </button>
            <button
              type="button"
              onClick={() => void sendComposed()}
              disabled={!canSend}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-black/70 ${
                canSend
                  ? 'border border-black bg-black text-white'
                  : 'cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-400'
              }`}
            >
              <Send size={16} />
              <span>{sending ? 'Sending...' : actionLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
