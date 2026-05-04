'use client'

import type { JobDetail } from '@/types/jobs/api'
import type { JobWorkflowResolvedAction } from '@/lib/jobs/types'
import type { PaintLogRow } from '@/lib/jobs/paintLog'

type JobCloseoutPanelProps = {
  job: JobDetail
  paintLogs: PaintLogRow[]
  detailActions: JobWorkflowResolvedAction[]
}

export default function JobCloseoutPanel({
  job,
  paintLogs,
  detailActions,
}: JobCloseoutPanelProps) {
  const showCloseoutReference =
    detailActions.some((action) => action.id === 'open_closeout') ||
    paintLogs.length > 0 ||
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
          </div>
        </div>
      )}
    </>
  )
}
