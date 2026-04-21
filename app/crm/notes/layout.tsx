'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardCheck, ListTodo, NotebookText } from 'lucide-react'
import { NotesComposerMount, NotesModuleHeaderActions } from './_components'

const tabs = [
  { href: '/crm/notes', label: 'Today', Icon: ClipboardCheck },
  { href: '/crm/notes/tasks', label: 'Tasks', Icon: ListTodo },
  { href: '/crm/notes/notes', label: 'Notes', Icon: NotebookText },
]

export default function NotesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 pb-16">
      <section className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">Notes Module</div>
            <h1 className="mt-2 text-3xl font-extrabold text-white">Notes</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-400">
              Separate task and note workflows with a faster daily dashboard, denser lists, and less clutter.
            </p>
          </div>
          <NotesModuleHeaderActions />
        </div>
      </section>

      <nav className="grid grid-cols-3 gap-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/crm/notes' && pathname?.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                active
                  ? 'border-emerald-400/60 bg-emerald-400 text-neutral-950'
                  : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900'
              }`}
            >
              <tab.Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      <div>{children}</div>
      <NotesComposerMount />
    </div>
  )
}
