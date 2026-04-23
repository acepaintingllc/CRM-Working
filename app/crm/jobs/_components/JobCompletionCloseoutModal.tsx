'use client'

import { loadQuoteCatalogs } from '@/lib/quotes/client'
import { type JobDetail } from '@/lib/jobs/client'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalSection } from '@/app/crm/_components/CrmModalSection'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import { useCloseoutForm } from '@/app/crm/jobs/_components/hooks/useCloseoutForm'
import { Mail, Plus, Send, Trash2 } from 'lucide-react'
import { useCallback } from 'react'

export type { PaintLogRow } from '@/lib/jobs/paintLog'

type EstimateCatalogPayload = {
  catalogs?: {
    paint_products?: Array<{ id?: string | null; label?: string | null }>
    color_codes?: Array<{ id?: string | null; label?: string | null }>
  }
}

type CloseoutSavedResult = {
  job?: Partial<JobDetail> | null
  notice?: string | null
}

type JobCompletionCloseoutModalProps = {
  jobId: string | null
  open: boolean
  onClose: () => void
  onSaved?: (result: CloseoutSavedResult) => void
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function JobCompletionCloseoutModal({
  jobId,
  open,
  onClose,
  onSaved,
}: JobCompletionCloseoutModalProps) {
  const loadCatalogs = useCallback(
    async (linkedEstimateId: string) =>
      loadQuoteCatalogs<EstimateCatalogPayload>(linkedEstimateId).catch(() => null),
    []
  )

  const {
    job,
    loading,
    saving,
    sendingEmail,
    subject,
    setSubject,
    body,
    setBody,
    closeoutNotes,
    setCloseoutNotes,
    paintRows,
    updateRow,
    removeRow,
    addRow,
    paintOptions,
    colorOptions,
    error,
    emailNotice,
    templateMissing,
    emailSkipped,
    canSendEmail,
    sendReviewEmail,
    skipEmail,
    saveAndClose,
    defaultWhereUsedOptions,
    defaultSheenOptions,
  } = useCloseoutForm({
    jobId,
    open,
    loadCatalogs,
    onSaved,
  })

  if (!open || !jobId) return null

  const handleSaveAndClose = async () => {
    const saved = await saveAndClose()
    if (saved) {
      onClose()
    }
  }

  return (
    <CrmModalShell labelledBy="job-closeout-title" onClose={onClose} widthClassName="max-w-5xl">
      <CrmModalHeader
        eyebrow="Job closeout"
        title="Completed checklist"
        description={job?.title ?? 'Loading job...'}
        labelledBy="job-closeout-title"
        onClose={onClose}
        closeLabel="Close closeout modal"
      />

      <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
        {error ? <CrmNotice tone="error" compact>{error}</CrmNotice> : null}

        <CrmModalSection
          title="Review email"
          description={job?.customer_email ? `To: ${job.customer_email}` : 'Customer email missing'}
          tone="muted"
        >
          {templateMissing ? (
            <CrmNotice tone="warning" compact>
              Missing completed/review email template.
            </CrmNotice>
          ) : null}
          {loading ? (
            <div className="mt-3 text-sm text-[color:var(--crm-ui-muted)]">Loading composer...</div>
          ) : (
            <div className="mt-3 grid gap-3">
              <CrmField label="Subject">
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Subject"
                  className={crmInputClassName()}
                />
              </CrmField>
              <CrmField label="Body">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Body"
                  className={crmInputClassName('min-h-[120px]')}
                />
              </CrmField>
              <div className="flex flex-wrap items-center gap-2">
                <CrmButton onClick={() => void sendReviewEmail()} disabled={!canSendEmail} tone="primary">
                  <Send size={14} />
                  <span>{sendingEmail ? 'Sending...' : 'Send review email'}</span>
                </CrmButton>
                <CrmButton onClick={skipEmail}>
                  <Mail size={14} />
                  <span>Skip for now</span>
                </CrmButton>
                {job?.completed_email_sent_at ? (
                  <span className="text-xs text-[color:var(--crm-ui-success-text)]">
                    Sent: {formatDate(job.completed_email_sent_at)}
                  </span>
                ) : null}
              </div>
              {emailNotice || emailSkipped ? (
                <CrmNotice tone="success" compact>
                  {emailNotice ?? 'Review email skipped for now.'}
                </CrmNotice>
              ) : null}
            </div>
          )}
        </CrmModalSection>

        <CrmModalSection
          title="Paint log"
          className="mt-4"
          actions={
            <CrmButton onClick={addRow} className="min-h-0 px-2.5 py-1.5 text-xs">
              <Plus size={14} />
              <span>Add row</span>
            </CrmButton>
          }
        >
          <datalist id={`closeout-where-${jobId}`}>
            {defaultWhereUsedOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <datalist id={`closeout-product-${jobId}`}>
            {paintOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <datalist id={`closeout-sheen-${jobId}`}>
            {defaultSheenOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <datalist id={`closeout-color-${jobId}`}>
            {colorOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>

          <div className="grid gap-2">
            {paintRows.map((row, index) => (
              <div
                key={row.id ?? `row-${index}`}
                className="ace-crm-surface-muted rounded-[14px] px-3 py-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-extrabold text-[color:var(--crm-ui-muted)] uppercase">
                    Row {index + 1}
                  </div>
                  {index > 0 && (
                    <CrmButton
                      onClick={() => removeRow(index)}
                      tone="danger"
                      className="min-h-0 px-2 py-1 text-xs"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </CrmButton>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <CrmField label="Where used">
                    <input
                      value={row.where_used}
                      onChange={(event) => updateRow(index, { where_used: event.target.value })}
                      list={`closeout-where-${jobId}`}
                      placeholder="Where used"
                      className={crmInputClassName()}
                    />
                  </CrmField>
                  <CrmField label="Paint product">
                    <input
                      value={row.paint_product}
                      onChange={(event) => updateRow(index, { paint_product: event.target.value })}
                      list={`closeout-product-${jobId}`}
                      placeholder="Paint product"
                      className={crmInputClassName()}
                    />
                  </CrmField>
                  <CrmField label="Sheen">
                    <input
                      value={row.sheen}
                      onChange={(event) => updateRow(index, { sheen: event.target.value })}
                      list={`closeout-sheen-${jobId}`}
                      placeholder="Sheen"
                      className={crmInputClassName()}
                    />
                  </CrmField>
                  <CrmField label="Color">
                    <input
                      value={row.color}
                      onChange={(event) => updateRow(index, { color: event.target.value })}
                      list={`closeout-color-${jobId}`}
                      placeholder="Color"
                      className={crmInputClassName()}
                    />
                  </CrmField>
                  <CrmField label="Notes">
                    <textarea
                      value={row.notes}
                      onChange={(event) => updateRow(index, { notes: event.target.value })}
                      placeholder="Notes"
                      className={crmInputClassName('min-h-[70px] md:col-span-2')}
                    />
                  </CrmField>
                </div>
              </div>
            ))}
          </div>
        </CrmModalSection>

        <CrmModalSection title="Closeout notes" className="mt-4">
          <CrmField label="Internal closeout notes">
            <textarea
              value={closeoutNotes}
              onChange={(event) => setCloseoutNotes(event.target.value)}
              placeholder="Internal closeout notes..."
              className={crmInputClassName('min-h-[120px]')}
            />
          </CrmField>
        </CrmModalSection>
      </div>

      <div className="border-t border-[color:var(--crm-ui-border)] px-5 py-4">
        <CrmFormActions className="justify-end">
          <CrmButton onClick={onClose}>Cancel</CrmButton>
          <CrmButton onClick={() => void handleSaveAndClose()} disabled={saving || loading} tone="primary">
            {saving ? 'Saving...' : 'Save & Close'}
          </CrmButton>
        </CrmFormActions>
      </div>
    </CrmModalShell>
  )
}
