'use client'

import { Building2, FileStack, Link2, Settings as SettingsIcon } from 'lucide-react'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
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

      <CrmSectionCard>
        <div className="ace-crm-mono inline-flex items-center gap-2 text-[11px] font-bold text-[color:var(--crm-ui-muted)]">
          <SettingsIcon size={16} aria-hidden="true" />
          Growth pattern
        </div>
        <p className="mt-2 text-sm text-[color:var(--crm-ui-muted)]">
          Add new settings by creating a typed domain contract, a behavior-specific route, and a page built on the shared settings resource hook and primitives.
        </p>
      </CrmSectionCard>
    </SettingsPageShell>
  )
}
