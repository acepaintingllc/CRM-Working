'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  BriefcaseBusiness,
  Copy,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
} from 'lucide-react'
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
  const actionButtonClass =
    'inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/70'
  const customer = props.customer

  function renderRow(label: string, value: string | null | undefined) {
    return (
      <div className="mt-3.5">
        <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
        <div className="mt-0.5 flex items-center">
          <div className="flex-1 text-base font-semibold text-gray-900">{value ?? '-'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {props.loading && <div className="text-gray-500">Loading customer...</div>}
      {!props.loading && !props.customer && <div className="text-gray-500">Customer not found.</div>}

      {!props.loading && customer && (
        <>
          {props.error && <div className="mb-3 text-red-700">{props.error}</div>}
          {props.statusMessage && <div className="mb-3 text-emerald-700">{props.statusMessage}</div>}
          <div className="text-2xl font-bold text-gray-900">{customer.name}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {customer.email && (
              <a href={`mailto:${customer.email}`} className={actionButtonClass}>
                <Mail size={16} aria-hidden="true" />
                <span>Email</span>
              </a>
            )}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className={actionButtonClass}>
                <Phone size={16} aria-hidden="true" />
                <span>Call</span>
              </a>
            )}
            {customer.email && (
              <button onClick={() => props.onCopy('Email', customer.email)} className={actionButtonClass}>
                <Copy size={16} aria-hidden="true" />
                <span>Copy email</span>
              </button>
            )}
            {customer.phone && (
              <button onClick={() => props.onCopy('Phone', customer.phone)} className={actionButtonClass}>
                <Copy size={16} aria-hidden="true" />
                <span>Copy phone</span>
              </button>
            )}
            {customer.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`}
                target="_blank"
                rel="noreferrer"
                className={actionButtonClass}
              >
                <MapPin size={16} aria-hidden="true" />
                <span>Map</span>
              </a>
            )}
            <Link href={`/crm/jobs/new?customerId=${customer.id}`} className={actionButtonClass}>
              <BriefcaseBusiness size={16} aria-hidden="true" />
              <span>Create job</span>
            </Link>
            <Link
              href={`/crm/customers/${customer.id}/edit?returnTo=${encodeURIComponent(props.detailPathWithQuery)}`}
              className={actionButtonClass}
            >
              <Pencil size={16} aria-hidden="true" />
              <span>Edit</span>
            </Link>
            <button
              onClick={props.onDelete}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
              disabled={props.deleting}
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>{props.deleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>

          {renderRow('Email', customer.email)}
          {renderRow('Phone', customer.phone)}
          {renderRow('Address', customer.address)}
          {renderRow(
            'Created',
            customer.created_at ? new Date(customer.created_at).toLocaleString() : null
          )}

          <button
            onClick={props.onBack}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-black bg-black px-3 py-2 text-sm font-semibold text-white transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-black/80"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to customers</span>
          </button>
        </>
      )}
    </div>
  )
}
