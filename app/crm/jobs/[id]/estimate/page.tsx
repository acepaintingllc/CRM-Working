'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { loadJobEstimateDate, saveJobEstimateDate } from '@/lib/jobs/client'
import {
  next8amLocalDateTimeValue,
  toIsoFromLocalDateTimeValue,
  toLocalDateTimeInputValue,
} from '@/lib/jobs/dateHelpers'
import {
  jobsButtonAccentClassName,
  jobsButtonSecondaryClassName,
  jobsCardClassName,
  jobsInputClassName,
  jobsLabelClassName,
  jobsPageShellClassName,
} from '@/lib/jobs/uiClasses'

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
    <div className={`${jobsPageShellClassName} max-w-[700px]`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[20px] font-extrabold">Set quote date</div>
          <div className="text-xs text-[var(--crm-muted)]">Pick the quote time for this job.</div>
        </div>
        <Link href={`/crm/jobs/${id}`} className={`${jobsButtonSecondaryClassName} no-underline`}>
          Back to job
        </Link>
      </div>

      <div className={jobsCardClassName}>
        <div className="grid gap-2.5">
          <div>
            <div className={jobsLabelClassName}>Quote date/time</div>
            <input
              type="datetime-local"
              value={estimateLocal}
              onChange={(event) => setEstimateLocal(event.target.value)}
              className={jobsInputClassName}
            />
          </div>

          {error && <div className="text-sm text-red-700">{error}</div>}

          <button
            onClick={() => void save()}
            disabled={saving}
            className={jobsButtonAccentClassName}
          >
            {saving ? 'Saving...' : 'Save quote date'}
          </button>
        </div>
      </div>
    </div>
  )
}
