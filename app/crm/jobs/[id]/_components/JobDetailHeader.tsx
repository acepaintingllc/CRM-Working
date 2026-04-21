'use client'

import type { JobStatus, JobStatusOption } from '@/lib/jobs/types'
import { ArrowLeft, Trash2, type LucideIcon } from 'lucide-react'

const iconSizeMd = 18

function iconLabel(Icon: LucideIcon, label: string, size = iconSizeMd) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

type JobDetailHeaderProps = {
  title: string
  status: JobStatus | null
  statusOptions: JobStatusOption[]
  deleting: boolean
  onBack: () => void
  onDelete: () => void
  onStatusChange: (status: string) => void
  formatStatus: (value: string | null | undefined) => string
  deleteButtonClassName: string
}

export default function JobDetailHeader({
  title,
  status,
  statusOptions,
  deleting,
  onBack,
  onDelete,
  onStatusChange,
  formatStatus,
  deleteButtonClassName,
}: JobDetailHeaderProps) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-gray-900">Job details</h1>
          <p className="m-0 text-sm text-gray-600">Full job overview and schedule.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70"
        >
          {iconLabel(ArrowLeft, 'Back')}
        </button>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-3xl font-extrabold tracking-tight text-gray-900">{title}</div>
        {status ? (
          <div className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-extrabold tracking-wide text-gray-800">
            {formatStatus(status)}
          </div>
        ) : null}
      </div>
      {status ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">
              Job stage
            </div>
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
              className="h-9 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none ring-black/70 focus:ring-2"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onDelete} className={deleteButtonClassName} disabled={deleting}>
              {deleting ? iconLabel(Trash2, 'Deleting...') : iconLabel(Trash2, 'Delete job')}
            </button>
          </div>
        </>
      ) : null}
    </>
  )
}
