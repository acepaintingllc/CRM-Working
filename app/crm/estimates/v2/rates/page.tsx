'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import type {
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsMutationAction,
  RatesFlagsPayload,
  RatesFlagsRow,
  RatesFlagsTab,
} from '@/types/estimator/ratesFlags'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

type StatusFilter = 'active' | 'archived' | 'all'
type RateSectionKey =
  | 'production'
  | 'unit_rates'
  | 'access_fees'
  | 'supplies'
type FlagsSectionKey = 'condition_modifiers' | 'height_factors' | 'wall_complexity' | 'ceiling_types'
type RoomDefaultsSectionKey = 'room_types' | 'room_templates' | 'scope_defaults'

const RATE_SECTIONS: Array<{
  key: RateSectionKey
  label: string
}> = [
  { key: 'production', label: 'Production' },
  { key: 'unit_rates', label: 'Unit Rates' },
  { key: 'access_fees', label: 'Access Fees' },
  { key: 'supplies', label: 'Supplies' },
]

const RATE_SUBGROUPS: Record<
  RateSectionKey,
  Array<{
    key: RatesFlagsCategoryKey
    label: string
  }>
> = {
  production: [
    { key: 'production_rates_walls', label: 'Walls' },
    { key: 'production_rates_ceilings', label: 'Ceilings' },
    { key: 'production_rates_trim', label: 'Trim' },
  ],
  unit_rates: [
    { key: 'unit_rates_doors', label: 'Doors' },
    { key: 'unit_rates_trim', label: 'Trim Types' },
    { key: 'unit_rates_drywall', label: 'Drywall' },
  ],
  access_fees: [
    { key: 'access_fees_ladders', label: 'Ladders' },
    { key: 'access_fees_scaffolding', label: 'Scaffolding' },
    { key: 'access_fees_specialty', label: 'Specialty' },
  ],
  supplies: [
    { key: 'supply_rates_per_color', label: 'Per-Color' },
    { key: 'supply_rates_area_based', label: 'Area-Based' },
    { key: 'supply_rates_per_job', label: 'Per-Job' },
    { key: 'supply_rates_roller_covers', label: 'Roller Covers' },
  ],
}

const FLAGS_SECTIONS: Array<{
  key: RatesFlagsCategoryKey
  label: string
}> = [
  { key: 'condition_modifiers', label: 'Condition Modifiers' },
  { key: 'height_factors', label: 'Height Factors' },
  { key: 'wall_complexity', label: 'Wall Complexity' },
  { key: 'ceiling_types', label: 'Ceiling Types' },
]

const ROOM_DEFAULTS_SECTIONS: Array<{
  key: RatesFlagsCategoryKey
  label: string
}> = [
  { key: 'room_types', label: 'Room Types' },
  { key: 'room_templates', label: 'Room Templates' },
  { key: 'scope_defaults', label: 'Scope Defaults' },
]

function valueFromRow(row: RatesFlagsRow, key: string) {
  if (key === 'active') return row.active ? 'ACTIVE' : 'ARCHIVED'
  const value = (row as Record<string, unknown>)[key]
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'Y' : 'N'
  return String(value)
}

function buildDraftFromRow(category: RatesFlagsCategory, row: RatesFlagsRow) {
  const draft: Record<string, string> = {}
  for (const field of category.fields) {
    draft[field.key] = valueFromRow(row, field.key)
  }
  if (!draft.id) draft.id = row.id
  if (!draft.display_name) draft.display_name = valueFromRow(row, 'display_name')
  return draft
}

function getDefaultDraft(category: RatesFlagsCategory) {
  const draft: Record<string, string> = {}
  for (const field of category.fields) {
    if (field.options && field.options.length > 0) {
      draft[field.key] = field.options[0]
      continue
    }
    draft[field.key] = ''
  }
  if (category.key === 'area_costs' || category.key === 'supply_rates_area_based') {
    draft.unit = '$/sqft'
  }
  return draft
}




function categoryByKey(
  categories: RatesFlagsCategory[],
  key: RatesFlagsCategoryKey
) {
  return categories.find((category) => category.key === key) ?? null
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
    zIndex: 30,
    borderBottom: '1px solid var(--v2-line)',
    background: 'rgba(10,10,10,0.96)',
    backdropFilter: 'blur(10px)',
    padding: '11px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  crumb: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(10px + 4pt)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--v2-ink-3)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  back: {
    textDecoration: 'none',
    color: 'var(--v2-ink-3)',
    border: '1px solid var(--v2-line)',
    borderRadius: 8,
    padding: '4px 10px',
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(10px + 4pt)',
  } as CSSProperties,
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 380px',
    minHeight: 0,
  },
  list: {
    display: 'grid',
    gridTemplateRows: 'auto auto auto auto minmax(0, 1fr)',
    borderRight: '1px solid var(--v2-line)',
    minHeight: 0,
  },
  tabs: {
    padding: '12px 16px 0',
    display: 'flex',
    gap: 8,
  },
  tab: (active: boolean): CSSProperties => ({
    border: '1px solid var(--v2-line)',
    borderRadius: 9,
    padding: '8px 14px',
    background: active ? 'var(--v2-bg-3)' : '#101010',
    color: active ? 'var(--v2-ink)' : 'var(--v2-ink-3)',
    cursor: 'pointer',
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(10px + 4pt)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  }),
  sectionRow: {
    padding: '10px 16px 0',
    display: 'grid',
    gap: 8,
  },
  sectionChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  chip: (active: boolean): CSSProperties => ({
    border: '1px solid var(--v2-line)',
    borderRadius: 999,
    padding: '6px 11px',
    background: active ? 'rgba(74,222,128,0.12)' : 'transparent',
    color: active ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
    cursor: 'pointer',
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(9px + 4pt)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  }),
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto auto',
    gap: 10,
    padding: '12px 16px',
    borderBottom: '1px solid var(--v2-line)',
    borderTop: '1px solid var(--v2-line)',
    background: 'var(--v2-bg-2)',
  },
  search: {
    width: '100%',
    border: '1px solid var(--v2-line)',
    borderRadius: 8,
    background: '#111111',
    color: 'var(--v2-ink)',
    padding: '8px 10px',
    fontSize: 'calc(11px + 4pt)',
  } as CSSProperties,
  select: {
    border: '1px solid var(--v2-line)',
    borderRadius: 8,
    background: '#111111',
    color: 'var(--v2-ink)',
    padding: '8px 10px',
    fontSize: 'calc(10px + 4pt)',
    minWidth: 110,
  } as CSSProperties,
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'nowrap' as const,
    alignItems: 'center',
    alignContent: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid var(--v2-line)',
    background: 'var(--v2-bg-2)',
    overflowX: 'auto' as const,
  },
  actionBtn: (kind: 'default' | 'primary' | 'danger' = 'default'): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
    height: 34,
    borderRadius: 8,
    border:
      kind === 'primary'
        ? '1px solid rgba(134,239,172,0.34)'
        : kind === 'danger'
          ? '1px solid rgba(248,113,113,0.3)'
          : '1px solid var(--v2-line)',
    background:
      kind === 'primary'
        ? '#8ad39b'
        : kind === 'danger'
          ? 'rgba(248,113,113,0.14)'
          : '#101010',
    color:
      kind === 'primary'
        ? '#062410'
        : kind === 'danger'
          ? '#fda4af'
          : 'var(--v2-ink-2)',
    padding: '7px 11px',
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(9px + 4pt)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  }),
  tableWrap: {
    overflow: 'auto' as const,
    minHeight: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    textAlign: 'left' as const,
    borderBottom: '1px solid var(--v2-line)',
    padding: '9px 10px',
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(9px + 4pt)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--v2-ink-3)',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--v2-bg)',
  } as CSSProperties,
  td: {
    borderBottom: '1px solid var(--v2-line)',
    padding: '9px 10px',
    fontSize: 'calc(11px + 4pt)',
    color: 'var(--v2-ink-2)',
  },
  row: (selected: boolean): CSSProperties => ({
    background: selected ? 'rgba(74,222,128,0.08)' : 'transparent',
    cursor: 'pointer',
  }),
  statusPill: (active: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    padding: '2px 9px',
    border: '1px solid rgba(134,239,172,0.3)',
    background: active ? 'rgba(74,222,128,0.14)' : 'transparent',
    color: active ? 'var(--v2-green-2)' : 'var(--v2-ink-3)',
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(8px + 4pt)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }),
  detail: {
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    minHeight: 0,
    background: 'var(--v2-bg-2)',
  },
  detailHead: {
    padding: '15px 16px',
    borderBottom: '1px solid var(--v2-line)',
    display: 'grid',
    gap: 8,
  },
  detailTitle: {
    fontSize: 'calc(14px + 4pt)',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  detailSub: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(9px + 4pt)',
    letterSpacing: '0.07em',
    color: 'var(--v2-ink-3)',
  },
  formWrap: {
    padding: '14px 16px 20px',
    overflowY: 'auto' as const,
    display: 'grid',
    gap: 12,
  },
  label: {
    display: 'grid',
    gap: 6,
  },
  labelText: {
    fontFamily: 'var(--v2-mono)',
    fontSize: 'calc(9px + 4pt)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--v2-ink-3)',
  },
  input: {
    border: '1px solid var(--v2-line)',
    borderRadius: 8,
    background: '#111111',
    color: 'var(--v2-ink)',
    padding: '8px 10px',
    fontSize: 'calc(11px + 4pt)',
  } as CSSProperties,
  footer: {
    borderTop: '1px solid var(--v2-line)',
    padding: '12px 16px',
    display: 'grid',
    gap: 8,
  },
  message: {
    padding: '16px',
    fontSize: 'calc(11px + 4pt)',
    color: 'var(--v2-ink-3)',
  },
} as const

export default function RatesPage() {
  const [data, setData] = useState<RatesFlagsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<RatesFlagsTab>('rates')
  const [rateSection, setRateSection] = useState<RateSectionKey>('production')
  const [rateCategory, setRateCategory] =
    useState<RatesFlagsCategoryKey>('production_rates_walls')
  const [flagsSection, setFlagsSection] =
    useState<FlagsSectionKey>('condition_modifiers')
  const [roomDefaultsSection, setRoomDefaultsSection] =
    useState<RoomDefaultsSectionKey>('room_types')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [draftActive, setDraftActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function load(keepId?: string) {
    setLoading(true)
    setError(null)
    const res = await authedFetch('/api/estimates/v2/rates-flags', {
      cache: 'no-store',
    })
    const payload = (await res.json().catch(() => null)) as
      | RatesFlagsPayload
      | { error?: string }
      | null
    if (!res.ok) {
      setError(payload && 'error' in payload ? payload.error || res.statusText : res.statusText)
      setLoading(false)
      return
    }
    setData(payload as RatesFlagsPayload)
    if (keepId) setSelectedId(keepId)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const defaultKey = RATE_SUBGROUPS[rateSection][0]?.key
    if (!defaultKey) return
    if (!RATE_SUBGROUPS[rateSection].some((entry) => entry.key === rateCategory)) {
      setRateCategory(defaultKey)
    }
  }, [rateCategory, rateSection])

  const activeCategoryKey = useMemo<RatesFlagsCategoryKey>(() => {
    if (activeTab === 'rates') return rateCategory
    if (activeTab === 'flags') return flagsSection
    return roomDefaultsSection
  }, [activeTab, flagsSection, rateCategory, roomDefaultsSection])

  const categories = data?.categories ?? []
  const activeCategory = categoryByKey(categories, activeCategoryKey)

  const filteredRows = useMemo(() => {
    if (!activeCategory) return []
    const q = search.trim().toLowerCase()
    return activeCategory.rows.filter((row) => {
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'active' && row.active) ||
        (statusFilter === 'archived' && !row.active)
      if (!statusMatch) return false
      if (!q) return true
      const haystack =
        `${row.id} ${row.display_name} ${JSON.stringify(row)}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [activeCategory, search, statusFilter])

  useEffect(() => {
    if (!activeCategory) return
    if (isCreating) return
    const exists = filteredRows.some((row) => row.id === selectedId)
    if (exists) return
    const fallback = filteredRows[0]
    if (!fallback) {
      setSelectedId('')
      setDraft({})
      return
    }
    setSelectedId(fallback.id)
  }, [activeCategory, filteredRows, isCreating, selectedId])

  const selectedRow = useMemo(() => {
    if (!activeCategory || !selectedId) return null
    return activeCategory.rows.find((row) => row.id === selectedId) ?? null
  }, [activeCategory, selectedId])

  useEffect(() => {
    if (!activeCategory) return
    if (isCreating) return
    if (!selectedRow) return
    setDraft(buildDraftFromRow(activeCategory, selectedRow))
    setDraftActive(selectedRow.active)
  }, [activeCategory, isCreating, selectedRow])

  async function mutate(
    action: RatesFlagsMutationAction,
    values: Record<string, unknown>,
    originalId?: string
  ) {
    if (!activeCategory) return false
    setSaving(true)
    setNotice(null)
    const res = await authedFetch('/api/estimates/v2/rates-flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: activeCategory.key,
        action,
        original_id: originalId,
        values,
      }),
    })
    const payload = (await res.json().catch(() => null)) as
      | { error?: string }
      | { ok: true }
      | null
    setSaving(false)
    if (!res.ok) {
      setError(payload && 'error' in payload ? payload.error || res.statusText : res.statusText)
      return false
    }
    setError(null)
    return true
  }

  async function saveCurrent() {
    if (!activeCategory) return
    const action: RatesFlagsMutationAction = isCreating ? 'create' : 'update'
    const ok = await mutate(
      action,
      { ...draft, active: draftActive ? 'Y' : 'N' },
      isCreating ? undefined : selectedRow?.id
    )
    if (!ok) return
    const keep = draft.id || selectedId
    setIsCreating(false)
    setNotice(`${isCreating ? 'Created' : 'Saved'} ${activeCategory.label}.`)
    await load(keep)
  }

  async function archiveOrReactivate(nextActive: boolean) {
    if (!selectedRow || !activeCategory) return
    const ok = await mutate(
      nextActive ? 'reactivate' : 'archive',
      { id: selectedRow.id },
      selectedRow.id
    )
    if (!ok) return
    setNotice(nextActive ? 'Reactivated row.' : 'Archived row.')
    await load(selectedRow.id)
  }

  function startCreate() {
    if (!activeCategory) return
    setIsCreating(true)
    setSelectedId('')
    setDraft(getDefaultDraft(activeCategory))
    setDraftActive(true)
    setNotice(null)
    setError(null)
  }

  function startDuplicate() {
    if (!activeCategory || !selectedRow) return
    const next = buildDraftFromRow(activeCategory, selectedRow)
    next.id = `${selectedRow.id}_COPY`
    setIsCreating(true)
    setSelectedId('')
    setDraft(next)
    setDraftActive(selectedRow.active)
    setNotice(null)
    setError(null)
  }

  function cancelEdit() {
    if (selectedRow && activeCategory) {
      setDraft(buildDraftFromRow(activeCategory, selectedRow))
      setDraftActive(selectedRow.active)
      setIsCreating(false)
      return
    }
    setDraft({})
    setDraftActive(true)
    setIsCreating(false)
  }

  return (
    <div className="ace-v2-shell" style={S.page}>
      <header style={S.header}>
        <nav style={S.crumb}>
          <Link href="/crm/estimates/v2" style={{ color: 'inherit', textDecoration: 'none' }}>
            Estimator V2
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--v2-ink-2)' }}>Rates, Flags &amp; Room Defaults</span>
        </nav>
        <Link href="/crm/estimates/v2" style={S.back}>
          {'<- Home'}
        </Link>
      </header>

      <div style={S.body}>
        <section style={S.list}>
          <div style={S.tabs}>
            <button type="button" style={S.tab(activeTab === 'rates')} onClick={() => setActiveTab('rates')}>
              Rates
            </button>
            <button type="button" style={S.tab(activeTab === 'flags')} onClick={() => setActiveTab('flags')}>
              Flags
            </button>
            <button
              type="button"
              style={S.tab(activeTab === 'room_defaults')}
              onClick={() => setActiveTab('room_defaults')}
            >
              Room Defaults
            </button>
          </div>

          <div style={S.sectionRow}>
            {activeTab === 'rates' ? (
              <>
                <div style={S.sectionChips}>
                  {RATE_SECTIONS.map((section) => (
                    <button
                      key={section.key}
                      type="button"
                      style={S.chip(rateSection === section.key)}
                      onClick={() => {
                        setRateSection(section.key)
                        setRateCategory(RATE_SUBGROUPS[section.key][0].key)
                        setIsCreating(false)
                        setNotice(null)
                      }}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
                <div style={S.sectionChips}>
                  {RATE_SUBGROUPS[rateSection].map((subgroup) => (
                    <button
                      key={subgroup.key}
                      type="button"
                      style={S.chip(rateCategory === subgroup.key)}
                      onClick={() => {
                        setRateCategory(subgroup.key)
                        setIsCreating(false)
                        setNotice(null)
                      }}
                    >
                      {subgroup.label}
                    </button>
                  ))}
                </div>
              </>
            ) : activeTab === 'flags' ? (
              <div style={S.sectionChips}>
                {FLAGS_SECTIONS.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    style={S.chip(flagsSection === section.key)}
                    onClick={() => {
                      setFlagsSection(section.key as FlagsSectionKey)
                      setIsCreating(false)
                      setNotice(null)
                    }}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={S.sectionChips}>
                {ROOM_DEFAULTS_SECTIONS.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    style={S.chip(roomDefaultsSection === section.key)}
                    onClick={() => {
                      setRoomDefaultsSection(section.key as RoomDefaultsSectionKey)
                      setIsCreating(false)
                      setNotice(null)
                    }}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            )}
            <div style={{ ...S.detailSub, marginTop: 2 }}>
              {activeCategory?.label ?? 'Loading catalog...'}
            </div>
            <div style={{ fontSize: 'calc(11px + 4pt)', color: 'var(--v2-ink-3)' }}>
              {activeCategory?.description ?? 'Loading category metadata...'}
            </div>
          </div>

          <div style={S.toolbar}>
            <input
              style={S.search}
              placeholder="Search rows..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              style={S.select}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
            <button type="button" style={S.actionBtn('default')} onClick={() => void load(selectedId || undefined)}>
              Refresh
            </button>
          </div>

          <div style={S.actions}>
            <button type="button" style={S.actionBtn('default')} onClick={startCreate} disabled={saving}>
              Add
            </button>
            <button
              type="button"
              style={S.actionBtn('default')}
              onClick={startDuplicate}
              disabled={!selectedRow || saving}
            >
              Duplicate
            </button>
            <button
              type="button"
              style={S.actionBtn(selectedRow?.active ? 'danger' : 'default')}
              onClick={() => void archiveOrReactivate(!(selectedRow?.active ?? false))}
              disabled={!selectedRow || isCreating || saving}
            >
              {selectedRow?.active ? 'Archive' : 'Reactivate'}
            </button>
            <button
              type="button"
              style={S.actionBtn('primary')}
              onClick={() => void saveCurrent()}
              disabled={!activeCategory || saving}
            >
              Save
            </button>
          </div>

          <div style={S.tableWrap}>
            {loading && <div style={S.message}>Loading...</div>}
            {!loading && error && <div style={{ ...S.message, color: '#fda4af' }}>{error}</div>}
            {!loading && !error && activeCategory && filteredRows.length === 0 && (
              <div style={S.message}>No rows found for this filter.</div>
            )}
            {!loading && !error && activeCategory && filteredRows.length > 0 && (
              <table style={S.table}>
                <thead>
                  <tr>
                    {activeCategory.columns.map((column) => (
                      <th key={column.key} style={{ ...S.th, textAlign: column.align ?? 'left' }}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      style={S.row(!isCreating && selectedId === row.id)}
                      onClick={() => {
                        setSelectedId(row.id)
                        setIsCreating(false)
                        setNotice(null)
                        setError(null)
                      }}
                    >
                      {activeCategory.columns.map((column) => {
                        if (column.key === 'active') {
                          return (
                            <td key={`${row.id}-${column.key}`} style={{ ...S.td, textAlign: column.align ?? 'left' }}>
                              <span style={S.statusPill(row.active)}>
                                {row.active ? 'ACTIVE' : 'ARCHIVED'}
                              </span>
                            </td>
                          )
                        }
                        const text = valueFromRow(row, column.key)
                        return (
                          <td key={`${row.id}-${column.key}`} style={{ ...S.td, textAlign: column.align ?? 'left' }}>
                            {text || '--'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside style={S.detail}>
          <div style={S.detailHead}>
            <div style={S.detailTitle}>
              {isCreating ? 'New Row' : selectedRow ? selectedRow.display_name || selectedRow.id : 'No Selection'}
            </div>
            <div style={S.detailSub}>
              {activeCategory?.label ?? 'Category'} | Template v{data?.template_version ?? 'n/a'} | {data?.source ?? 'db'}
            </div>
            {!isCreating && selectedRow && (
              <span style={S.statusPill(draftActive)}>
                {draftActive ? 'ACTIVE' : 'ARCHIVED'}
              </span>
            )}
            {notice && <div style={{ color: 'var(--v2-green-2)', fontSize: 'calc(10px + 4pt)' }}>{notice}</div>}
          </div>

          <div style={S.formWrap}>
            {!activeCategory && <div style={S.message}>No active category.</div>}
            {activeCategory && (
              <>
                <label style={S.label}>
                  <span style={S.labelText}>Status</span>
                  <select
                    style={S.input}
                    value={draftActive ? 'Y' : 'N'}
                    onChange={(event) => setDraftActive(event.target.value === 'Y')}
                  >
                    <option value="Y">Active</option>
                    <option value="N">Archived</option>
                  </select>
                </label>
                {activeCategory.fields.map((field) => (
                  <label key={field.key} style={S.label}>
                    <span style={S.labelText}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                    {field.type === 'select' ? (
                      <select
                        style={S.input}
                        disabled={field.readOnly}
                        value={draft[field.key] ?? ''}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                      >
                        {(field.options ?? ['']).map((opt) => (
                          <option key={opt || 'blank'} value={opt}>
                            {opt || '--'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        style={S.input}
                        type={field.type === 'number' ? 'number' : 'text'}
                        readOnly={field.readOnly}
                        value={draft[field.key] ?? ''}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                    )}
                    {field.helperText && (
                      <span style={{ color: 'var(--v2-ink-3)', fontSize: 'calc(9px + 4pt)' }}>
                        {field.helperText}
                      </span>
                    )}
                  </label>
                ))}
              </>
            )}
          </div>

          <div style={S.footer}>
            <button
              type="button"
              style={S.actionBtn('primary')}
              onClick={() => void saveCurrent()}
              disabled={!activeCategory || saving}
            >
              {saving ? 'Saving...' : isCreating ? 'Create Row' : 'Save Changes'}
            </button>
            <button type="button" style={S.actionBtn('default')} onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </aside>
      </div>

      <style jsx>{`
        @media (max-width: 1120px) {
          .ace-v2-shell {
            --local-panel-min: 320px;
          }
        }
        @media (max-width: 980px) {
          div[style*='grid-template-columns: minmax(0, 1fr) 380px'] {
            grid-template-columns: 1fr !important;
          }
          section[style*='border-right'] {
            border-right: none !important;
            border-bottom: 1px solid var(--v2-line);
          }
        }
      `}</style>
    </div>
  )
}

