'use client'

import { CalendarCheck, ShieldCheck } from 'lucide-react'
import { SettingsNavTile } from '@/app/crm/settings/_components/SettingsNavTile'
import { SettingsPageShell } from '@/app/crm/settings/_components/SettingsPageShell'

export default function IntegrationsSettingsPage() {
  return (
    <SettingsPageShell
      eyebrow="Integrations"
      title="Integrations"
      description="Provider-specific connection setup stays separate from persisted CRM settings forms."
      backHref="/crm/settings"
      backLabel="Back to settings"
    >
      <section className="grid gap-3 md:grid-cols-2">
        <SettingsNavTile
          href="/crm/calendar"
          title="Google Calendar"
          description="Connect or disconnect calendars and manage sync behavior."
          Icon={CalendarCheck}
        />
        <SettingsNavTile
          href="/env-check"
          title="Environment health"
          description="Validate environment keys and setup status outside the CRM settings data model."
          Icon={ShieldCheck}
        />
      </section>
    </SettingsPageShell>
  )
}
