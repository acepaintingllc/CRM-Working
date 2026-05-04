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

function acceptedQuoteHref(job: JobDetail) {
  if (job.accepted_quote?.public_token) {
    return `/quote/${encodeURIComponent(job.accepted_quote.public_token)}`
  }
  if (job.accepted_quote?.estimate_id) {
    return `/crm/quotes/${encodeURIComponent(job.accepted_quote.estimate_id)}`
  }
  return null
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
  const acceptedQuote = job.accepted_quote ?? null
  const acceptedQuoteLink = acceptedQuoteHref(job)
  const quoteItem = acceptedQuote
    ? {
        label: 'Accepted Quote',
        value: (
          <div className="grid gap-2">
            <div>Accepted by {acceptedQuote.accepted_by_legal_name ?? '-'}</div>
            <div className="text-xs font-semibold text-[color:var(--crm-ui-muted)]">
              Public version #{acceptedQuote.public_version_number || '-'} - Accepted{' '}
              {formatAcceptedAt(acceptedQuote.accepted_at)}
            </div>
            <details className="text-xs font-semibold text-[color:var(--crm-ui-muted)]">
              <summary className="cursor-pointer text-[color:var(--crm-ui-text)]">Audit details</summary>
              <div className="mt-2 grid gap-1">
                <div>Signature type: {acceptedQuote.signature_type ?? '-'}</div>
                <div>IP: {acceptedQuote.ip ?? '-'}</div>
                <div>User agent: {acceptedQuote.user_agent ?? '-'}</div>
                <div>Public version ID: {acceptedQuote.accepted_public_version_id}</div>
              </div>
            </details>
          </div>
        ),
        actions: acceptedQuoteLink ? (
          <CrmButton href={acceptedQuoteLink} target="_blank" rel="noreferrer">
            {iconLabel(FileCheck2, 'Open accepted quote')}
          </CrmButton>
        ) : null,
      }
    : {
        label: 'Latest Estimate',
        value: estimateFile
          ? `${estimateFile.name}${estimateFile.version ? ` (v${estimateFile.version})` : ''}`
          : estimateFileError ?? 'No matching estimate in Drive folder',
        actions: estimateFile?.webViewLink ? (
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
