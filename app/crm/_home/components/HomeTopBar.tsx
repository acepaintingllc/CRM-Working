import Link from 'next/link'
import { Search } from 'lucide-react'
import type { CrmHomeSearchResults } from '@/lib/crm/home/types'

type HomeTopBarProps = {
  todayLabel: string
  greeting: string
  search: string
  onSearchChange: (value: string) => void
  searchResults: CrmHomeSearchResults
}

export function HomeTopBar({
  todayLabel,
  greeting,
  search,
  onSearchChange,
  searchResults,
}: HomeTopBarProps) {
  return (
    <div
      className="crm-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
    >
      <div>
        <div
          className="text-[11px] font-extrabold uppercase tracking-widest"
          style={{ color: 'var(--crm-muted)' }}
        >
          {todayLabel}
        </div>
        <h1 className="mt-0.5 text-xl font-extrabold md:text-2xl" style={{ color: 'var(--crm-text)' }}>
          {greeting}, Austin
        </h1>
      </div>

      <div className="relative w-full sm:w-72">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--crm-muted)' }}
          aria-hidden="true"
        />
        <input
          aria-label="Search customers or jobs"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search customers or jobs..."
          className="w-full rounded-xl border py-2.5 pl-8 pr-3 text-sm outline-none transition"
          style={{
            background: 'var(--crm-input)',
            borderColor: 'var(--crm-border)',
            color: 'var(--crm-text)',
          }}
        />
        {search.trim() !== '' && (
          <div
            className="absolute left-0 right-0 top-full z-20 mt-1.5 grid gap-2 rounded-xl border p-3 shadow-xl"
            style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
          >
            {searchResults.customers.length > 0 && (
              <div>
                <div
                  className="mb-1 text-[10px] font-extrabold uppercase tracking-widest"
                  style={{ color: 'var(--crm-muted)' }}
                >
                  Customers
                </div>
                {searchResults.customers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/crm/customers/${customer.id}`}
                    className="block rounded-lg px-2.5 py-2 text-sm transition"
                    style={{ color: 'var(--crm-text)' }}
                  >
                    <div className="font-semibold">{customer.name}</div>
                    {(customer.email || customer.phone) && (
                      <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                        {[customer.email, customer.phone].filter(Boolean).join(' \u2022 ')}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {searchResults.jobs.length > 0 && (
              <div>
                <div
                  className="mb-1 text-[10px] font-extrabold uppercase tracking-widest"
                  style={{ color: 'var(--crm-muted)' }}
                >
                  Jobs
                </div>
                {searchResults.jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/crm/jobs/${job.id}`}
                    className="block rounded-lg px-2.5 py-2 text-sm transition"
                    style={{ color: 'var(--crm-text)' }}
                  >
                    <div className="font-semibold">{job.title ?? 'Untitled job'}</div>
                    {job.customer_name && (
                      <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                        {job.customer_name}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {searchResults.customers.length === 0 && searchResults.jobs.length === 0 && (
              <div className="text-sm" style={{ color: 'var(--crm-muted)' }}>
                No results.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
