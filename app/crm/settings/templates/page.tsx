'use client'

import { useCallback } from 'react'
import { FileText, MessageSquareText, NotebookPen } from 'lucide-react'
import { QuoteSendDefaultsForm } from '@/app/crm/settings/_components/QuoteSendDefaultsForm'
import { SettingsNavTile } from '@/app/crm/settings/_components/SettingsNavTile'
import { SettingsNotice } from '@/app/crm/settings/_components/SettingsNotice'
import { SettingsPageShell } from '@/app/crm/settings/_components/SettingsPageShell'
import { loadSettingsData, saveSettingsData } from '@/app/crm/settings/_lib/api'
import { useSettingsResource } from '@/app/crm/settings/_lib/useSettingsResource'
import {
  emptyQuoteSendDefaults,
  getQuoteSendDefaultsValidationError,
} from '@/lib/settings/quoteSendDefaults'
import type { QuoteSendDefaults } from '@/lib/settings/types'

export default function TemplatesLibraryPage() {
  const load = useCallback(
    () =>
      loadSettingsData<QuoteSendDefaults>(
        '/api/settings/quote-send-defaults',
        'Failed to load quote send defaults.'
      ),
    []
  )
  const save = useCallback(
    (data: QuoteSendDefaults) =>
      saveSettingsData(
        '/api/settings/quote-send-defaults',
        data,
        'Failed to save quote send defaults.'
      ),
    []
  )

  const resource = useSettingsResource({
    initialData: emptyQuoteSendDefaults,
    load,
    save,
  })

  const validationError = getQuoteSendDefaultsValidationError(resource.data)
  const canSave = resource.hasLoaded && resource.dirty && !resource.saving && !validationError

  return (
    <SettingsPageShell
      eyebrow="Templates"
      title="Templates and Send Defaults"
      description="Keep reusable email templates separate from the quote send defaults that drive customer-facing quote documents."
      backHref="/crm/settings"
      backLabel="Back to settings"
    >
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Loading quote send defaults…</p>
        </div>
      ) : null}

      {!resource.loading && !resource.hasLoaded && resource.error ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SettingsNotice tone="error">{resource.error}</SettingsNotice>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void resource.reload()}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
            >
              Retry
            </button>
          </div>
        </div>
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
    </SettingsPageShell>
  )
}
