'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDenseMetaList } from '@/app/crm/_components/CrmDenseMetaList'
import type { EstimateDriveFile, JobDetail } from '@/lib/jobs/client'
import { Copy, FileText, MapPin, type LucideIcon } from 'lucide-react'

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
  onCopy: (label: string, value: string | null | undefined) => void
}

export default function JobDetailsPanel({
  job,
  estimateFile,
  estimateFileError,
  onCopy,
}: JobDetailsPanelProps) {
  return (
    <CrmDenseMetaList
      items={[
        { label: 'Customer', value: job.customer_name ?? job.customer_id },
        {
          label: 'Address',
          value: job.customer_address ?? '-',
          actions: job.customer_address ? (
            <CrmButton
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customer_address)}`}
              target="_blank"
              rel="noreferrer"
            >
              {iconLabel(MapPin, 'Google Maps')}
            </CrmButton>
          ) : null,
        },
        {
          label: 'Email',
          value: job.customer_email ?? '-',
          actions: job.customer_email ? (
            <CrmButton onClick={() => onCopy('Email', job.customer_email)}>{iconLabel(Copy, 'Copy')}</CrmButton>
          ) : null,
        },
        {
          label: 'Phone',
          value: job.customer_phone ?? '-',
          actions: job.customer_phone ? (
            <CrmButton onClick={() => onCopy('Phone', job.customer_phone)}>{iconLabel(Copy, 'Copy')}</CrmButton>
          ) : null,
        },
        {
          label: 'Latest Estimate',
          value: estimateFile
            ? `${estimateFile.name}${estimateFile.version ? ` (v${estimateFile.version})` : ''}`
            : estimateFileError ?? 'No matching estimate in Drive folder',
          actions: estimateFile?.webViewLink ? (
            <CrmButton href={estimateFile.webViewLink} target="_blank" rel="noreferrer">
              {iconLabel(FileText, 'Preview')}
            </CrmButton>
          ) : null,
        },
        { label: 'Notes', value: job.description ?? '-' },
      ]}
    />
  )
}
