'use client'

import type { EstimateDriveFile, JobDetail } from '@/lib/jobs/actions'
import { Copy, FileText, MapPin, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

function iconLabel(Icon: LucideIcon, label: string, size = 16) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

type JobDetailsPanelProps = {
  job: JobDetail
  estimateFile: EstimateDriveFile | null
  estimateFileError: string | null
  actionButtonClassName: string
  onCopy: (label: string, value: string | null | undefined) => void
}

function renderRow(
  label: string,
  value: string | null | undefined,
  actions?: ReactNode
) {
  return (
    <div className="mt-4">
      <div className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">{label}</div>
      <div className="mt-1 flex items-start gap-2">
        <div className="min-w-0 flex-1 text-base font-semibold text-gray-900">{value ?? '-'}</div>
        {actions}
      </div>
    </div>
  )
}

export default function JobDetailsPanel({
  job,
  estimateFile,
  estimateFileError,
  actionButtonClassName,
  onCopy,
}: JobDetailsPanelProps) {
  return (
    <>
      {renderRow('Customer', job.customer_name ?? job.customer_id)}
      {renderRow(
        'Address',
        job.customer_address,
        job.customer_address ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customer_address)}`}
            target="_blank"
            rel="noreferrer"
            className={`${actionButtonClassName} no-underline`}
          >
            {iconLabel(MapPin, 'Google Maps')}
          </a>
        ) : null
      )}
      {renderRow(
        'Email',
        job.customer_email,
        job.customer_email ? (
          <button onClick={() => onCopy('Email', job.customer_email)} className={actionButtonClassName}>
            {iconLabel(Copy, 'Copy')}
          </button>
        ) : null
      )}
      {renderRow(
        'Phone',
        job.customer_phone,
        job.customer_phone ? (
          <button onClick={() => onCopy('Phone', job.customer_phone)} className={actionButtonClassName}>
            {iconLabel(Copy, 'Copy')}
          </button>
        ) : null
      )}
      {renderRow(
        'Latest Estimate',
        estimateFile
          ? `${estimateFile.name}${estimateFile.version ? ` (v${estimateFile.version})` : ''}`
          : estimateFileError ?? 'No matching estimate in Drive folder',
        estimateFile?.webViewLink ? (
          <a
            href={estimateFile.webViewLink}
            target="_blank"
            rel="noreferrer"
            className={`${actionButtonClassName} no-underline`}
          >
            {iconLabel(FileText, 'Preview')}
          </a>
        ) : null
      )}
      {renderRow('Notes', job.description)}
    </>
  )
}
