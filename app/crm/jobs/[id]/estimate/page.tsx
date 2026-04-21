'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { getResponseErrorMessage, parseResponseBody } from '@/lib/jobs/actions'
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
      const res = await authedFetch(`/api/jobs/${id}`, { cache: 'no-store' })
      const payload = await parseResponseBody(res)
      if (!res.ok) {
        setError(getResponseErrorMessage(res, payload))
        return
      }
      const existing = (payload.json as { job?: { estimate_date?: string | null } } | null)?.job
        ?.estimate_date
      if (existing) {
        setEstimateLocal(toLocalDateTimeInputValue(new Date(existing)))
      } else {
        setEstimateLocal(next8amLocalDateTimeValue())
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
    const res = await authedFetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimate_date: iso, status: 'estimate_scheduled' }),
    })
    const payload = await parseResponseBody(res)
    setSaving(false)
    if (!res.ok) {
      setError(getResponseErrorMessage(res, payload))
      return
    }
    router.push(`/crm/jobs/${id}`)
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
