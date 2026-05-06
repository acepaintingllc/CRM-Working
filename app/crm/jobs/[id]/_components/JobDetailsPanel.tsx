'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmDenseMetaList } from '@/app/crm/_components/CrmDenseMetaList'
import type { EstimateDriveFile, JobDetail } from '@/types/jobs/api'
import { Copy, FileCheck2, FileText, MapPin, type LucideIcon } from 'lucide-react'

function iconLabel(Icon: LucideIcon, label: string, size = 16) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

function formatAcceptedAt(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function acceptedEstimateHref(job: JobDetail) {
  if (job.accepted_estimate?.public_token) {
    return `/quote/${encodeURIComponent(job.accepted_estimate.public_token)}`
  }
  if (job.accepted_estimate?.estimate_id) {
    return `/crm/quotes/${encodeURIComponent(job.accepted_estimate.estimate_id)}`
  }
  return null
}

function estimateNavigationHref(job: JobDetail) {
  const navigationEstimateId =
    typeof job.estimate_navigation_id === 'string' ? job.estimate_navigation_id.trim() : ''
  return navigationEstimateId
    ? `/crm/quotes/${encodeURIComponent(navigationEstimateId)}`
    : null
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
  const acceptedEstimate = job.accepted_estimate ?? null
  const acceptedEstimateLink = acceptedEstimateHref(job)
  const quoteNavigationLink = estimateNavigationHref(job)
  const quoteItem = acceptedEstimate
    ? {
        label: 'Accepted Quote',
        value: (
          <div className="grid gap-2">
            <div>Accepted by {acceptedEstimate.accepted_by_legal_name ?? '-'}</div>
            <div className="text-xs font-semibold text-[color:var(--crm-ui-muted)]">
              Public version #{acceptedEstimate.public_version_number || '-'} - Accepted{' '}
              {formatAcceptedAt(acceptedEstimate.accepted_at)}
            </div>
            <details className="text-xs font-semibold text-[color:var(--crm-ui-muted)]">
              <summary className="cursor-pointer text-[color:var(--crm-ui-text)]">Audit details</summary>
              <div className="mt-2 grid gap-1">
                <div>Signature type: {acceptedEstimate.signature_type ?? '-'}</div>
                <div>IP: {acceptedEstimate.ip ?? '-'}</div>
                <div>User agent: {acceptedEstimate.user_agent ?? '-'}</div>
                <div>Public version ID: {acceptedEstimate.accepted_public_version_id}</div>
              </div>
            </details>
          </div>
        ),
        actions: acceptedEstimateLink ? (
          <CrmButton href={acceptedEstimateLink} target="_blank" rel="noreferrer">
            {iconLabel(FileCheck2, 'Open accepted quote')}
          </CrmButton>
        ) : null,
      }
    : {
        label: 'Latest Quote',
        value: estimateFile
          ? `${estimateFile.name}${estimateFile.version ? ` (v${estimateFile.version})` : ''}`
          : estimateFileError ?? 'No matching quote in Drive folder',
        actions: quoteNavigationLink ? (
          <CrmButton href={quoteNavigationLink}>
            {iconLabel(FileText, 'Open quote')}
          </CrmButton>
        ) : estimateFile?.webViewLink ? (
          <CrmButton href={estimateFile.webViewLink} target="_blank" rel="noreferrer">
            {iconLabel(FileText, 'Preview')}
          </CrmButton>
        ) : null,
      }

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
        quoteItem,
        { label: 'Notes', value: job.description ?? '-' },
      ]}
    />
  )
}
