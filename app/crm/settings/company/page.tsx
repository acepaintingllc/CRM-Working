'use client'

import { useCallback } from 'react'
import { Building2 } from 'lucide-react'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { CompanyProfileForm } from '@/app/crm/settings/_components/CompanyProfileForm'
import { SettingsNotice } from '@/app/crm/settings/_components/SettingsNotice'
import { SettingsPageShell } from '@/app/crm/settings/_components/SettingsPageShell'
import { loadData, saveData } from '@/lib/client/api'
import {
  emptyCompanyProfileSettings,
  getCompanyProfileValidationError,
} from '@/lib/settings/companyProfile'
import type { CompanyProfileSettings } from '@/lib/settings/types'

export default function CompanyProfilePage() {
  const load = useCallback(
    () => loadData<CompanyProfileSettings>('/api/settings/company', { cache: 'no-store' }),
    []
  )
  const save = useCallback(
    (data: CompanyProfileSettings) => saveData('/api/settings/company', data),
    []
  )

  const resource = useEditableResource({
    initialData: emptyCompanyProfileSettings,
    load,
    save,
  })

  const validationError = getCompanyProfileValidationError(resource.data)
  const canSave = resource.hasLoaded && resource.dirty && !resource.saving && !validationError

  return (
    <SettingsPageShell
      eyebrow="Company profile"
      title="Company Profile"
      description="Set the company identity and sender defaults used across customer-facing CRM workflows."
      backHref="/crm/settings"
      backLabel="Back to settings"
      actions={
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          <Building2 size={14} aria-hidden="true" />
          <span>Canonical company profile settings</span>
        </div>
      }
    >
      {resource.loading && !resource.hasLoaded ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Loading company profile…</p>
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
        <CompanyProfileForm
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
