'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import {
  parseResponseBody,
  type JobDetail,
} from '@/lib/jobs/actions'
import type { PaintLogRow } from '@/lib/jobs/paintLog'
import { useCloseoutForm } from '@/app/crm/jobs/_components/hooks/useCloseoutForm'
import { Mail, Plus, Send, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useRef, type ChangeEvent } from 'react'

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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadCatalogs = useCallback(async (linkedEstimateId: string) => {
    const catalogsRes = await authedFetch(`/api/quotes/${linkedEstimateId}/catalogs`, {
      cache: 'no-store',
    })
    const catalogsPayload = (await parseResponseBody(catalogsRes)).json as EstimateCatalogPayload | null
    if (!catalogsRes.ok) return null
    return catalogsPayload
  }, [])

  const {
    job,
    loading,
    saving,
    sendingEmail,
    uploadingPhoto,
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
    afterPhotos,
    paintOptions,
    colorOptions,
    error,
    emailNotice,
    photoNotice,
    templateMissing,
    emailSkipped,
    canSendEmail,
    sendReviewEmail,
    skipEmail,
    uploadCloseoutPhoto,
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

  const handlePhotoPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    const uploaded = await uploadCloseoutPhoto(file)
    if (uploaded) {
      event.target.value = ''
    }
  }

  const handleSaveAndClose = async () => {
    const saved = await saveAndClose()
    if (saved) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-closeout-title"
        className="w-full max-w-5xl rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
              Job closeout
            </div>
            <h2 id="job-closeout-title" className="mt-1 text-xl font-extrabold text-gray-900">
              Completed checklist
            </h2>
            <div className="mt-1 text-sm text-gray-600">{job?.title ?? 'Loading job...'}</div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
            aria-label="Close closeout modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <section className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 text-sm font-extrabold text-gray-900">Review email</div>
            <div className="text-xs text-gray-600">
              {job?.customer_email ? `To: ${job.customer_email}` : 'Customer email missing'}
            </div>
            {templateMissing && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                Missing completed/review email template.
              </div>
            )}
            {loading ? (
              <div className="mt-3 text-sm text-gray-600">Loading composer...</div>
            ) : (
              <div className="mt-3 grid gap-2">
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 focus:ring-2"
                />
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Body"
                  className="min-h-[120px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 focus:ring-2"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void sendReviewEmail()}
                    disabled={!canSendEmail}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${
                      canSendEmail
                        ? 'border border-black bg-black text-white'
                        : 'cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Send size={14} />
                    <span>{sendingEmail ? 'Sending...' : 'Send review email'}</span>
                  </button>
                  <button
                    onClick={skipEmail}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900"
                  >
                    <Mail size={14} />
                    <span>Skip for now</span>
                  </button>
                  {job?.completed_email_sent_at && (
                    <span className="text-xs text-green-700">
                      Sent: {formatDate(job.completed_email_sent_at)}
                    </span>
                  )}
                </div>
                {(emailNotice || emailSkipped) && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-800">
                    {emailNotice}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-gray-900">Paint log</div>
              <button
                onClick={addRow}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-900"
              >
                <Plus size={14} />
                <span>Add row</span>
              </button>
            </div>

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
                  className="rounded-lg border border-gray-200 bg-gray-50 p-2"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-extrabold text-gray-600 uppercase">
                      Row {index + 1}
                    </div>
                    {index > 0 && (
                      <button
                        onClick={() => removeRow(index)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700"
                      >
                        <Trash2 size={12} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={row.where_used}
                      onChange={(event) => updateRow(index, { where_used: event.target.value })}
                      list={`closeout-where-${jobId}`}
                      placeholder="Where used"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                    <input
                      value={row.paint_product}
                      onChange={(event) => updateRow(index, { paint_product: event.target.value })}
                      list={`closeout-product-${jobId}`}
                      placeholder="Paint product"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                    <input
                      value={row.sheen}
                      onChange={(event) => updateRow(index, { sheen: event.target.value })}
                      list={`closeout-sheen-${jobId}`}
                      placeholder="Sheen"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                    <input
                      value={row.color}
                      onChange={(event) => updateRow(index, { color: event.target.value })}
                      list={`closeout-color-${jobId}`}
                      placeholder="Color"
                      className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    />
                    <textarea
                      value={row.notes}
                      onChange={(event) => updateRow(index, { notes: event.target.value })}
                      placeholder="Notes"
                      className="min-h-[70px] w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 md:col-span-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 text-sm font-extrabold text-gray-900">Optional photo</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handlePhotoPick(event)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900"
              >
                <Upload size={14} />
                <span>{uploadingPhoto ? 'Uploading...' : 'Add photo'}</span>
              </button>
              {photoNotice && <span className="text-xs text-green-700">{photoNotice}</span>}
            </div>
            {afterPhotos.length > 0 && (
              <div className="mt-2 grid gap-1 text-xs">
                {afterPhotos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-700 underline"
                  >
                    After photo · {formatDate(photo.captured_at ?? photo.created_at ?? photo.uploaded_at)}
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-2 text-sm font-extrabold text-gray-900">Closeout notes</div>
            <textarea
              value={closeoutNotes}
              onChange={(event) => setCloseoutNotes(event.target.value)}
              placeholder="Internal closeout notes..."
              className="min-h-[120px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSaveAndClose()}
            disabled={saving || loading}
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ${
              saving || loading
                ? 'cursor-not-allowed border border-gray-300 bg-gray-100 text-gray-400'
                : 'border border-black bg-black text-white'
            }`}
          >
            {saving ? 'Saving...' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
