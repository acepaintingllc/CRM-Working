'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardCheck, ListTodo, NotebookText, PlusCircle } from 'lucide-react'

const tabs = [
  { href: '/crm/notes', label: 'Today', Icon: ClipboardCheck },
  { href: '/crm/notes/tasks', label: 'Tasks', Icon: ListTodo },
  { href: '/crm/notes/notes', label: 'Notes', Icon: NotebookText },
  { href: '/crm/notes/quick-add', label: 'Quick Add', Icon: PlusCircle },
]

export default function NotesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-extrabold uppercase tracking-wide text-[var(--crm-muted)]">Notes Module</div>
        <h1 className="mt-1 text-2xl font-extrabold text-[var(--crm-text)]">Notes</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-soft)]">
          Personal tasks, reminders, and backlog notes in one mobile-first workflow.
        </p>
      </section>

      <nav className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/crm/notes' && pathname?.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                active
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 bg-white text-[var(--crm-text)] hover:bg-gray-50'
              }`}
            >
              <tab.Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      <div>{children}</div>
    </div>
  )
}
