import Link from 'next/link'
import { CalendarCheck, Plus, Users, Wrench } from 'lucide-react'

export function QuickActionsCard() {
  return (
    <div
      className="crm-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
    >
      <div className="flex items-center gap-1.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
        <Plus size={15} aria-hidden="true" />
        Quick actions
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link
          href="/crm/customers/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-extrabold transition-transform hover:scale-[1.02] sm:justify-start sm:py-2"
          style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
        >
          <Users size={13} aria-hidden="true" />
          New customer
        </Link>
        <Link
          href="/crm/jobs/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-extrabold transition-transform hover:scale-[1.02] sm:justify-start sm:py-2"
          style={{ background: 'var(--crm-accent)', color: 'var(--crm-accent-text)' }}
        >
          <Wrench size={13} aria-hidden="true" />
          New job
        </Link>
        <Link
          href="/crm/calendar"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:justify-start sm:py-2"
          style={{
            borderColor: 'var(--crm-border)',
            background: 'var(--crm-button)',
            color: 'var(--crm-button-text)',
          }}
        >
          <CalendarCheck size={13} aria-hidden="true" />
          Calendar
        </Link>
        <Link
          href="/crm/customers"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:justify-start sm:py-2"
          style={{
            borderColor: 'var(--crm-border)',
            background: 'var(--crm-button)',
            color: 'var(--crm-button-text)',
          }}
        >
          <Users size={13} aria-hidden="true" />
          Customers
        </Link>
      </div>
    </div>
  )
}
