'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  DEFAULT_LABOR_RATE,
} from '@/lib/estimator/defaults'

type ProductRow = {
  id: string
  name: string
  family?: string | null
}

type TemplateSettingsRow = {
  walls_paint_id: string | null
  walls_primer_id: string | null
  ceiling_paint_id: string | null
  ceiling_primer_id: string | null
  trim_paint_id: string | null
  trim_primer_id: string | null
  override_labor_rate: number
}

type ProductDefaultField =
  | 'walls_paint_id'
  | 'walls_primer_id'
  | 'ceiling_paint_id'
  | 'ceiling_primer_id'
  | 'trim_paint_id'
  | 'trim_primer_id'

type ProductDefaultConfig = {
  label: string
  key: ProductDefaultField
  options: ProductRow[]
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--v2-bg)',
    color: 'var(--v2-ink)',
  },
  wrap: {
    maxWidth: 980,
    margin: '0 auto',
    padding: '24px 20px 48px',
    display: 'grid',
    gap: 18,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 16,
    borderBottom: '1px solid var(--v2-line)',
  },
  crumb: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--v2-ink-3)',
  },
  title: {
    fontSize: 28,
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    margin: '8px 0 0',
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--v2-ink-2)',
    maxWidth: 700,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--v2-line)',
    textDecoration: 'none',
    color: 'var(--v2-ink)',
    fontWeight: 700,
  } as CSSProperties,
  card: {
    borderRadius: 16,
    border: '1px solid var(--v2-line)',
    background: 'var(--v2-bg-2)',
    padding: 18,
    display: 'grid',
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  sectionSub: {
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--v2-ink-3)',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  label: {
    display: 'grid',
    gap: 6,
  } as CSSProperties,
  labelText: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--v2-ink-3)',
  } as CSSProperties,
  input: {
    width: '100%',
    minHeight: 40,
    padding: '9px 10px',
    borderRadius: 10,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 14,
    boxSizing: 'border-box' as const,
  } as CSSProperties,
  status: {
    fontSize: 13,
    fontWeight: 700,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  saveBtn: {
    padding: '11px 16px',
    borderRadius: 10,
    border: '1px solid rgba(134,239,172,0.34)',
    background: '#8ad39b',
    color: '#062410',
    fontWeight: 800,
    cursor: 'pointer',
  } as CSSProperties,
} as const

export default function EstimateDefaultsPage() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [settings, setSettings] = useState<TemplateSettingsRow | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<TemplateSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [productsRes, settingsRes] = await Promise.all([
          authedFetch('/api/quotes/products', { cache: 'no-store' }),
          authedFetch('/api/settings/estimate-defaults', { cache: 'no-store' }),
        ])
        const [productsPayload, settingsPayload] = await Promise.all([
          productsRes.json().catch(() => null),
          settingsRes.json().catch(() => null),
        ])
        if (!productsRes.ok) {
          throw new Error(productsPayload?.error ?? 'Failed to load products')
        }
        if (!settingsRes.ok) {
          throw new Error(settingsPayload?.error ?? 'Failed to load defaults')
        }
        if (!active) return
        setProducts(productsPayload?.products ?? [])
        const next = settingsPayload?.data ?? {}
        const normalized = {
          walls_paint_id: next.walls_paint_id ?? null,
          walls_primer_id: next.walls_primer_id ?? null,
          ceiling_paint_id: next.ceiling_paint_id ?? null,
          ceiling_primer_id: next.ceiling_primer_id ?? null,
          trim_paint_id: next.trim_paint_id ?? null,
          trim_primer_id: next.trim_primer_id ?? null,
          override_labor_rate: Number(next.override_labor_rate ?? DEFAULT_LABOR_RATE),
        }
        setSettings(normalized)
        setSavedSnapshot(normalized)
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load defaults')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const paintProducts = useMemo(
    () => products.filter((product) => (product.family ?? '').toLowerCase() === 'paint'),
    [products]
  )
  const primerProducts = useMemo(
    () => products.filter((product) => (product.family ?? '').toLowerCase() === 'primer'),
    [products]
  )
  const productDefaultFields = useMemo<ProductDefaultConfig[]>(
    () => [
      { label: 'Walls default paint', key: 'walls_paint_id', options: paintProducts },
      { label: 'Walls default primer', key: 'walls_primer_id', options: primerProducts },
      { label: 'Ceilings default paint', key: 'ceiling_paint_id', options: paintProducts },
      { label: 'Ceilings default primer', key: 'ceiling_primer_id', options: primerProducts },
      { label: 'Trim default paint', key: 'trim_paint_id', options: paintProducts },
      { label: 'Trim default primer', key: 'trim_primer_id', options: primerProducts },
    ],
    [paintProducts, primerProducts]
  )
  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSnapshot),
    [savedSnapshot, settings]
  )

  const save = async () => {
    if (!settings) return
    try {
      setSaving(true)
      setError(null)
      setSaved(null)
      const res = await authedFetch('/api/settings/estimate-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: settings }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Failed to save defaults')
      }
      setSettings(payload?.data ?? settings)
      setSavedSnapshot(payload?.data ?? settings)
      setSaved('Saved')
      window.setTimeout(() => setSaved(null), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save defaults')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ace-v2-shell" style={S.page}>
      <div style={S.wrap}>
        <header style={S.header}>
          <div>
            <div style={S.crumb}>Quotes / Defaults</div>
            <h1 style={S.title}>Quote Defaults</h1>
            <div style={S.sub}>
              Org-level defaults for new quotes. Quote validity and terms stay on the
              send settings page.
            </div>
          </div>
          <Link href="/crm/quotes" style={S.backLink}>
            {'<- Quotes'}
          </Link>
        </header>

        <section style={S.card}>
          <div style={S.sectionTitle}>Paint & Primer</div>
          <div style={S.sectionSub}>Shared starter selections for new quote job settings.</div>
          <div style={S.grid2}>
            {productDefaultFields.map(({ label, key, options }) => (
              <label key={key} style={S.label}>
                <span style={S.labelText}>{label}</span>
                <select
                  style={S.input}
                  value={settings?.[key] ?? ''}
                  onChange={(event) =>
                    setSettings((prev) =>
                      prev ? { ...prev, [key]: event.target.value || null } : prev
                    )
                  }
                  disabled={loading || saving || !settings}
                >
                  <option value="">-- none --</option>
                  {(options as ProductRow[]).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section style={S.card}>
          <div style={S.sectionTitle}>Labor Rate</div>
          <div style={S.sectionSub}>
            Org-level labor rate used when a specific quote has not saved its own override.
          </div>
          <div style={{ maxWidth: 240 }}>
            <label style={S.label}>
              <span style={S.labelText}>Labor rate / hr</span>
              <input
                style={S.input}
                type="number"
                min={0}
                step={1}
                value={settings?.override_labor_rate ?? DEFAULT_LABOR_RATE}
                onChange={(event) =>
                  setSettings((prev) =>
                    prev
                      ? { ...prev, override_labor_rate: Number(event.target.value) }
                      : prev
                  )
                }
              />
            </label>
          </div>
        </section>

        <div style={S.footer}>
          <div style={S.status}>
            {loading && <span style={{ color: 'var(--v2-ink-3)' }}>Loading...</span>}
            {!loading && error && <span style={{ color: '#ff6b6b' }}>{error}</span>}
            {!loading && !error && saved && <span style={{ color: 'var(--v2-green-2)' }}>{saved}</span>}
          </div>
          <button type="button" style={S.saveBtn} onClick={() => void save()} disabled={loading || saving || !settings || !dirty}>
            {saving ? 'Saving...' : 'Save Defaults'}
          </button>
        </div>

        <style jsx>{`
          @media (max-width: 720px) {
            .ace-v2-shell :global(*) {
              box-sizing: border-box;
            }
          }
          @media (max-width: 760px) {
            .ace-v2-shell [style*='grid-template-columns: repeat(2, minmax(0, 1fr))'] {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
