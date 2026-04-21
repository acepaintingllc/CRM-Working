'use client'

import Link from 'next/link'
import { Filter, Mail, Phone, Search, User } from 'lucide-react'
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
  const filterButtonClass =
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold transition focus:outline-none focus:ring-2 focus:ring-black/70'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 text-sm font-black text-gray-900">Customers</div>
      <div className="relative">
        <Search
          size={15}
          aria-hidden="true"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="search"
          value={props.query}
          onChange={(event) => props.updateParams({ q: event.target.value || null })}
          placeholder="Search customers"
          className="h-10 w-full rounded-xl border border-gray-300 pl-8 pr-3 text-sm text-gray-900 outline-none ring-black/70 transition placeholder:text-gray-400 focus:ring-2"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          onClick={() => {
            const next = new Set(props.hasSet)
            if (next.has('email')) next.delete('email')
            else next.add('email')
            props.updateParams({ has: next.size ? Array.from(next).join(',') : null })
          }}
          className={`${filterButtonClass} ${
            props.hasEmail
              ? 'border-black bg-black text-white'
              : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Mail size={13} aria-hidden="true" />
          <span>Has email</span>
        </button>
        <button
          onClick={() => {
            const next = new Set(props.hasSet)
            if (next.has('phone')) next.delete('phone')
            else next.add('phone')
            props.updateParams({ has: next.size ? Array.from(next).join(',') : null })
          }}
          className={`${filterButtonClass} ${
            props.hasPhone
              ? 'border-black bg-black text-white'
              : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Phone size={13} aria-hidden="true" />
          <span>Has phone</span>
        </button>
        {(props.query || props.hasSet.size) && (
          <button
            onClick={() => props.updateParams({ q: null, has: null })}
            className={`${filterButtonClass} border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100`}
          >
            <Filter size={13} aria-hidden="true" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-500">
        {props.listCustomers.length === 0
          ? 'No customers yet'
          : `Showing ${props.filteredList.length} of ${props.listCustomers.length}`}
      </div>

      <div className="mt-2">
        {props.listLoading && <div className="text-sm text-gray-500">Loading...</div>}
        {!props.listLoading && props.listError && <div className="text-sm text-red-700">{props.listError}</div>}
        {!props.listLoading && !props.listError && props.filteredList.length === 0 && (
          <div className="text-sm text-gray-500">No matches.</div>
        )}
        {!props.listLoading &&
          !props.listError &&
          props.filteredList.map((customer) => {
            const active = customer.id === props.activeCustomerId
            return (
              <Link
                key={customer.id}
                href={`/crm/customers/${customer.id}${props.listQueryString ? `?${props.listQueryString}` : ''}`}
                className={`mt-2 block rounded-xl border px-3 py-2 text-sm transition ${
                  active
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="inline-flex items-center gap-1.5 font-bold">
                  <User size={13} aria-hidden="true" />
                  <span>{customer.name}</span>
                </div>
                {(customer.email || customer.phone) && (
                  <div className={`mt-0.5 text-xs leading-4 ${active ? 'text-gray-200' : 'text-gray-500'}`}>
                    {customer.email && <div className="break-all">{customer.email}</div>}
                    {customer.phone && <div>{customer.phone}</div>}
                  </div>
                )}
              </Link>
            )
          })}
      </div>
    </div>
  )
}
