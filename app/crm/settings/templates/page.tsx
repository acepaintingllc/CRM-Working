'use client'

import { FileText, MessageSquareText, NotebookPen } from 'lucide-react'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { SettingsNavTile } from '@/app/crm/settings/_components/SettingsNavTile'

export default function TemplatesLibraryPage() {
  return (
    <CrmPageShell className="max-w-5xl">
      <CrmPageHeader
        eyebrow="Templates"
        emoji="⚙️"
        title="Templates and Send Defaults"
        description="Keep reusable email templates separate from the quote send defaults that drive customer-facing quote documents."
        backHref="/crm/settings"
        backLabel="Back to settings"
      />
      <section className="grid gap-3 md:grid-cols-3">
        <SettingsNavTile
          href="/crm/email-templates"
          title="Email templates"
          description="Edit stage-based email templates and merge variables."
          Icon={FileText}
        />
        <SettingsNavTile
          title="SMS templates"
          description="Reserved for future follow-up templates without mixing them into quote send defaults."
          Icon={MessageSquareText}
          planned
        />
        <SettingsNavTile
          title="Internal note templates"
          description="Reserved for team workflow templates and checklists."
          Icon={NotebookPen}
          planned
        />
      </section>
    </CrmPageShell>
  )
}
