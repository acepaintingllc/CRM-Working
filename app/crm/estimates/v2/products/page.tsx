'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'

type ProductStatus = 'Active' | 'Inactive' | 'Archived'
type ProductFamily = 'Paint' | 'Primer'

type ProductRow = {
  id: string
  name: string
  family?: string | null
  base?: string | null
  subtype?: string | null
  cost_per_unit?: number | null
  coverage_sqft_per_gal_per_coat?: number | null
  efficiency_pct?: number | null
  default_coats?: number | null
  default_sheen?: string | null
  default_scopes?: string[] | null
  notes?: string | null
  status: ProductStatus
  created_at: string
  updated_at: string
}

const MOCK_PRODUCTS: ProductRow[] = [
  {
    id: 'p1',
    name: 'Scuff-X',
    family: 'Paint',
    base: 'Waterborne',
    subtype: 'Eggshell',
    cost_per_unit: 68.5,
    coverage_sqft_per_gal_per_coat: 350,
    efficiency_pct: 85,
    default_coats: 2,
    default_sheen: 'Eggshell',
    default_scopes: ['Walls', 'Trim'],
    notes: 'Primary production wall paint.',
    status: 'Active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p2',
    name: 'Aura Interior',
    family: 'Paint',
    base: 'Waterborne',
    subtype: 'Satin',
    cost_per_unit: 79.99,
    coverage_sqft_per_gal_per_coat: 350,
    efficiency_pct: 82,
    default_coats: 2,
    default_sheen: 'Satin',
    default_scopes: ['Walls'],
    notes: 'Premium option for occupied homes.',
    status: 'Active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p3',
    name: 'Regal Select',
    family: 'Paint',
    base: 'Waterborne',
    subtype: 'Flat',
    cost_per_unit: 55.2,
    coverage_sqft_per_gal_per_coat: 380,
    efficiency_pct: 87,
    default_coats: 2,
    default_sheen: 'Flat',
    default_scopes: ['Ceilings', 'Walls'],
    notes: 'Good for low-luster large areas.',
    status: 'Active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p4',
    name: 'ProBlock',
    family: 'Primer',
    base: 'Oil-Based',
    subtype: 'Stain Block',
    cost_per_unit: 42,
    coverage_sqft_per_gal_per_coat: 400,
    efficiency_pct: 88,
    default_coats: 1,
    default_sheen: 'N/A',
    default_scopes: ['Walls', 'Ceilings'],
    notes: 'Blocks heavy tannin bleed-through.',
    status: 'Active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p5',
    name: 'Stix',
    family: 'Primer',
    base: 'Waterborne',
    subtype: 'High Adhesion',
    cost_per_unit: 48,
    coverage_sqft_per_gal_per_coat: 450,
    efficiency_pct: 84,
    default_coats: 1,
    default_sheen: 'N/A',
    default_scopes: ['Trim', 'Doors'],
    notes: 'Bonding primer for glossy surfaces.',
    status: 'Active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p6',
    name: 'Fresh Start',
    family: 'Primer',
    base: 'Waterborne',
    subtype: 'Multi-Purpose',
    cost_per_unit: 39.5,
    coverage_sqft_per_gal_per_coat: 425,
    efficiency_pct: 86,
    default_coats: 1,
    default_sheen: 'N/A',
    default_scopes: ['Walls'],
    notes: 'General-purpose reset primer.',
    status: 'Archived',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

const FAMILIES: ProductFamily[] = ['Paint', 'Primer']
const DEFAULT_SELECTED_BY_FAMILY: Record<ProductFamily, string> = {
  Paint: 'p1',
  Primer: 'p4',
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--v2-bg)',
    color: 'var(--v2-ink)',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 20,
    height: 52,
    borderBottom: '1px solid var(--v2-line)',
    background: 'rgba(10,10,10,0.96)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    flexShrink: 0,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 'calc(10px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    letterSpacing: '0.08em',
    color: 'var(--v2-ink-3)',
    textTransform: 'uppercase' as const,
  },
  breadcrumbSep: {
    color: 'var(--v2-line)',
    fontSize: 14,
  },
  breadcrumbCurrent: {
    color: 'var(--v2-ink-2)',
  },
  backLink: {
    fontSize: 'calc(10px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    letterSpacing: '0.06em',
    color: 'var(--v2-ink-3)',
    textDecoration: 'none',
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--v2-line)',
    background: 'transparent',
  } as CSSProperties,
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    height: 'calc(100vh - 52px)',
  },
  listPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    borderRight: '1px solid var(--v2-line)',
    overflow: 'hidden',
  },
  topControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid var(--v2-line)',
    background: 'var(--v2-bg-2)',
    flexShrink: 0,
  },
  tabsWrap: {
    display: 'inline-flex',
    gap: 6,
    alignItems: 'center',
  },
  tabBtn: (isActive: boolean): CSSProperties => ({
    padding: '7px 14px',
    borderRadius: 7,
    border: isActive ? '1px solid rgba(134,239,172,0.34)' : '1px solid var(--v2-line)',
    background: isActive ? 'rgba(74,222,128,0.12)' : '#101010',
    color: isActive ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
    fontSize: 'calc(10px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  }),
  toolbarActions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    width: 220,
    position: 'relative' as const,
  },
  searchInput: {
    width: '100%',
    padding: '7px 10px 7px 30px',
    borderRadius: 7,
    border: '1px solid var(--v2-line)',
    background: '#111111',
    color: 'var(--v2-ink)',
    fontSize: 'calc(11px + 4pt)',
    outline: 'none',
  } as CSSProperties,
  searchIcon: {
    position: 'absolute' as const,
    left: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--v2-ink-3)',
    pointerEvents: 'none' as const,
    fontSize: 11,
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 7,
    border: '1px solid rgba(134,239,172,0.34)',
    background: '#8ad39b',
    color: '#062410',
    fontSize: 'calc(10px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    cursor: 'default',
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,
  tableHead: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1.8fr) minmax(150px, 1.2fr) 108px 108px 108px',
    padding: '8px 12px',
    borderBottom: '1px solid var(--v2-line)',
    background: 'var(--v2-bg)',
    flexShrink: 0,
  },
  tableHeadCell: {
    fontSize: 'calc(9px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    fontWeight: 600,
    letterSpacing: '0.1em',
    color: 'var(--v2-ink-3)',
    textTransform: 'uppercase' as const,
  } as CSSProperties,
  tableBody: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  row: (isSelected: boolean): CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1.8fr) minmax(150px, 1.2fr) 108px 108px 108px',
    padding: '10px 12px',
    borderBottom: '1px solid var(--v2-line)',
    alignItems: 'center',
    background: isSelected ? 'var(--v2-bg-3)' : 'transparent',
    borderLeft: isSelected ? '3px solid var(--v2-green)' : '3px solid transparent',
    cursor: 'pointer',
  }),
  productName: {
    fontSize: 'calc(12px + 4pt)',
    fontWeight: 700,
    color: 'var(--v2-ink)',
  },
  rowText: {
    fontSize: 'calc(11px + 4pt)',
    color: 'var(--v2-ink-2)',
  },
  moneyText: {
    fontSize: 'calc(11px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    fontWeight: 700,
    color: 'var(--v2-green)',
  },
  coverageText: {
    fontSize: 'calc(11px + 4pt)',
    color: 'var(--v2-ink-2)',
  },
  statusBadge: (status: ProductStatus): CSSProperties => ({
    display: 'inline-flex',
    padding: '2px 7px',
    borderRadius: 4,
    border: `1px solid ${status === 'Active' ? 'rgba(134,239,172,0.35)' : 'var(--v2-line)'}`,
    background: status === 'Active' ? 'rgba(74,222,128,0.12)' : 'transparent',
    color: status === 'Active' ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
    fontSize: 'calc(8px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    fontWeight: 700,
    letterSpacing: '0.08em',
  }),
  emptyState: {
    padding: '20px 16px',
    fontSize: 'calc(11px + 4pt)',
    color: 'var(--v2-ink-3)',
  },
  detailPanel: {
    width: 360,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--v2-bg-2)',
    overflow: 'hidden',
  },
  detailHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--v2-line)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  detailHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  editTitle: {
    fontSize: 'calc(11px + 4pt)',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--v2-ink)',
  },
  toggleWrap: {
    width: 34,
    height: 18,
    borderRadius: 9,
    background: 'rgba(74,222,128,0.6)',
    border: '1px solid rgba(134,239,172,0.35)',
    position: 'relative' as const,
    flexShrink: 0,
  },
  toggleDot: {
    position: 'absolute' as const,
    top: 2,
    left: 18,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#062410',
  },
  detailHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  miniBtn: {
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid var(--v2-line)',
    background: '#101010',
    color: 'var(--v2-ink-3)',
    fontSize: 'calc(9px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  miniBtnPrimary: {
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid rgba(134,239,172,0.34)',
    background: '#8ad39b',
    color: '#062410',
    fontSize: 'calc(9px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  detailScroll: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  section: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--v2-line)',
  },
  sectionLabel: {
    fontSize: 'calc(10px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: 'var(--v2-ink-2)',
    marginBottom: 10,
  } as CSSProperties,
  fieldGrid1: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
  },
  fieldGrid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  fieldGrid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 10,
  },
  fieldLabel: {
    fontSize: 'calc(9px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    letterSpacing: '0.06em',
    color: 'var(--v2-ink-3)',
    marginBottom: 5,
    display: 'block',
    textTransform: 'uppercase' as const,
  } as CSSProperties,
  textInput: {
    width: '100%',
    padding: '7px 9px',
    borderRadius: 7,
    border: '1px solid var(--v2-line)',
    background: '#0f0f0f',
    color: 'var(--v2-ink)',
    fontSize: 'calc(11px + 4pt)',
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as CSSProperties,
  textarea: {
    width: '100%',
    minHeight: 96,
    resize: 'vertical' as const,
    padding: '8px 9px',
    borderRadius: 7,
    border: '1px solid var(--v2-line)',
    background: '#0f0f0f',
    color: 'var(--v2-ink)',
    fontSize: 'calc(11px + 4pt)',
    boxSizing: 'border-box' as const,
    outline: 'none',
    fontFamily: 'inherit',
  } as CSSProperties,
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px 16px',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 'calc(11px + 4pt)',
    color: 'var(--v2-ink-2)',
  },
  footer: {
    padding: 16,
    borderTop: '1px solid var(--v2-line)',
    background: 'var(--v2-bg-2)',
  },
  commitBtn: {
    width: '100%',
    padding: '10px 0',
    borderRadius: 7,
    border: '1px solid rgba(134,239,172,0.34)',
    background: '#8ad39b',
    color: '#062410',
    fontSize: 'calc(11px + 4pt)',
    fontFamily: 'var(--v2-mono)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
} as const

function fmtUsd(value: number) {
  return `$${value.toFixed(2)}`
}

function fmtCoverage(value: number | null) {
  if (value == null) return 'N/A'
  return `${value} sqft`
}

export default function ProductsPage() {
  const [activeFamily, setActiveFamily] = useState<ProductFamily>('Paint')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state for editing
  const [formState, setFormState] = useState<Partial<ProductRow>>({})

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true)
        const res = await authedFetch('/api/estimates/v2/products', { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to load products: ${res.statusText}`)
        }
        const data = await res.json()
        const prods = data.products || []
        setProducts(prods)
        // Select first product of active family, or first product overall
        const firstOfFamily = prods.find((p: ProductRow) => p.family === activeFamily)
        setSelectedId(firstOfFamily?.id || prods[0]?.id || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load products')
      } finally {
        setLoading(false)
      }
    }
    void loadProducts()
  }, [])

  const filtered = useMemo(() => products.filter((p) => p.family === activeFamily), [products, activeFamily])
  const selected = filtered.find((p) => p.id === selectedId) ?? filtered[0] ?? null

  // Update form state when selected product changes
  useEffect(() => {
    if (selected) {
      setFormState({
        name: selected.name,
        family: selected.family,
        base: selected.base,
        subtype: selected.subtype,
        cost_per_unit: selected.cost_per_unit,
        coverage_sqft_per_gal_per_coat: selected.coverage_sqft_per_gal_per_coat,
        efficiency_pct: selected.efficiency_pct,
        default_coats: selected.default_coats,
        default_sheen: selected.default_sheen,
        default_scopes: selected.default_scopes || [],
        notes: selected.notes,
        status: selected.status,
      })
    }
  }, [selected])

  const handleSelectRow = (id: string) => {
    setSelectedId(id)
  }

  const handleSave = async () => {
    if (!selected) return
    try {
      setSaving(true)
      const res = await authedFetch(`/api/estimates/v2/products/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      })
      if (!res.ok) {
        throw new Error(`Failed to save product: ${res.statusText}`)
      }
      const updated = await res.json()
      setProducts((prev) => prev.map((p) => (p.id === selected.id ? updated.product : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!window.confirm(`Delete "${selected.name}"?`)) return
    try {
      setSaving(true)
      const res = await authedFetch(`/api/estimates/v2/products/${selected.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error(`Failed to delete product: ${res.statusText}`)
      }
      setProducts((prev) => prev.filter((p) => p.id !== selected.id))
      setSelectedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ace-v2-shell" style={S.page}>
      <header style={S.header}>
        <nav style={S.breadcrumb}>
          <Link href="/crm/estimates/v2" style={{ color: 'inherit', textDecoration: 'none' }}>
            Estimator V2
          </Link>
          <span style={S.breadcrumbSep}>/</span>
          <span style={S.breadcrumbCurrent}>Products</span>
        </nav>
        <Link href="/crm/estimates/v2" style={S.backLink}>
          {'<- Home'}
        </Link>
      </header>

      <div style={S.body}>
        <section style={S.listPanel}>
          <div style={S.topControls}>
            <div style={S.tabsWrap}>
              {FAMILIES.map((family) => (
                <button
                  key={family}
                  type="button"
                  style={S.tabBtn(family === activeFamily)}
                  onClick={() => setActiveFamily(family)}
                >
                  {family}
                </button>
              ))}
            </div>
            <div style={S.toolbarActions}>
              <div style={S.searchWrap}>
                <span style={S.searchIcon}>?</span>
                <input style={S.searchInput} type="text" defaultValue="" placeholder={`Search ${activeFamily}...`} />
              </div>
              <button type="button" style={S.addBtn}>
                + Add Product
              </button>
            </div>
          </div>

          <div style={S.tableHead}>
            <span style={S.tableHeadCell}>Name</span>
            <span style={S.tableHeadCell}>Base / Subtype</span>
            <span style={S.tableHeadCell}>Cost</span>
            <span style={S.tableHeadCell}>Coverage</span>
            <span style={S.tableHeadCell}>Status</span>
          </div>

          <div style={S.tableBody}>
            {filtered.length === 0 && <div style={S.emptyState}>No products in this tab.</div>}
            {filtered.map((product) => (
              <div
                key={product.id}
                style={S.row(product.id === selected?.id)}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectRow(product.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleSelectRow(product.id)
                  }
                }}
              >
                <span style={S.productName}>{product.name}</span>
                <span style={S.rowText}>
                  {product.base ?? 'N/A'} / {product.subtype ?? 'N/A'}
                </span>
                <span style={S.moneyText}>{fmtUsd(product.cost_per_unit ?? 0)}</span>
                <span style={S.coverageText}>{fmtCoverage(product.coverage_sqft_per_gal_per_coat ?? null)}</span>
                <span>
                  <span style={S.statusBadge(product.status)}>{product.status}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <aside style={S.detailPanel}>
          <div style={S.detailHeader}>
            <div style={S.detailHeaderLeft}>
              <span style={S.editTitle}>Edit Item</span>
              <span style={S.toggleWrap}>
                <span style={S.toggleDot} />
              </span>
            </div>
            <div style={S.detailHeaderActions}>
              <button type="button" style={S.miniBtn}>
                Duplicate
              </button>
              <button type="button" style={S.miniBtnPrimary}>
                Save & New
              </button>
            </div>
          </div>

          <div style={S.detailScroll}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center' }}>Loading products...</div>
            ) : error ? (
              <div style={{ padding: 20, color: '#ff6b6b' }}>{error}</div>
            ) : selected ? (
              <>
            <section style={S.section}>
              <div style={S.sectionLabel}>Basic</div>
              <label style={S.fieldLabel}>Product Name</label>
              <input
                style={S.textInput}
                value={formState.name ?? ''}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
              />
              <div style={{ ...S.fieldGrid2, marginTop: 10 }}>
                <div>
                  <label style={S.fieldLabel}>Family</label>
                  <select
                    style={S.textInput as CSSProperties}
                    value={formState.family ?? 'Paint'}
                    onChange={(e) => setFormState((prev) => ({ ...prev, family: e.target.value as ProductFamily }))}
                  >
                    <option>Paint</option>
                    <option>Primer</option>
                  </select>
                </div>
                <div>
                  <label style={S.fieldLabel}>Base</label>
                  <input
                    style={S.textInput}
                    value={formState.base ?? ''}
                    onChange={(e) => setFormState((prev) => ({ ...prev, base: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ ...S.fieldGrid1, marginTop: 10 }}>
                <div>
                  <label style={S.fieldLabel}>Subtype</label>
                  <input
                    style={S.textInput}
                    value={formState.subtype ?? ''}
                    onChange={(e) => setFormState((prev) => ({ ...prev, subtype: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section style={S.section}>
              <div style={S.sectionLabel}>Pricing &amp; Yield</div>
              <div style={S.fieldGrid3}>
                <div>
                  <label style={S.fieldLabel}>Cost / Unit</label>
                  <input
                    style={S.textInput}
                    value={formState.cost_per_unit ?? ''}
                    onChange={(e) => setFormState((prev) => ({ ...prev, cost_per_unit: e.target.value ? Number(e.target.value) : null }))}
                    type="number"
                    step="0.01"
                  />
                </div>
                <div>
                  <label style={S.fieldLabel}>Coverage (sqft)</label>
                  <input
                    style={S.textInput}
                    value={formState.coverage_sqft_per_gal_per_coat ?? ''}
                    onChange={(e) => setFormState((prev) => ({ ...prev, coverage_sqft_per_gal_per_coat: e.target.value ? Number(e.target.value) : null }))}
                    type="number"
                    step="0.01"
                  />
                </div>
                <div>
                  <label style={S.fieldLabel}>Efficiency (%)</label>
                  <input
                    style={S.textInput}
                    value={formState.efficiency_pct ?? ''}
                    onChange={(e) => setFormState((prev) => ({ ...prev, efficiency_pct: e.target.value ? Number(e.target.value) : null }))}
                    type="number"
                    step="0.01"
                  />
                </div>
              </div>
            </section>

            <section style={S.section}>
              <div style={S.sectionLabel}>Defaults</div>
              <div style={S.fieldGrid2}>
                <div>
                  <label style={S.fieldLabel}>Default Coats</label>
                  <input
                    style={S.textInput}
                    value={formState.default_coats ?? ''}
                    onChange={(e) => setFormState((prev) => ({ ...prev, default_coats: e.target.value ? Number(e.target.value) : null }))}
                    type="number"
                  />
                </div>
                <div>
                  <label style={S.fieldLabel}>Default Sheen</label>
                  <select
                    style={S.textInput as CSSProperties}
                    value={formState.default_sheen ?? 'N/A'}
                    onChange={(e) => setFormState((prev) => ({ ...prev, default_sheen: e.target.value }))}
                  >
                    <option>Eggshell</option>
                    <option>Satin</option>
                    <option>Flat</option>
                    <option>Semi-Gloss</option>
                    <option>N/A</option>
                  </select>
                </div>
              </div>
              <label style={{ ...S.fieldLabel, marginTop: 14 }}>Applies To</label>
              <div style={S.checkboxGrid}>
                {['Walls', 'Ceilings', 'Trim', 'Doors', 'Cabinetry', 'Other'].map((scope) => (
                  <label key={scope} style={S.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={(formState.default_scopes ?? []).includes(scope)}
                      onChange={(e) => {
                        const currentScopes = formState.default_scopes ?? []
                        if (e.target.checked) {
                          setFormState((prev) => ({ ...prev, default_scopes: [...currentScopes, scope] }))
                        } else {
                          setFormState((prev) => ({ ...prev, default_scopes: currentScopes.filter((s) => s !== scope) }))
                        }
                      }}
                    />
                    {scope}
                  </label>
                ))}
              </div>
            </section>

            <section style={S.section}>
              <div style={S.sectionLabel}>Notes</div>
              <label style={S.fieldLabel}>Internal Notes</label>
              <textarea
                style={S.textarea}
                value={formState.notes ?? ''}
                onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </section>
              </>
            ) : (
              <div style={{ padding: 20, textAlign: 'center' }}>Select a product to edit</div>
            )}
          </div>

          <div style={S.footer}>
            {error && <div style={{ color: '#ff6b6b', marginBottom: 10, fontSize: 'calc(11px + 4pt)' }}>{error}</div>}
            <button
              type="button"
              style={S.commitBtn}
              onClick={handleSave}
              disabled={!selected || saving}
            >
              {saving ? 'Saving...' : 'Commit Changes'}
            </button>
            {selected && (
              <button
                type="button"
                style={{ ...S.commitBtn, background: '#ff6b6b', border: '1px solid rgba(255, 107, 107, 0.34)', marginTop: 8 }}
                onClick={handleDelete}
                disabled={saving}
              >
                Delete Product
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
