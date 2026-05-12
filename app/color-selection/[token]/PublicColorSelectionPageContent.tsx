'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import type {
  JobColorSelectionsReadModel,
  JobColorSelectionSurface,
} from '@/types/job-operations/colorSelections'

type FormEntry = {
  color_catalog_id: string
  color_name: string
  sheen_id: string
}

function surfaceKey(surface: {
  scope_kind: JobColorSelectionSurface['scope_kind']
  scope_id: string | null
  surface_label: string | null
}) {
  return `${surface.scope_kind}:${surface.scope_id ?? surface.surface_label ?? 'unscoped'}`
}

async function readPayload(response: Response) {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? 'Request failed.')
  }
  return payload
}

function buildForm(model: JobColorSelectionsReadModel): Record<string, FormEntry> {
  const existing = new Map(model.selections.map((selection) => [surfaceKey(selection), selection]))
  return Object.fromEntries(
    model.surfaces.map((surface) => {
      const selection = existing.get(surface.key)
      return [
        surface.key,
        {
          color_catalog_id: selection?.color_catalog_id ?? '',
          color_name: selection?.color_catalog_id ? '' : selection?.color_name ?? '',
          sheen_id: selection?.sheen_id ?? '',
        },
      ]
    })
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load color selections.'
}

export function PublicColorSelectionPageContent() {
  const params = useParams()
  const rawToken = (params as { token?: string } | null | undefined)?.token
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken

  const [model, setModel] = useState<JobColorSelectionsReadModel | null>(null)
  const [form, setForm] = useState<Record<string, FormEntry>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/color-selections-public/${token}`, { cache: 'no-store' })
      const payload = await readPayload(response)
      const data = payload.data as JobColorSelectionsReadModel
      setModel(data)
      setForm(buildForm(data))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const isReadOnly = model?.selection_set?.status === 'submitted' || model?.selection_set?.status === 'confirmed'

  const updateField = useCallback((key: string, field: keyof FormEntry, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? { color_catalog_id: '', color_name: '', sheen_id: '' }),
        [field]: value,
      },
    }))
  }, [])

  const payloadSelections = useMemo(() => {
    if (!model) return []
    return model.surfaces.map((surface) => {
      const entry = form[surface.key] ?? { color_catalog_id: '', color_name: '', sheen_id: '' }
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
      }
    })
  }, [form, model])

  const mutate = useCallback(async (path: string, init: RequestInit) => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(path, init)
      const payload = await readPayload(response)
      const data = payload.data as JobColorSelectionsReadModel
      setModel(data)
      setForm(buildForm(data))
      setNotice(payload.notice ?? 'Saved.')
    } catch (mutationError) {
      setError(errorMessage(mutationError))
    } finally {
      setSaving(false)
    }
  }, [])

  const save = useCallback(() => {
    if (!token) return
    return mutate(`/api/color-selections-public/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections: payloadSelections }),
    })
  }, [mutate, payloadSelections, token])

  const submit = useCallback(() => {
    if (!token) return
    return mutate(`/api/color-selections-public/${token}/submit`, { method: 'POST' })
  }, [mutate, token])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Color selections</p>
          <h1 className="text-3xl font-semibold">{model?.source.job.title ?? 'Choose paint colors'}</h1>
          <p className="text-sm text-slate-600">{model?.source.customer.name ?? ''}</p>
        </header>

        {loading ? <div className="rounded-lg border border-slate-200 bg-white p-4">Loading colors...</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div> : null}

        {model ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{model.completeness.completed_count} of {model.completeness.required_count} required selections complete</p>
                  <p className="text-sm text-slate-500">Status: {model.selection_set?.status ?? 'draft'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving || isReadOnly}
                    onClick={() => void save()}
                    className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={saving || isReadOnly}
                    onClick={() => void submit()}
                    className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {model.surfaces.map((surface) => {
                const entry = form[surface.key] ?? { color_catalog_id: '', color_name: '', sheen_id: '' }
                return (
                  <div key={surface.key} className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 md:grid-cols-[1fr_1fr_1fr]">
                    <div>
                      <p className="text-sm font-semibold">{surface.surface_label}</p>
                      <p className="text-xs text-slate-500">{surface.paint_product_display_name ?? surface.scope_display_name}</p>
                    </div>
                    <div className="grid gap-2">
                      <select
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                        value={entry.color_catalog_id}
                        disabled={saving || isReadOnly}
                        onChange={(event) => updateField(surface.key, 'color_catalog_id', event.target.value)}
                      >
                        <option value="">Manual color</option>
                        {model.catalog.colors.map((color) => (
                          <option key={color.id} value={color.id}>{[color.color_number, color.color_name].filter(Boolean).join(' ')}</option>
                        ))}
                      </select>
                      <input
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                        value={entry.color_name}
                        disabled={saving || isReadOnly || Boolean(entry.color_catalog_id)}
                        placeholder="Manual color"
                        onChange={(event) => updateField(surface.key, 'color_name', event.target.value)}
                      />
                    </div>
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
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}
