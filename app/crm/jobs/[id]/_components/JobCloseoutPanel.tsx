'use client'

import type { JobDetail, JobPhoto, SitePhoto } from '@/lib/jobs/actions'
import type { JobWorkflowResolvedAction } from '@/lib/jobs/types'
import type { PaintLogRow } from '@/lib/jobs/paintLog'

type JobCloseoutPanelProps = {
  job: JobDetail
  paintLogs: PaintLogRow[]
  afterPhotos: JobPhoto[]
  sitePhotos: SitePhoto[]
  detailActions: JobWorkflowResolvedAction[]
  formatDate: (iso: string | null | undefined) => string
}

export default function JobCloseoutPanel({
  job,
  paintLogs,
  afterPhotos,
  sitePhotos,
  detailActions,
  formatDate,
}: JobCloseoutPanelProps) {
  const showCloseoutReference =
    detailActions.some((action) => action.id === 'open_closeout') ||
    paintLogs.length > 0 ||
    afterPhotos.length > 0 ||
    Boolean(job.closeout_notes)

  return (
    <>
      {showCloseoutReference && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
            Closeout Reference
          </div>
          <div className="mt-2 grid gap-2 text-sm text-gray-800">
            <div>
              <div className="text-xs font-bold text-gray-600 uppercase">Closeout notes</div>
              <div className="mt-1 whitespace-pre-wrap text-sm">
                {job.closeout_notes?.trim() ? job.closeout_notes : 'No closeout notes yet.'}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-600 uppercase">Paint logs</div>
              {paintLogs.length === 0 ? (
                <div className="mt-1 text-sm text-gray-600">No paint logs saved yet.</div>
              ) : (
                <div className="mt-1 grid gap-2">
                  {paintLogs.map((row, idx) => (
                    <div
                      key={row.id ?? `paint-${idx}`}
                      className="rounded-lg border border-gray-200 bg-white p-2"
                    >
                      <div className="font-semibold text-gray-900">
                        {row.where_used || `Area ${idx + 1}`}
                      </div>
                      <div className="mt-1 text-xs text-gray-700">
                        Product: {row.paint_product || '-'} | Sheen: {row.sheen || '-'} | Color:{' '}
                        {row.color || '-'}
                      </div>
                      {row.notes && <div className="mt-1 text-xs text-gray-600">{row.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-gray-600 uppercase">After photos</div>
              {afterPhotos.length === 0 ? (
                <div className="mt-1 text-sm text-gray-600">No after photos uploaded yet.</div>
              ) : (
                <div className="mt-1 grid gap-1">
                  {afterPhotos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-gray-800 underline"
                    >
                      After photo - {formatDate(photo.captured_at ?? photo.created_at ?? photo.uploaded_at)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {sitePhotos.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
            Field Photos
          </div>
          <div className="mt-2 grid gap-1">
            {sitePhotos.slice(0, 8).map((photo) => (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-gray-800 underline"
              >
                {photo.caption?.trim()
                  ? photo.caption
                  : `Field photo - ${formatDate(photo.captured_at)}`}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
