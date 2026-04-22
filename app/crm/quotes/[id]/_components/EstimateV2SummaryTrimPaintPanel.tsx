'use client'

import type { CSSProperties } from 'react'
import { fmtGallons, fmtUSD } from '../summary/_lib/estimateV2SummaryFormat'
import type { EstimateV2TrimPaint } from '@/types/estimator/v2'

type TrimPaintVm = {
  draft: {
    trimPaintProductId: string
    trimPaintGallons: number
    trimPaintQuarts: number
  }
  update: (patch: Partial<{
    trimPaintProductId: string
    trimPaintGallons: number
    trimPaintQuarts: number
  }>) => void
}

export function EstimateV2SummaryTrimPaintPanel({
  vm,
  trimPaint,
  hasTrimPaint,
  resolvePaintProductLabel,
  card,
  inputStyle,
  colors,
}: {
  vm: TrimPaintVm
  trimPaint: EstimateV2TrimPaint | null
  hasTrimPaint: boolean
  resolvePaintProductLabel: (productId?: string | null, fallbackLabel?: string | null) => string
  card: CSSProperties
  inputStyle: CSSProperties
  colors: { ink: string; ink3: string; green: string; cardDark: string; border: string; radiusSm: number }
}) {
  if (!hasTrimPaint) return null

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.ink3 }}>Trim Paint</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: colors.ink, lineHeight: 1.2 }}>
            {resolvePaintProductLabel(trimPaint?.paint_product_id, trimPaint?.paint_product_label)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: colors.ink3 }}>Cost</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: colors.green }}>{fmtUSD(trimPaint?.paint_cost)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: colors.ink3, marginBottom: 4, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Paint Product</div>
          <input
            aria-label="Trim paint product"
            type="text"
            value={vm.draft.trimPaintProductId}
            onChange={(e) => vm.update({ trimPaintProductId: e.target.value.trim() })}
            placeholder="Product"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: colors.ink3, marginBottom: 4, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Gallons</div>
            <input
              aria-label="Trim paint gallons"
              type="number"
              min={0}
              step={1}
              value={vm.draft.trimPaintGallons}
              onChange={(e) => vm.update({ trimPaintGallons: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: colors.ink3, marginBottom: 4, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Quarts</div>
            <input
              aria-label="Trim paint quarts"
              type="number"
              min={0}
              max={3}
              step={1}
              value={vm.draft.trimPaintQuarts}
              onChange={(e) => vm.update({ trimPaintQuarts: Math.min(3, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
              style={inputStyle}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {[
            { label: 'Gallons', val: String(trimPaint?.gallons ?? 0) },
            { label: 'Normalized', val: fmtGallons(trimPaint?.normalized_gallons) },
          ].map((item) => (
            <div key={item.label} style={{ background: colors.cardDark, border: `1px solid ${colors.border}`, borderRadius: colors.radiusSm, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, color: colors.ink3, marginBottom: 3, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: colors.ink, fontVariantNumeric: 'tabular-nums' }}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
