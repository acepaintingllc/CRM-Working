'use client'
import {
  BriefcaseBusiness,
  Copy,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
} from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmDenseActionRow } from '@/app/crm/_components/CrmDenseActionRow'
import { CrmDenseMetaList } from '@/app/crm/_components/CrmDenseMetaList'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { CustomerDetail } from '@/lib/customers/types'

type CustomerDetailCardProps = {
  customer: CustomerDetail | null
  loading: boolean
  error: string | null
  statusMessage: string | null
  deleting: boolean
  detailPathWithQuery: string
  onBack: () => void
  onCopy: (label: string, value: string | null) => void
  onDelete: () => void
}

export function CustomerDetailCard(props: CustomerDetailCardProps) {
  const customer = props.customer

  return (
    <CrmSectionCard
      title={customer?.name ?? 'Customer profile'}
      description="Customer profile, contact details, and quick actions."
      badge={customer ? <CrmChip tone="accent">Profile</CrmChip> : null}
    >
      {props.loading && <div className="text-gray-500">Loading customer...</div>}
      {!props.loading && !props.customer && <div className="text-gray-500">Customer not found.</div>}

      {!props.loading && customer && (
        <>
          {props.error ? <CrmNotice tone="error" compact>{props.error}</CrmNotice> : null}
          {props.statusMessage ? <CrmNotice tone="success" compact>{props.statusMessage}</CrmNotice> : null}
          <CrmDenseActionRow className="mt-3">
            {customer.email && (
              <CrmButton href={`mailto:${customer.email}`}>
                <Mail size={16} aria-hidden="true" />
                <span>Email</span>
              </CrmButton>
            )}
            {customer.phone && (
              <CrmButton href={`tel:${customer.phone}`}>
                <Phone size={16} aria-hidden="true" />
                <span>Call</span>
              </CrmButton>
            )}
            {customer.email && (
              <CrmButton type="button" onClick={() => props.onCopy('Email', customer.email)}>
                <Copy size={16} aria-hidden="true" />
                <span>Copy email</span>
              </CrmButton>
            )}
            {customer.phone && (
              <CrmButton type="button" onClick={() => props.onCopy('Phone', customer.phone)}>
                <Copy size={16} aria-hidden="true" />
                <span>Copy phone</span>
              </CrmButton>
            )}
            {customer.address && (
              <CrmButton
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={16} aria-hidden="true" />
                <span>Map</span>
              </CrmButton>
            )}
            <CrmButton href={`/crm/jobs/new?customerId=${customer.id}`} prefetch={false}>
              <BriefcaseBusiness size={16} aria-hidden="true" />
              <span>Create job</span>
            </CrmButton>
            <CrmButton
              href={`/crm/customers/${customer.id}/edit?returnTo=${encodeURIComponent(props.detailPathWithQuery)}`}
            >
              <Pencil size={16} aria-hidden="true" />
              <span>Edit</span>
            </CrmButton>
            <CrmButton
              type="button"
              onClick={props.onDelete}
              tone="danger"
              disabled={props.deleting}
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>{props.deleting ? 'Deleting...' : 'Delete'}</span>
            </CrmButton>
          </CrmDenseActionRow>

          <CrmDenseMetaList
            className="mt-4"
            items={[
              { label: 'Email', value: customer.email ?? '-' },
              { label: 'Phone', value: customer.phone ?? '-' },
              { label: 'Address', value: customer.address ?? '-' },
              {
                label: 'Created',
                value: customer.created_at ? new Date(customer.created_at).toLocaleString() : '-',
              },
            ]}
          />

          <div className="mt-4">
            <CrmButton type="button" onClick={props.onBack}>
              <span>Back to customers</span>
            </CrmButton>
          </div>
        </>
      )}
    </CrmSectionCard>
  )
}
