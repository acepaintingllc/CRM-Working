'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import { loadJobEstimateDate, saveJobEstimateDate } from '@/lib/jobs/client'
import {
  next8amLocalDateTimeValue,
  toIsoFromLocalDateTimeValue,
  toLocalDateTimeInputValue,
} from '@/lib/jobs/dateHelpers'

export default function JobEstimatePage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()

  const [estimateLocal, setEstimateLocal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    const load = async () => {
      try {
        const existing = await loadJobEstimateDate(id)
        if (existing) {
          setEstimateLocal(toLocalDateTimeInputValue(new Date(existing)))
        } else {
          setEstimateLocal(next8amLocalDateTimeValue())
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load job.')
      }
    }
    void load()
  }, [id])

  const save = async () => {
    if (!id || typeof id !== 'string') return
    if (!estimateLocal) {
      setError('Pick a date/time')
      return
    }
    const iso = toIsoFromLocalDateTimeValue(estimateLocal)
    if (!iso) {
      setError('Pick a valid date/time')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveJobEstimateDate(id, iso)
      router.push(`/crm/jobs/${id}`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save quote date.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmPageShell className="max-w-[700px]">
      <CrmPageHeader
        eyebrow="Pipeline workflow"
        emoji="🕒"
        title="Set quote date"
        description="Pick the quote time for this job using the shared CRM page shell."
        backHref={`/crm/jobs/${id}`}
        backLabel="Back to job"
      />

      <CrmSectionCard title="Quote schedule">
        <div className="grid gap-3">
          <CrmField label="Quote date/time">
            <input
              type="datetime-local"
              value={estimateLocal}
              onChange={(event) => setEstimateLocal(event.target.value)}
              className={crmInputClassName('text-sm')}
            />
          </CrmField>

          {error ? <CrmNotice tone="error" compact>{error}</CrmNotice> : null}

          <CrmButton type="button" onClick={() => void save()} disabled={saving} tone="primary">
            {saving ? 'Saving...' : 'Save quote date'}
          </CrmButton>
        </div>
      </CrmSectionCard>
    </CrmPageShell>
  )
}
