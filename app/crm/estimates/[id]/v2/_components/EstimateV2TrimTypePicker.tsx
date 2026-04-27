'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { EstimateV2TrimTypeOption } from '@/types/estimator/v2'
import { inferTrimTypeMetadata } from '@/lib/estimator/trimTypeMetadata'

export type TrimTypePickerProps = {
  value: string
  options: EstimateV2TrimTypeOption[]
  onChange: (trimTypeId: string) => void
  styles: {
    input: React.CSSProperties
    mono: React.CSSProperties
  }
}

const CATEGORY_CHIPS = [
  { key: '', label: 'All' },
  { key: 'linear', label: 'Linear' },
  { key: 'base', label: 'Base' },
  { key: 'crown', label: 'Crown' },
  { key: 'casing', label: 'Casing' },
  { key: 'rail', label: 'Rail' },
  { key: 'door_window', label: 'Doors/Windows' },
  { key: 'panel', label: 'Panel' },
  { key: 'feature', label: 'Features' },
  { key: 'other', label: 'Other' },
] as const

type PickerOption = EstimateV2TrimTypeOption & {
  trim_category: NonNullable<EstimateV2TrimTypeOption['trim_category']>
  measurement_class: NonNullable<EstimateV2TrimTypeOption['measurement_class']>
  picker_group: string
}

const CATEGORY_LABELS: Record<string, string> = {
  base: 'Base Molding',
  crown: 'Crown Molding',
  casing: 'Casing / Door',
  rail: 'Rail / Chair',
  door_window: 'Doors & Windows',
  panel: 'Panels / Wainscot',
  feature: 'Features',
  other: 'Other',
}

function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Uncategorized'
  return CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1)
}

function getMeasurementClassLabel(mc: string | null | undefined): string {
  if (!mc) return ''
  const labels: Record<string, string> = {
    linear: 'LF',
    opening: 'Opening',
    surface: 'SF',
    assembly: 'Assembly',
  }
  return labels[mc] ?? mc
}

function matchesSearch(option: EstimateV2TrimTypeOption, query: string): boolean {
  const q = query.toLowerCase()
  return (
    (option.label ?? '').toLowerCase().includes(q) ||
    (option.id ?? '').toLowerCase().includes(q) ||
    (option.family ?? '').toLowerCase().includes(q) ||
    (option.category ?? '').toLowerCase().includes(q) ||
    (option.trim_category ?? '').toLowerCase().includes(q) ||
    (option.unit_type ?? '').toLowerCase().includes(q) ||
    (option.default_production_rate_id ?? '').toLowerCase().includes(q) ||
    (option.picker_group ?? '').toLowerCase().includes(q)
  )
}

export function EstimateV2TrimTypePicker({
  value,
  options,
  onChange,
  styles,
}: TrimTypePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const normalizedOptions = useMemo<PickerOption[]>(
    () =>
      options.map((option) => {
        const metadata = inferTrimTypeMetadata({
          id: option.id,
          label: option.label,
          family: option.family,
          category: option.category,
          unitType: option.unit_type,
          trimCategory: option.trim_category,
          measurementClass: option.measurement_class,
          pickerGroup: option.picker_group,
        })
        return {
          ...option,
          trim_category: metadata.trim_category,
          measurement_class: metadata.measurement_class,
          picker_group: metadata.picker_group,
        }
      }),
    [options]
  )
  const selectedOption = useMemo(
    () => normalizedOptions.find((opt) => opt.id === value),
    [normalizedOptions, value]
  )

  const filtered = useMemo(() => {
    let result = normalizedOptions

    // Filter by category chip
    if (activeCategory) {
      result =
        activeCategory === 'linear'
          ? result.filter((opt) => opt.measurement_class === 'linear')
          : result.filter((opt) => opt.trim_category === activeCategory)
    }

    // Filter by search
    if (search.trim()) {
      result = result.filter((opt) => matchesSearch(opt, search))
    }

    return result
  }, [normalizedOptions, activeCategory, search])

  const grouped = useMemo(() => {
    const groups = new Map<string, PickerOption[]>()
    for (const opt of filtered) {
      const groupKey = opt.trim_category
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(opt)
    }
    // Sort groups by a defined order
    const groupOrder: string[] = CATEGORY_CHIPS.map((c) => c.key).filter((k) => k && k !== 'linear')
    return Array.from(groups.entries()).sort(([a], [b]) => {
      const ai = groupOrder.indexOf(a)
      const bi = groupOrder.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }, [filtered])

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id)
      setIsOpen(false)
      setSearch('')
    },
    [onChange]
  )

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setSearch('')
      }
    },
    []
  )

  return (
    <div ref={containerRef} style={{ position: 'relative' }} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        className="trim-type-picker-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          ...styles.input,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          width: '100%',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? (
            <>
              {selectedOption.label || selectedOption.id}
              {selectedOption.trim_category ? (
                <span
                  style={{
                    ...styles.mono,
                    fontSize: '0.75em',
                    color: 'var(--v2-ink-3)',
                    marginLeft: 8,
                  }}
                >
                  {getCategoryLabel(selectedOption.trim_category)}
                </span>
              ) : null}
            </>
          ) : (
            <span style={{ color: 'var(--v2-ink-3)' }}>-- select trim type --</span>
          )}
        </span>
        <span style={{ ...styles.mono, fontSize: '0.75em', color: 'var(--v2-ink-3)', flexShrink: 0 }}>
          {isOpen ? '^' : 'v'}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            marginTop: 4,
            background: '#1a1a1a',
            border: '1px solid var(--v2-line)',
            borderRadius: 8,
            maxHeight: 400,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {/* Search input */}
          <div style={{ padding: '8px 8px 0' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search trim types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...styles.input,
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Category chips */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '6px 8px',
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--v2-line)',
            }}
          >
            {CATEGORY_CHIPS.map((chip) => {
              const isActive = activeCategory === chip.key
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setActiveCategory(chip.key)}
                  style={{
                    ...styles.mono,
                    fontSize: '0.75em',
                    padding: '3px 8px',
                    borderRadius: 12,
                    border: `1px solid ${isActive ? 'var(--v2-accent)' : 'var(--v2-line)'}`,
                    background: isActive ? 'var(--v2-accent)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--v2-ink-2)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          {/* Options list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {grouped.length === 0 ? (
              <div
                style={{
                  ...styles.mono,
                  padding: 16,
                  textAlign: 'center',
                  color: 'var(--v2-ink-3)',
                }}
              >
                No matching trim types
              </div>
            ) : (
              grouped.map(([groupKey, groupOptions]) => (
                <div key={groupKey}>
                  {/* Group header */}
                  <div
                    style={{
                      ...styles.mono,
                      fontSize: '0.75em',
                      padding: '6px 10px',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--v2-ink-3)',
                      borderBottom: '1px solid var(--v2-line)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {getCategoryLabel(groupKey)}
                  </div>

                  {/* Group options */}
                  {groupOptions.map((opt) => {
                    const isSelected = opt.id === value
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelect(opt.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          padding: '8px 10px',
                          border: 'none',
                          borderBottom: '1px solid var(--v2-line)',
                          background: isSelected
                            ? 'rgba(255,255,255,0.08)'
                            : 'transparent',
                          color: 'var(--v2-ink)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: isSelected ? 700 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {opt.label || opt.id}
                          </div>
                          <div
                            style={{
                              ...styles.mono,
                              fontSize: '0.75em',
                              color: 'var(--v2-ink-3)',
                              display: 'flex',
                              gap: 8,
                              marginTop: 2,
                            }}
                          >
                            <span>{opt.id}</span>
                            {opt.unit_type ? <span>{opt.unit_type}</span> : null}
                            {opt.default_production_rate_id ? (
                              <span>rate: {opt.default_production_rate_id}</span>
                            ) : null}
                          </div>
                        </div>
                        <div
                          style={{
                            ...styles.mono,
                            fontSize: '0.7em',
                            color: 'var(--v2-ink-3)',
                            textAlign: 'right',
                            flexShrink: 0,
                          }}
                        >
                          {getMeasurementClassLabel(opt.measurement_class)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
