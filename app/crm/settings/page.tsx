'use client'

import { Building2, FileStack, Link2, Settings as SettingsIcon } from 'lucide-react'
import { SettingsNavTile } from './_components/SettingsNavTile'
import { SettingsPageShell } from './_components/SettingsPageShell'

export default function SettingsPage() {
  return (
    <SettingsPageShell
      eyebrow="Settings"
      title="CRM Settings"
      description="Manage company identity, quote send defaults, and integrations from one organized settings area."
    >
      <section className="grid gap-3 md:grid-cols-3">
        <SettingsNavTile
          href="/crm/settings/company"
          title="Company profile"
          description="Business details and sender defaults used in customer-facing flows."
          Icon={Building2}
        />
        <SettingsNavTile
          href="/crm/settings/integrations"
          title="Integrations"
          description="Connection health and provider setup entry points."
          Icon={Link2}
        />
        <SettingsNavTile
          href="/crm/settings/templates"
          title="Templates and send defaults"
          description="Email template access plus dedicated quote send defaults."
          Icon={FileStack}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
          <SettingsIcon size={16} aria-hidden="true" />
          Growth pattern
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Add new settings by creating a typed domain contract, a behavior-specific route, and a page built on the shared settings resource hook and primitives.
        </p>
      </section>
    </SettingsPageShell>
  )
}
