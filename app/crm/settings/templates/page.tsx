'use client'

import { useCallback } from 'react'
import { FileText, MessageSquareText, NotebookPen } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { QuoteSendDefaultsForm } from '@/app/crm/settings/_components/QuoteSendDefaultsForm'
import { SettingsNavTile } from '@/app/crm/settings/_components/SettingsNavTile'
import { loadData, saveData } from '@/lib/client/api'
import {
  emptyQuoteSendDefaults,
  getQuoteSendDefaultsValidationError,
} from '@/lib/settings/quoteSendDefaults'
import type { QuoteSendDefaults } from '@/lib/settings/types'

export default function TemplatesLibraryPage() {
  const load = useCallback(
    () => loadData<QuoteSendDefaults>('/api/settings/quote-send-defaults', { cache: 'no-store' }),
    []
  )
  const save = useCallback(
    (data: QuoteSendDefaults) => saveData('/api/settings/quote-send-defaults', data),
    []
  )

  const resource = useEditableResource({
    initialData: emptyQuoteSendDefaults,
    load,
    save,
  })

  const validationError = getQuoteSendDefaultsValidationError(resource.data)
  const canSave = resource.hasLoaded && resource.dirty && !resource.saving && !validationError

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

      {resource.loading && !resource.hasLoaded ? (
        <CrmSectionCard title="Loading quote send defaults">
          <p className="text-sm text-[color:var(--crm-ui-muted)]">Loading quote send defaults...</p>
        </CrmSectionCard>
      ) : null}

      {!resource.loading && !resource.hasLoaded && resource.error ? (
        <CrmSectionCard title="Quote send defaults unavailable">
          <CrmNotice tone="error">{resource.error}</CrmNotice>
          <div className="mt-4">
            <CrmButton type="button" onClick={() => void resource.reload()}>
              Retry
            </CrmButton>
          </div>
        </CrmSectionCard>
      ) : null}

      {resource.hasLoaded ? (
        <QuoteSendDefaultsForm
          value={resource.data}
          onChange={(patch) => resource.setData((current) => ({ ...current, ...patch }))}
          onSave={() => void resource.saveChanges()}
          canSave={canSave}
          saving={resource.saving}
          error={resource.error}
          notice={resource.notice}
          validationError={resource.dirty ? validationError : null}
        />
      ) : null}
    </CrmPageShell>
  )
}
