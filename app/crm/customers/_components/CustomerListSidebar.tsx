'use client'

import Link from 'next/link'
import { Filter, Mail, Phone, User } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { CustomerListItem } from '../_lib/types'

type CustomerListSidebarProps = {
  activeCustomerId?: string
  query: string
  hasEmail: boolean
  hasPhone: boolean
  hasSet: Set<string>
  listCustomers: CustomerListItem[]
  filteredList: CustomerListItem[]
  listLoading: boolean
  listError: string | null
  listQueryString: string
  updateParams: (patch: Record<string, string | null>) => void
}

export function CustomerListSidebar(props: CustomerListSidebarProps) {
  return (
    <CrmSectionCard
      title="Customers"
      description={
        props.listCustomers.length === 0
          ? 'No customers yet.'
          : `Showing ${props.filteredList.length} of ${props.listCustomers.length}`
      }
      variant="rail"
    >
      <CrmSearchBar
        value={props.query}
        onChange={(value) => props.updateParams({ q: value || null })}
        placeholder="Search customers"
        actions={
          <>
            <CrmButton
              type="button"
              tone={props.hasEmail ? 'primary' : 'secondary'}
              onClick={() => {
                const next = new Set(props.hasSet)
                if (next.has('email')) next.delete('email')
                else next.add('email')
                props.updateParams({ has: next.size ? Array.from(next).join(',') : null })
              }}
            >
              <Mail size={13} aria-hidden="true" />
              <span>Has email</span>
            </CrmButton>
            <CrmButton
              type="button"
              tone={props.hasPhone ? 'primary' : 'secondary'}
              onClick={() => {
                const next = new Set(props.hasSet)
                if (next.has('phone')) next.delete('phone')
                else next.add('phone')
                props.updateParams({ has: next.size ? Array.from(next).join(',') : null })
              }}
            >
              <Phone size={13} aria-hidden="true" />
              <span>Has phone</span>
            </CrmButton>
            {(props.query || props.hasSet.size) ? (
              <CrmButton
                type="button"
                onClick={() => props.updateParams({ q: null, has: null })}
              >
                <Filter size={13} aria-hidden="true" />
                <span>Clear</span>
              </CrmButton>
            ) : null}
          </>
        }
      />

      <div className="grid gap-2">
        {props.listLoading ? (
          <div className="text-sm text-[color:var(--crm-ui-muted)]">Loading...</div>
        ) : null}
        {!props.listLoading && props.listError ? (
          <div className="text-sm text-[color:var(--crm-ui-danger-text)]">{props.listError}</div>
        ) : null}
        {!props.listLoading && !props.listError && props.filteredList.length === 0 ? (
          <CrmEmptyState
            compact
            emoji="🔎"
            title="No matching customers"
            description="Try a broader search or clear one of the filters."
          />
        ) : null}
        {!props.listLoading &&
          !props.listError &&
          props.filteredList.map((customer) => {
            const active = customer.id === props.activeCustomerId
            return (
              <Link
                key={customer.id}
                href={`/crm/customers/${customer.id}${props.listQueryString ? `?${props.listQueryString}` : ''}`}
                className={`ace-crm-surface block rounded-[var(--crm-ui-radius-sm)] px-3 py-3 no-underline transition ${
                  active
                    ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)]'
                    : 'hover:border-[color:var(--crm-ui-accent-border)] hover:bg-[color:var(--crm-ui-surface-strong)]'
                }`}
              >
                <div className="inline-flex items-center gap-1.5 font-bold text-[color:var(--crm-ui-text)]">
                  <User size={13} aria-hidden="true" />
                  <span>{customer.name}</span>
                </div>
                {(customer.email || customer.phone) && (
                  <div className="mt-1 text-xs leading-4 text-[color:var(--crm-ui-muted)]">
                    {customer.email ? <div className="break-all">{customer.email}</div> : null}
                    {customer.phone ? <div>{customer.phone}</div> : null}
                  </div>
                )}
              </Link>
            )
          })}
      </div>
    </CrmSectionCard>
  )
}
