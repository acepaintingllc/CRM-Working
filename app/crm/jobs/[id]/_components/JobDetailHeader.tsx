'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmField } from '@/app/crm/_components/CrmField'
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
}: JobDetailHeaderProps) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="m-0 text-xl font-black text-[color:var(--crm-ui-text)]">Job status</h2>
          <p className="m-0 text-sm text-[color:var(--crm-ui-muted)]">Full job overview and schedule.</p>
        </div>
        <CrmButton type="button" onClick={onBack}>
          {iconLabel(ArrowLeft, 'Back')}
        </CrmButton>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-3xl font-extrabold tracking-tight text-[color:var(--crm-ui-text)]">{title}</div>
        {status ? <CrmChip tone="accent">{formatStatus(status)}</CrmChip> : null}
      </div>
      {status ? (
        <>
          <CrmField label="Job stage">
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
              className="ace-crm-input max-w-[280px] text-sm"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.title}
                </option>
              ))}
            </select>
          </CrmField>
          <div className="flex flex-wrap gap-2">
            <CrmButton type="button" onClick={onDelete} tone="danger" disabled={deleting}>
              {deleting ? iconLabel(Trash2, 'Deleting...') : iconLabel(Trash2, 'Delete job')}
            </CrmButton>
          </div>
        </>
      ) : null}
    </div>
  )
}
