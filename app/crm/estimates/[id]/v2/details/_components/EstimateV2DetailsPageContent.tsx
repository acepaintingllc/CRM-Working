'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import {
  estimateRouteFamily,
  quoteRouteFamily,
  type EstimateRouteFamily,
} from '../../../estimateRouteFamily'
import {
  type DetailsRollerCoverOption,
  type DetailsRollerVm,
  type DetailsScopeLineVm,
} from '../_lib/estimateV2DetailsVm'
import { useEstimateV2DetailsPage } from '../_state/useEstimateV2DetailsPage'

const C = {
  bg: '#080d0a',
  card: '#0f1712',
  panel: '#111d16',
  border: '#213328',
  borderStrong: '#35634b',
  ink: '#eef7f0',
  ink2: '#b9c8be',
  ink3: '#74857b',
  green: '#7ee0ad',
  red: '#fb917f',
  amber: '#f7c66b',
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "'Inter', system-ui, sans-serif",
}

const card: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  overflow: 'hidden',
}

const sectionHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: '14px 16px',
  borderBottom: `1px solid ${C.border}`,
}

const input: CSSProperties = {
  width: '100%',
  minWidth: 0,
  border: `1px solid ${C.border}`,
  background: '#0b120e',
  color: C.ink,
  borderRadius: 6,
  padding: '8px 9px',
  fontSize: 12,
  fontWeight: 700,
  outline: 'none',
}

const th: CSSProperties = {
  color: C.ink3,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

function fmt(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

function Section({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <section style={card}>
      <div style={sectionHeader}>
        <h2 style={{ margin: 0, fontSize: 15, color: C.ink }}>{title}</h2>
        {meta && <div style={{ color: C.ink3, fontSize: 12 }}>{meta}</div>}
      </div>
      {children}
    </section>
  )
}

function RollerSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: DetailsRollerCoverOption[]
  onChange: (value: string) => void
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} style={input}>
      <option value="">Select cover</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function RollerRows({
  rows,
  options,
  onChange,
}: {
  rows: DetailsRollerVm[]
  options: DetailsRollerCoverOption[]
  onChange: (id: string, patch: Partial<{ coverId: string; quantity: string; notes: string }>) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 10, padding: 16 }}>
      {rows.map((row) => (
        <div
          key={row.id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(150px, 1.2fr) minmax(160px, 1fr) 82px minmax(120px, 1fr)',
            gap: 10,
            alignItems: 'start',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{row.label}</div>
            <div style={{ color: C.ink3, fontSize: 11 }}>
              {row.sublabel} · {fmt(row.sqFt)} sqft · {row.product}
            </div>
          </div>
          <RollerSelect value={row.coverId} options={options} onChange={(coverId) => onChange(row.id, { coverId })} />
          <input
            aria-label={`${row.label} quantity`}
            value={row.quantity}
            onChange={(event) => onChange(row.id, { quantity: event.target.value })}
            style={input}
            placeholder="Qty"
            inputMode="decimal"
          />
          <input
            aria-label={`${row.label} notes`}
            value={row.notes}
            onChange={(event) => onChange(row.id, { notes: event.target.value })}
            style={input}
            placeholder="Notes"
          />
          {row.errors.length > 0 && (
            <div style={{ gridColumn: '2 / -1', color: C.red, fontSize: 11 }}>{row.errors.join(' · ')}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function MaterialTable({
  rows,
  onOverride,
}: {
  rows: DetailsScopeLineVm[]
  onOverride: (row: DetailsScopeLineVm, value: string) => void
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 980 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 150px 190px 80px 70px 150px 90px 90px 110px 90px',
            gap: 12,
            padding: '11px 14px',
            background: '#0b120e',
          }}
        >
          {['Color', 'Name', 'Rooms', 'Sq Ft', 'Coats', 'Product', 'Calc Gal', 'Rnd Gal', 'Override', 'Final'].map((label) => (
            <div key={label} style={th}>{label}</div>
          ))}
        </div>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '110px 150px 190px 80px 70px 150px 90px 90px 110px 90px',
              gap: 12,
              alignItems: 'center',
              padding: '12px 14px',
              borderTop: `1px solid ${C.border}`,
              background: row.hasOverride ? 'rgba(126,224,173,0.08)' : 'transparent',
              fontSize: 12,
            }}
          >
            <strong>{row.label}</strong>
            <div style={{ color: C.ink2 }}>{row.colorName || '-'}</div>
            <div style={{ color: C.ink2 }}>{row.rooms.join(' · ') || '-'}</div>
            <div>{fmt(row.sqFt)}</div>
            <div>{row.coats}</div>
            <div>
              {row.product}
              {row.productWarning && <div style={{ color: C.amber, fontSize: 10 }}>{row.productWarning}</div>}
            </div>
            <div>{fmt(row.calculatedGallons)}</div>
            <strong>{fmt(row.roundedGallons)}</strong>
            <input
              aria-label={`${row.label} override gallons`}
              value={row.overrideGallons}
              onChange={(event) => onOverride(row, event.target.value)}
              style={{ ...input, borderColor: row.hasOverride ? C.borderStrong : C.border, color: row.hasOverride ? C.green : C.ink }}
              inputMode="decimal"
            />
            <strong style={{ color: row.hasOverride ? C.green : C.ink }}>{fmt(row.finalGallons)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EstimateV2DetailsPageContent({
  estimateId,
  routeFamilyKey = 'estimate',
  routeFamily,
}: {
  estimateId: string
  routeFamilyKey?: 'estimate' | 'quote'
  routeFamily?: EstimateRouteFamily
}) {
  const resolvedRouteFamily =
    routeFamily ?? (routeFamilyKey === 'quote' ? quoteRouteFamily : estimateRouteFamily)
  const page = useEstimateV2DetailsPage({ estimateId, routeFamily: resolvedRouteFamily })
  const { vm, actions } = page

  if (page.loading) {
    return <div style={{ minHeight: '100vh', background: C.bg, color: C.ink3, display: 'grid', placeItems: 'center' }}>Loading details...</div>
  }

  if (page.error) {
    return <div role="alert" style={{ minHeight: '100vh', background: C.bg, color: C.red, display: 'grid', placeItems: 'center' }}>{page.error.message}</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: C.sans }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 16,
          alignItems: 'center',
          padding: '14px 22px',
          background: 'rgba(8,13,10,0.95)',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
          <Link href={resolvedRouteFamily.editorHref(estimateId)} style={{ color: C.ink2, textDecoration: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px' }}>
            Back
          </Link>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>Details & Overrides</h1>
            <div style={{ color: C.ink3, fontSize: 13 }}>Material planning and final adjustments</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => void actions.saveDraft()} disabled={page.saving} style={{ ...input, width: 112, cursor: 'pointer' }}>
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => void actions.continueToSummary()}
            disabled={page.saving}
            style={{ ...input, width: 190, cursor: 'pointer', background: C.green, color: '#062014', borderColor: C.green }}
          >
            Continue to Summary
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, padding: 22, alignItems: 'start' }}>
        <main style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <Section title="Rollers & Applicators" meta={`${vm.wallRollerRows.length + (vm.ceilingRollerRow ? 1 : 0)} required rows`}>
            <div style={{ padding: '14px 16px 0', ...th }}>Wall Rollers</div>
            <RollerRows rows={vm.wallRollerRows} options={vm.wallRollerOptions} onChange={actions.setRollerRow} />
            {vm.ceilingRollerRow && (
              <>
                <div style={{ padding: '0 16px', ...th }}>Ceiling Rollers</div>
                <RollerRows rows={[vm.ceilingRollerRow]} options={vm.ceilingRollerOptions} onChange={actions.setRollerRow} />
              </>
            )}
            {vm.trimApplicatorRow && (
              <div style={{ padding: '0 16px 16px', color: C.ink3, fontSize: 12 }}>
                Trim applicator catalog is not available in Rates/Flags, so trim applicator choice is page-local for this pass.
              </div>
            )}
          </Section>

          <Section title="Material Overview" meta="Live totals">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, padding: 16 }}>
              {vm.materialCards.map((item) => (
                <div key={item.label} style={{ border: `1px solid ${item.overridden ? C.borderStrong : C.border}`, borderRadius: 6, padding: 14, background: item.overridden ? 'rgba(126,224,173,0.08)' : C.panel }}>
                  <div style={th}>{item.label}</div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{item.finalValue}</div>
                  <div style={{ marginTop: 6, color: C.ink3, fontSize: 11 }}>{item.calculatedValue}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Wall Paint Planning" meta={`${vm.wallRows.length} active colors`}>
            <MaterialTable rows={vm.wallRows} onOverride={(row, value) => actions.setWallOverride(row.colorId ?? row.id, value)} />
          </Section>

          {vm.ceilingRow && (
            <Section title="Ceiling Breakdown" meta={`${fmt(vm.ceilingRow.sqFt)} sqft`}>
              <MaterialTable rows={[vm.ceilingRow]} onOverride={(_, value) => actions.setCeilingOverride(value)} />
            </Section>
          )}

          {vm.trimRow && (
            <Section title="Trim Setup" meta="Paint gallons">
              <MaterialTable rows={[vm.trimRow]} onOverride={(_, value) => actions.setTrimOverride(value)} />
            </Section>
          )}

          <Section title="Advanced Overrides" meta="Reasons required before summary">
            {vm.activeOverrides.length === 0 ? (
              <div style={{ padding: 16, color: C.ink3, fontSize: 13 }}>No advanced overrides applied</div>
            ) : (
              <div style={{ display: 'grid', gap: 10, padding: 16 }}>
                {vm.activeOverrides.map((override) => (
                  <div key={override.key} style={{ display: 'grid', gridTemplateColumns: '180px 130px minmax(200px, 1fr)', gap: 10, alignItems: 'center' }}>
                    <strong>{override.itemName}</strong>
                    <div style={{ color: C.green }}>{fmt(override.originalValue)} → {fmt(override.newValue)} gal</div>
                    <input value={override.reason} onChange={(event) => actions.setOverrideReason(override.key, event.target.value)} style={input} placeholder="Reason / justification" />
                  </div>
                ))}
              </div>
            )}
          </Section>
        </main>

        <aside style={{ ...card, position: 'sticky', top: 84 }}>
          <div style={sectionHeader}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>Summary Rail</h2>
              <div style={{ color: C.ink3, fontSize: 12 }}>{page.estimate?.version_name ?? 'Estimate'}</div>
            </div>
          </div>
          <div style={{ padding: 16, display: 'grid', gap: 16 }}>
            <div>
              <div style={th}>Validation</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {vm.validationIssues.length === 0 ? (
                  <div style={{ color: C.green }}>Ready to continue</div>
                ) : (
                  vm.validationIssues.map((issue) => <div key={issue} style={{ color: C.red, fontSize: 12 }}>{issue}</div>)
                )}
              </div>
            </div>
            <div>
              <div style={th}>Active Overrides</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {vm.activeOverrides.length === 0 ? <div style={{ color: C.ink3 }}>None</div> : vm.activeOverrides.map((override) => <div key={override.key}>{override.itemName}: <strong style={{ color: C.green }}>{fmt(override.newValue)} gal</strong></div>)}
              </div>
            </div>
            <div>
              <div style={th}>Gallons By Scope</div>
              {[
                ['Walls', vm.gallonsByScope.walls],
                ['Ceilings', vm.gallonsByScope.ceilings],
                ['Trim', vm.gallonsByScope.trim],
                ['Total', vm.gallonsByScope.total],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span>{label}</span>
                  <strong>{fmt(Number(value))}</strong>
                </div>
              ))}
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, background: C.panel }}>
              <div style={th}>Estimated Material Cost</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>${Math.round(vm.estimatedMaterialCost).toLocaleString('en-US')}</div>
            </div>
            <button type="button" onClick={() => void actions.continueToSummary()} disabled={page.saving} style={{ ...input, cursor: 'pointer', background: vm.validationIssues.length ? '#26352b' : C.green, color: vm.validationIssues.length ? C.ink3 : '#062014', borderColor: vm.validationIssues.length ? C.border : C.green }}>
              Continue to Summary
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
