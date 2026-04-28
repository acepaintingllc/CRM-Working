'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardCheck, ListTodo, NotebookText } from 'lucide-react'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { NotesComposerMount, NotesModuleHeaderActions } from './_components'

const tabs = [
  { href: '/crm/notes', label: 'Today', Icon: ClipboardCheck },
  { href: '/crm/notes/tasks', label: 'Tasks', Icon: ListTodo },
  { href: '/crm/notes/notes', label: 'Notes', Icon: NotebookText },
]

export default function NotesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <CrmPageShell className="max-w-6xl pb-16">
      <CrmPageHeader
        eyebrow="Notes Module"
        title="Notes"
        description="Separate task and note workflows with a faster daily dashboard, denser lists, and less clutter."
        actions={<NotesModuleHeaderActions />}
      />

      <nav className="grid grid-cols-3 gap-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/crm/notes' && pathname?.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold no-underline transition ${
                active
                  ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)] text-[color:var(--crm-ui-accent)]'
                  : 'ace-crm-surface text-[color:var(--crm-ui-muted)] hover:border-[color:var(--crm-ui-accent-border)] hover:text-[color:var(--crm-ui-text)]'
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
    </CrmPageShell>
  )
}
