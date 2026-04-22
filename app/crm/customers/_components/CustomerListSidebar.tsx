'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import type { CustomerListItem } from '../_lib/types'

type CustomerListSidebarProps = {
  activeCustomerId?: string
  query: string
  onQueryChange: (value: string) => void
  listCustomers: CustomerListItem[]
  listLoading: boolean
  listError: string | null
  listQueryString: string
}

export function CustomerListSidebar(props: CustomerListSidebarProps) {
  return (
    <CrmSectionCard
      title="Customers"
      description={
        props.listCustomers.length === 0
          ? 'No customers yet.'
          : `Showing ${props.listCustomers.length}`
      }
      variant="rail"
    >
      <CrmSearchBar
        value={props.query}
        onChange={props.onQueryChange}
        placeholder="Search customers"
      />

      <div className="grid gap-2">
        {props.listLoading ? (
          <div className="text-sm text-[color:var(--crm-ui-muted)]">Loading...</div>
        ) : null}
        {!props.listLoading && props.listError ? (
          <div className="text-sm text-[color:var(--crm-ui-danger-text)]">{props.listError}</div>
        ) : null}
        {!props.listLoading && !props.listError && props.listCustomers.length === 0 ? (
          <CrmEmptyState
            compact
            emoji="🔎"
            title="No matching customers"
            description="Try a broader search."
          />
        ) : null}
        {!props.listLoading &&
          !props.listError &&
          props.listCustomers.map((customer) => {
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
