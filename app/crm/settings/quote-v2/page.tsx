'use client'

import { useCallback } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { QuoteSendDefaultsForm } from '@/app/crm/settings/_components/QuoteSendDefaultsForm'
import { loadData, saveData } from '@/lib/client/api'
import {
  emptyQuoteSendDefaults,
  getQuoteSendDefaultsValidationError,
} from '@/lib/settings/quoteSendDefaults'
import type { QuoteSendDefaults } from '@/lib/settings/types'

export default function QuoteV2SettingsPage() {
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
        eyebrow="Quote V2"
        title="Quote V2 Settings"
        description="Configure quote send presets, customer-facing terms sections, and V2 document defaults."
        backHref="/crm/settings"
        backLabel="Back to settings"
      />

      {resource.loading && !resource.hasLoaded ? (
        <CrmSectionCard title="Loading quote V2 settings">
          <p className="text-sm text-[color:var(--crm-ui-muted)]">Loading quote V2 settings...</p>
        </CrmSectionCard>
      ) : null}

      {!resource.loading && !resource.hasLoaded && resource.error ? (
        <CrmSectionCard title="Quote V2 settings unavailable">
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
