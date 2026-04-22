'use client'

import { useCallback } from 'react'
import { Building2 } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
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
        <CrmChip tone="accent" className="px-3 py-2 text-xs font-semibold">
          <Building2 size={14} aria-hidden="true" />
          <span>Canonical company profile settings</span>
        </CrmChip>
      }
    >
      {resource.loading && !resource.hasLoaded ? (
        <CrmSectionCard title="Loading company profile">
          <p className="text-sm text-[color:var(--crm-ui-muted)]">Loading company profile...</p>
        </CrmSectionCard>
      ) : null}

      {!resource.loading && !resource.hasLoaded && resource.error ? (
        <CrmSectionCard title="Company profile unavailable">
          <SettingsNotice tone="error">{resource.error}</SettingsNotice>
          <div className="mt-4">
            <CrmButton type="button" onClick={() => void resource.reload()}>
              Retry
            </CrmButton>
          </div>
        </CrmSectionCard>
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
