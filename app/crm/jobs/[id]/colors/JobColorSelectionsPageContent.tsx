'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, RotateCcw, Save, Send } from 'lucide-react'
import { useParams } from 'next/navigation'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import type {
  JobColorSelectionsReadModel,
  JobColorSelectionSurface,
} from '@/types/job-operations/colorSelections'

type FormEntry = {
  color_catalog_id: string
  color_name: string
  sheen_id: string
  customer_notes: string
}

function selectionKey(surface: {
  scope_kind: JobColorSelectionSurface['scope_kind']
  scope_id: string | null
  surface_label: string | null
}) {
  return `${surface.scope_kind}:${surface.scope_id ?? surface.surface_label ?? 'unscoped'}`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load color selections.'
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? 'Request failed.')
  }
  return payload.data as T
}

function buildForm(model: JobColorSelectionsReadModel): Record<string, FormEntry> {
  const existing = new Map(model.selections.map((selection) => [selectionKey(selection), selection]))
  return Object.fromEntries(
    model.surfaces.map((surface) => {
      const selection = existing.get(surface.key)
      return [
        surface.key,
        {
          color_catalog_id: selection?.color_catalog_id ?? '',
          color_name: selection?.color_catalog_id ? '' : selection?.color_name ?? '',
          sheen_id: selection?.sheen_id ?? '',
          customer_notes: selection?.customer_notes ?? '',
        },
      ]
    })
  )
}

export function JobColorSelectionsPageContent() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const jobId = Array.isArray(rawId) ? rawId[0] : rawId
  const backHref = jobId ? `/crm/jobs/${jobId}` : '/crm/jobs'

  const [model, setModel] = useState<JobColorSelectionsReadModel | null>(null)
  const [form, setForm] = useState<Record<string, FormEntry>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!jobId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/jobs/${jobId}/color-selections`, { cache: 'no-store' })
      const data = await readJson<JobColorSelectionsReadModel>(response)
      setModel(data)
      setForm(buildForm(data))
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  const status = model?.selection_set?.status ?? 'draft'
  const isReadOnly = status === 'confirmed' || status === 'submitted'

  const updateField = useCallback((key: string, field: keyof FormEntry, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? { color_catalog_id: '', color_name: '', sheen_id: '', customer_notes: '' }),
        [field]: value,
      },
    }))
  }, [])

  const payloadSelections = useMemo(() => {
    if (!model) return []
    return model.surfaces.map((surface) => {
      const entry = form[surface.key] ?? {
        color_catalog_id: '',
        color_name: '',
        sheen_id: '',
        customer_notes: '',
      }
      return {
        room_id: surface.room_id,
        room_display_name: surface.room_display_name,
        scope_kind: surface.scope_kind,
        scope_id: surface.scope_id,
        scope_display_name: surface.scope_display_name,
        surface_label: surface.surface_label,
        paint_product_id: surface.paint_product_id,
        paint_product_display_name: surface.paint_product_display_name,
        quantity_label: surface.quantity_label,
        color_catalog_id: entry.color_catalog_id || null,
        color_name: entry.color_catalog_id ? null : entry.color_name || null,
        sheen_id: entry.sheen_id || null,
        customer_notes: entry.customer_notes || null,
      }
    })
  }, [form, model])

  const runMutation = useCallback(async (path: string, init: RequestInit, fallbackNotice: string) => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(path, init)
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? payload?.message ?? 'Request failed.')
      const data = payload.data as JobColorSelectionsReadModel
      setModel(data)
      setForm(buildForm(data))
      setNotice(payload.notice ?? fallbackNotice)
    } catch (mutationError) {
      setError(getErrorMessage(mutationError))
    } finally {
      setSaving(false)
    }
  }, [])

  const save = useCallback(() => {
    if (!jobId) return
    return runMutation(
      `/api/jobs/${jobId}/color-selections`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections: payloadSelections }),
      },
      'Color selections saved.'
    )
  }, [jobId, payloadSelections, runMutation])

  const submit = useCallback(() => {
    if (!jobId) return
    return runMutation(
      `/api/jobs/${jobId}/color-selections/submit`,
      { method: 'POST' },
      'Color selections submitted.'
    )
  }, [jobId, runMutation])

  const decide = useCallback((decision: 'confirmed' | 'needs_revision') => {
    if (!jobId) return
    return runMutation(
      `/api/jobs/${jobId}/color-selections/confirm`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: decision }),
      },
      decision === 'confirmed' ? 'Color selections confirmed.' : 'Color selections marked for revision.'
    )
  }, [jobId, runMutation])

  return (
    <CrmPageShell className="max-w-6xl">
      <CrmPageHeader
        eyebrow="Job operations"
        title="Color selections"
        description="Review customer room and surface colors from the accepted quote snapshot."
        backAction={
          <CrmButton href={backHref} tone="secondary">
            <span className="inline-flex items-center gap-1.5">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Back to job</span>
            </span>
          </CrmButton>
        }
        meta={model ? <CrmChip tone={model.completeness.complete ? 'success' : 'warning'}>{model.completeness.completed_count}/{model.completeness.required_count} complete</CrmChip> : null}
      />

      <CrmResourceState
        loading={loading}
        error={error}
        hasData={Boolean(model)}
        loadingTitle="Loading colors"
        loadingDescription="Loading accepted quote rooms and color selections..."
        errorTitle="Color selections unavailable"
        emptyTitle="No accepted quote"
        emptyDescription="This job needs an accepted quote snapshot before colors can be selected."
        onRetry={() => void load()}
      >
        {error ? <CrmNotice tone="error">{error}</CrmNotice> : null}
        {notice ? <CrmNotice tone="success">{notice}</CrmNotice> : null}

        {model ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{model.source.job.title ?? 'Accepted job'}</p>
                <p className="text-sm text-slate-600">{model.source.customer.name ?? 'Customer'} · {status}</p>
                {model.public_access.url_path ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Public link: <span className="font-mono">{model.public_access.url_path}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <CrmButton disabled={saving || isReadOnly} onClick={() => void save()}>
                  <span className="inline-flex items-center gap-1.5"><Save size={16} />Save</span>
                </CrmButton>
                <CrmButton disabled={saving || isReadOnly} tone="primary" onClick={() => void submit()}>
                  <span className="inline-flex items-center gap-1.5"><Send size={16} />Submit</span>
                </CrmButton>
                <CrmButton disabled={saving} tone="secondary" onClick={() => void decide('needs_revision')}>
                  <span className="inline-flex items-center gap-1.5"><RotateCcw size={16} />Needs revision</span>
                </CrmButton>
                <CrmButton disabled={saving || !model.completeness.complete} tone="primary" onClick={() => void decide('confirmed')}>
                  <span className="inline-flex items-center gap-1.5"><Check size={16} />Confirm</span>
                </CrmButton>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {model.surfaces.map((surface) => {
                const entry = form[surface.key] ?? { color_catalog_id: '', color_name: '', sheen_id: '', customer_notes: '' }
                return (
                  <div key={surface.key} className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{surface.surface_label}</p>
                      <p className="text-xs text-slate-500">{surface.paint_product_display_name ?? surface.scope_display_name ?? surface.scope_kind}</p>
                    </div>
                    <select
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                      value={entry.color_catalog_id}
                      disabled={saving || isReadOnly}
                      onChange={(event) => updateField(surface.key, 'color_catalog_id', event.target.value)}
                    >
                      <option value="">Manual color</option>
                      {model.catalog.colors.map((color) => (
                        <option key={color.id} value={color.id}>
                          {[color.color_number, color.color_name].filter(Boolean).join(' ')}
                        </option>
                      ))}
                    </select>
                    <input
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                      value={entry.color_name}
                      disabled={saving || isReadOnly || Boolean(entry.color_catalog_id)}
                      placeholder="Manual color"
                      onChange={(event) => updateField(surface.key, 'color_name', event.target.value)}
                    />
                    <select
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                      value={entry.sheen_id}
                      disabled={saving || isReadOnly}
                      onChange={(event) => updateField(surface.key, 'sheen_id', event.target.value)}
                    >
                      <option value="">Select sheen</option>
                      {model.catalog.sheens.map((sheen) => (
                        <option key={sheen.id} value={sheen.id}>{sheen.display_name}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </CrmResourceState>
    </CrmPageShell>
  )
}
