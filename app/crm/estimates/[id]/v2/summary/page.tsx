'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { reconcileWholeDollarRows } from '@/lib/estimator/pricingPolicies'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

type PricingSummary = {
  rawLaborHours: number
  rawLaborDays: number
  effectiveLaborDays: number
  effectiveLaborHours: number
  laborCost: number
  wallPaintMaterialCost: number
  ceilingPaintMaterialCost: number
  trimPaintMaterialCost: number
  paintMaterialCost: number
  primerMaterialCost: number
  supplyCost: number
  prePolicyTotal: number
  postLaborPolicyTotal: number
  minimumAdjustmentAmount: number
  finalTotal: number
  rooms: { room_id: string; baseTotal: number; allocatedMinimumAdjustment: number; finalTotal: number }[]
  trimPaint: {
    paint_product_id: string | null
    paint_product_label: string | null
    gallons: number
    quarts: number
    normalized_gallons: number
    paint_cost: number
  } | null
}

type JobSettings = {
  labor_day_policy_enabled?: boolean | null
  dayhours?: number | null
  rounding_increment_hours?: number | null
  override_labor_rate?: number | null
  job_minimum_enabled?: boolean | null
  job_minimum_amount?: number | null
}

type PaintProductRow = {
  id: string
  label?: string | null
  display_name?: string | null
  display_id?: string | null
  name?: string | null
  type?: string | null
}

type RoomRow = { id: string; room_id: string; room_name?: string | null }

type WallScopeRow = {
  id: string
  room_id: string
  scope_name?: string | null
  include?: string | null
  effective_area_sf?: number | null
  effective_paint_hours?: number | null
  effective_primer_hours?: number | null
  effective_supply_cost?: number | null
  effective_total?: number | null
  override_area_sf?: number | null
  override_paint_hours?: number | null
  override_primer_hours?: number | null
  override_paint_gallons?: number | null
  override_primer_gallons?: number | null
  override_supply_cost?: number | null
  override_total?: number | null
  paint_product_id?: string | null
  paint_product_label?: string | null
  raw_paint_gallons?: number | null
  allocated_paint_gallons?: number | null
  allocated_paint_material_cost?: number | null
  raw_total?: number | null
  effective_total_before_override?: number | null
}

type CeilingScopeRow = WallScopeRow

type TrimScopeRow = {
  id: string
  room_id: string
  scope_name?: string | null
  include?: string | null
  effective_measurement?: number | null
  effective_paint_hours?: number | null
  effective_primer_hours?: number | null
  effective_supply_cost?: number | null
  effective_total?: number | null
  raw_total?: number | null
  effective_total_before_override?: number | null
  override_measurement?: number | null
  override_hours?: number | null
  override_gallons?: number | null
  override_supply_cost?: number | null
  override_total?: number | null
  override_description?: string | null
}

type RoomFlagRow = {
  id: string
  room_id: string
  flag_id: string
  position?: number | null
}

type WallRoomTotal = {
  room_id: string
  effective_area_sf: number
  effective_total: number
}

type EstimateMeta = {
  id: string
  job_id: string
  version_name: string | null
  version_state: string | null
}

type PageData = {
  estimate: EstimateMeta
  inputs: {
    jobsettings?: JobSettings
    paint_products?: PaintProductRow[]
    rooms?: RoomRow[]
    room_wall_scopes?: WallScopeRow[]
    room_flags?: RoomFlagRow[]
  }
  wall_calculations?: {
    scopes?: WallScopeRow[]
    room_totals?: WallRoomTotal[]
  }
  ceiling_calculations?: {
    scopes?: CeilingScopeRow[]
    room_totals?: WallRoomTotal[]
  }
  trim_calculations?: {
    scopes?: TrimScopeRow[]
    room_totals?: WallRoomTotal[]
  }
  trim_paint?: PricingSummary['trimPaint']
  pricing_summary?: PricingSummary
}

type JobData = {
  customer_name?: string | null
  customer_address?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  title?: string | null
}

const C = {
  bg: '#0a0a0a',
  card: '#1a1a1a',
  cardDark: '#131313',
  border: '#262626',
  borderFocus: '#484848',
  ink: '#f5f5f5',
  ink2: '#c5c5c5',
  ink3: '#9a9a9a',
  inkSub: '#b0b0b0',
  green: '#84cc93',
  radius: 12,
  radiusSm: 6,
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "'Inter', system-ui, sans-serif",
}

const card: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: C.radius,
  padding: '16px 16px',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: C.radiusSm,
  border: `1px solid ${C.borderFocus}`,
  background: C.cardDark,
  color: C.ink,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: C.mono,
  outline: 'none',
  appearance: 'none',
}

function fmtH(n: number | null | undefined) {
  if (!n || n === 0) return '-'
  return `${n.toFixed(1)}h`
}

function fmtD(n: number | null | undefined) {
  if (n == null) return '-'
  return `${n.toFixed(1)}d`
}

function fmtUSD(n: number | null | undefined) {
  if (n == null) return '-'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function fmtGallons(n: number | null | undefined) {
  if (n == null) return '-'
  return `${n.toFixed(2)} gal`
}

function fmtNumber(n: number | null | undefined, digits = 2) {
  if (n == null) return '-'
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '-'
  return `${Math.round(n * 100)}%`
}

function roomLabel(room: RoomRow) {
  return room.room_name ?? room.room_id
}

function asMaybeNumber(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function roomScopeTypeLabel(kind: 'walls' | 'ceilings' | 'trim') {
  if (kind === 'walls') return 'Walls'
  if (kind === 'ceilings') return 'Ceilings'
  return 'Trim'
}

function hasMeaningfulScopeContent(scope: {
  scope_name?: string | null
  effective_area_sf?: number | null
  effective_measurement?: number | null
  raw_paint_gallons?: number | null
  allocated_paint_material_cost?: number | null
  effective_total?: number | null
}) {
  const hasName = !!scope.scope_name?.trim()
  const hasValue =
    (scope.effective_area_sf ?? 0) > 0 ||
    (scope.effective_measurement ?? 0) > 0 ||
    (scope.raw_paint_gallons ?? 0) > 0 ||
    (scope.allocated_paint_material_cost ?? 0) > 0 ||
    (scope.effective_total ?? 0) > 0
  return hasName || hasValue
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: on ? C.green : '#333',
        position: 'relative',
        flexShrink: 0,
        cursor: 'pointer',
        border: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 19 : 3,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: on ? C.cardDark : '#666',
          transition: 'left 0.15s',
          display: 'block',
        }}
      />
    </button>
  )
}

export default function EstimateSummaryPage() {
  const params = useParams()
  const estimateId = typeof params?.id === 'string' ? params.id : ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PageData | null>(null)
  const [job, setJob] = useState<JobData | null>(null)

  const [laborDayEnabled, setLaborDayEnabled] = useState(true)
  const [dayhours, setDayhours] = useState(8)
  const [roundIncrement, setRoundIncrement] = useState(4)
  const [laborRate, setLaborRate] = useState(65)
  const [jobMinEnabled, setJobMinEnabled] = useState(false)
  const [jobMinAmount, setJobMinAmount] = useState(0)
  const [trimPaintProductId, setTrimPaintProductId] = useState('')
  const [trimPaintGallons, setTrimPaintGallons] = useState(0)
  const [trimPaintQuarts, setTrimPaintQuarts] = useState(0)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [policySaving, setPolicySaving] = useState(false)
  const [openRooms, setOpenRooms] = useState<Record<string, boolean>>({})

  const policyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!estimateId) return
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)

      const res = await authedFetch(`/api/estimates/${estimateId}`, { cache: 'no-store' })
      const payload = (await res.json().catch(() => null)) as PageData | { error?: string } | null

      if (!active) return
      if (!res.ok || !payload || !('estimate' in payload)) {
        setError((payload as { error?: string } | null)?.error ?? 'Failed to load estimate')
        setLoading(false)
        return
      }

      const p = payload as PageData
      setData(p)

      const js = p.inputs?.jobsettings
      if (js) {
        setLaborDayEnabled(js.labor_day_policy_enabled !== false)
        setDayhours(js.dayhours ?? 8)
        setRoundIncrement(js.rounding_increment_hours ?? 4)
        setLaborRate(js.override_labor_rate ?? 40)
        setJobMinEnabled(js.job_minimum_enabled === true)
        setJobMinAmount(js.job_minimum_amount ?? 0)
      }

      if (p.trim_paint) {
        setTrimPaintProductId(p.trim_paint.paint_product_id ?? '')
        setTrimPaintGallons(p.trim_paint.gallons ?? 0)
        setTrimPaintQuarts(p.trim_paint.quarts ?? 0)
      }

      const jobRes = await authedFetch(`/api/jobs/${p.estimate.job_id}`, { cache: 'no-store' })
      const jobPayload = (await jobRes.json().catch(() => null)) as { job?: JobData } | null
      if (!active) return
      if (jobRes.ok && jobPayload?.job) setJob(jobPayload.job)

      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [estimateId])

  const refreshPricing = useCallback(async () => {
    if (!estimateId) return
    const res = await authedFetch(`/api/estimates/${estimateId}`, { cache: 'no-store' })
    const payload = (await res.json().catch(() => null)) as PageData | null
    if (res.ok && payload?.pricing_summary) {
      setData((prev) => (prev ? { ...prev, pricing_summary: payload.pricing_summary } : prev))
      if (payload.trim_paint) {
        setData((prev) => (prev ? { ...prev, trim_paint: payload.trim_paint } : prev))
      }
    }
  }, [estimateId])

  const savePolicyDebounced = useCallback(
    (settings: {
      laborDayEnabled: boolean
      dayhours: number
      roundIncrement: number
      laborRate: number
      jobMinEnabled: boolean
      jobMinAmount: number
    }) => {
      if (policyTimerRef.current) clearTimeout(policyTimerRef.current)
      policyTimerRef.current = setTimeout(async () => {
        if (!estimateId) return
        setPolicySaving(true)
        try {
          await authedFetch(`/api/estimates/${estimateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobsettings: {
                labor_day_policy_enabled: settings.laborDayEnabled,
                dayhours: settings.dayhours,
                rounding_increment_hours: settings.roundIncrement,
                override_labor_rate: settings.laborRate,
                job_minimum_enabled: settings.jobMinEnabled,
                job_minimum_amount: settings.jobMinAmount,
              },
            }),
          })
          await refreshPricing()
        } finally {
          setPolicySaving(false)
        }
      }, 800)
    },
    [estimateId, refreshPricing]
  )

  const saveTrimPaintDebounced = useCallback(
    (next: { trimPaintProductId: string; trimPaintGallons: number; trimPaintQuarts: number }) => {
      if (trimTimerRef.current) clearTimeout(trimTimerRef.current)
      trimTimerRef.current = setTimeout(async () => {
        if (!estimateId) return
        setPolicySaving(true)
        try {
          await authedFetch(`/api/estimates/${estimateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobsettings: {
                trim_paint_id: next.trimPaintProductId || null,
                trim_paint_gallons: next.trimPaintGallons,
                trim_paint_quarts: next.trimPaintQuarts,
              },
            }),
          })
          await refreshPricing()
        } finally {
          setPolicySaving(false)
        }
      }, 600)
    },
    [estimateId, refreshPricing]
  )

  const ps = data?.pricing_summary ?? null
  const rooms = data?.inputs?.rooms ?? []
  const paintProductsById = useMemo(
    () => new Map((data?.inputs?.paint_products ?? []).map((product) => [product.id, product] as const)),
    [data?.inputs?.paint_products]
  )
  const trimPaint = data?.trim_paint ?? ps?.trimPaint ?? null
  const hasTrimPaint = !!trimPaint && (!!trimPaint.paint_product_id || trimPaint.paint_cost > 0 || trimPaint.normalized_gallons > 0)
  const roomFlags = (data?.inputs?.room_flags ?? []) as RoomFlagRow[]
  const laborRateEffective = ps?.effectiveLaborHours && ps.effectiveLaborHours > 0 ? ps.laborCost / ps.effectiveLaborHours : laborRate

  const resolvePaintProductLabel = useCallback(
    (productId?: string | null, fallbackLabel?: string | null) => {
      if (fallbackLabel?.trim() && !/^[0-9a-f-]{16,}$/i.test(fallbackLabel.trim())) return fallbackLabel
      if (!productId) return '-'
      const product = paintProductsById.get(productId)
      const label =
        product?.display_name?.trim() ||
        product?.display_id?.trim() ||
        product?.label?.trim() ||
        product?.name?.trim() ||
        ''
      if (label && !/^[0-9a-f-]{16,}$/i.test(label)) return label
      if (!/^[0-9a-f-]{16,}$/i.test(productId)) return productId
      return 'Paint product'
    },
    [paintProductsById]
  )

  const wallScopes = data?.wall_calculations?.scopes ?? data?.inputs?.room_wall_scopes ?? []
  const ceilingScopes = data?.ceiling_calculations?.scopes ?? []
  const trimScopes = data?.trim_calculations?.scopes ?? []

  const roomTotalMap = useMemo(() => {
    const next = new Map<string, number>()
    for (const r of ps?.rooms ?? []) next.set(r.room_id, r.finalTotal)
    return next
  }, [ps?.rooms])

  const displayRoomTotalMap = useMemo(() => {
    const rows = (ps?.rooms ?? []).map((room) => ({ room_id: room.room_id, price: room.finalTotal }))
    return new Map(
      reconcileWholeDollarRows(rows, ps?.finalTotal ?? null).map((row) => [row.room_id, row.price] as const)
    )
  }, [ps?.finalTotal, ps?.rooms])

  const roomAreaMap = useMemo(() => {
    const next = new Map<string, number>()
    for (const room of data?.wall_calculations?.room_totals ?? []) next.set(room.room_id, room.effective_area_sf)
    return next
  }, [data?.wall_calculations?.room_totals])

  const roomFlagCountMap = useMemo(() => {
    const next = new Map<string, number>()
    for (const flag of roomFlags) {
      next.set(flag.room_id, (next.get(flag.room_id) ?? 0) + 1)
    }
    return next
  }, [roomFlags])

  type RoomScopeSummary = {
    id: string
    roomId: string
    kind: 'walls' | 'ceilings' | 'trim'
    label: string
    quantity: number | null
    laborHours: number | null
    paintCost: number | null
    suppliesCost: number | null
    subtotal: number | null
    hasOverride: boolean
    missingProduct: boolean
  }

  const roomScopeRows = useMemo(() => {
    const next = new Map<string, RoomScopeSummary[]>()

    const push = (roomId: string, row: RoomScopeSummary) => {
      const list = next.get(roomId) ?? []
      list.push(row)
      next.set(roomId, list)
    }

    for (const scope of wallScopes) {
      if (scope.include === 'N' || !hasMeaningfulScopeContent(scope)) continue
      push(scope.room_id, {
        id: scope.id,
        roomId: scope.room_id,
        kind: 'walls',
        label: scope.scope_name?.trim() || 'Walls',
        quantity: asMaybeNumber(scope.effective_area_sf),
        laborHours: (asMaybeNumber(scope.effective_paint_hours) ?? 0) + (asMaybeNumber(scope.effective_primer_hours) ?? 0),
        paintCost: asMaybeNumber(scope.allocated_paint_material_cost),
        suppliesCost: asMaybeNumber(scope.effective_supply_cost),
        subtotal: asMaybeNumber(scope.effective_total),
        hasOverride:
          scope.override_area_sf != null ||
          scope.override_paint_hours != null ||
          scope.override_primer_hours != null ||
          scope.override_paint_gallons != null ||
          scope.override_primer_gallons != null ||
          scope.override_supply_cost != null ||
          scope.override_total != null,
        missingProduct: !scope.paint_product_id && !scope.paint_product_label,
      })
    }

    for (const scope of ceilingScopes) {
      if (scope.include === 'N' || !hasMeaningfulScopeContent(scope)) continue
      push(scope.room_id, {
        id: scope.id,
        roomId: scope.room_id,
        kind: 'ceilings',
        label: scope.scope_name?.trim() || 'Ceilings',
        quantity: asMaybeNumber(scope.effective_area_sf),
        laborHours: (asMaybeNumber(scope.effective_paint_hours) ?? 0) + (asMaybeNumber(scope.effective_primer_hours) ?? 0),
        paintCost: asMaybeNumber(scope.allocated_paint_material_cost),
        suppliesCost: asMaybeNumber(scope.effective_supply_cost),
        subtotal: asMaybeNumber(scope.effective_total),
        hasOverride:
          scope.override_area_sf != null ||
          scope.override_paint_hours != null ||
          scope.override_primer_hours != null ||
          scope.override_paint_gallons != null ||
          scope.override_primer_gallons != null ||
          scope.override_supply_cost != null ||
          scope.override_total != null,
        missingProduct: !scope.paint_product_id && !scope.paint_product_label,
      })
    }

    for (const scope of trimScopes) {
      if (scope.include === 'N' || !hasMeaningfulScopeContent(scope)) continue
      push(scope.room_id, {
        id: scope.id,
        roomId: scope.room_id,
        kind: 'trim',
        label: scope.scope_name?.trim() || 'Trim',
        quantity: asMaybeNumber(scope.effective_measurement),
        laborHours: (asMaybeNumber(scope.effective_paint_hours) ?? 0) + (asMaybeNumber(scope.effective_primer_hours) ?? 0),
        paintCost: null,
        suppliesCost: asMaybeNumber(scope.effective_supply_cost),
        subtotal: asMaybeNumber(scope.effective_total),
        hasOverride:
          scope.override_measurement != null ||
          scope.override_hours != null ||
          scope.override_gallons != null ||
          scope.override_supply_cost != null ||
          scope.override_total != null ||
          !!scope.override_description,
        missingProduct: false,
      })
    }

    const kindOrder: Record<RoomScopeSummary['kind'], number> = { walls: 0, ceilings: 1, trim: 2 }
    for (const [roomId, rows] of next.entries()) {
      rows.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.label.localeCompare(b.label))
      next.set(roomId, rows)
    }

    return next
  }, [ceilingScopes, trimScopes, wallScopes])

  const roomAlertsByRoom = useMemo(() => {
    const next = new Map<string, { missingProduct: number; overrides: number; flags: number }>()
    for (const room of rooms) next.set(room.room_id, { missingProduct: 0, overrides: 0, flags: roomFlagCountMap.get(room.room_id) ?? 0 })
    for (const row of roomScopeRows.values()) {
      for (const scope of row) {
        const current = next.get(scope.roomId) ?? { missingProduct: 0, overrides: 0, flags: 0 }
        if (scope.missingProduct) current.missingProduct += 1
        if (scope.hasOverride) current.overrides += 1
        next.set(scope.roomId, current)
      }
    }
    return next
  }, [roomFlagCountMap, roomScopeRows, rooms])

  const roomBlocks = useMemo(
    () =>
      rooms.map((room) => {
        const scopeRows = roomScopeRows.get(room.room_id) ?? []
        const roomTotal = roomTotalMap.get(room.room_id) ?? null
        const displayRoomTotal = displayRoomTotalMap.get(room.room_id) ?? roomTotal
        const roomPct = displayRoomTotal != null && ps?.finalTotal ? displayRoomTotal / Math.round(ps.finalTotal) : null
        const roomArea = roomAreaMap.get(room.room_id) ?? null
        const totals = scopeRows.reduce(
          (acc, scope) => {
            acc.labor += scope.laborHours ?? 0
            acc.paint += displayScopePaintCost(scope) ?? 0
            acc.supplies += scope.suppliesCost ?? 0
            return acc
          },
          { labor: 0, paint: 0, supplies: 0 }
        )
        const displayScopeRows = reconcileWholeDollarRows(
          scopeRows
            .filter((scope) => scope.subtotal != null)
            .map((scope) => ({
              ...scope,
              price: scope.subtotal ?? 0,
            })),
          displayRoomTotal ?? null
        )
        const displayScopeSubtotalMap = new Map(displayScopeRows.map((scope) => [scope.id, scope.price] as const))
        const scopes = Array.from(new Set(scopeRows.map((scope) => roomScopeTypeLabel(scope.kind))))
        const alerts = roomAlertsByRoom.get(room.room_id) ?? { missingProduct: 0, overrides: 0, flags: 0 }
        const flagsLabel =
          alerts.missingProduct || alerts.overrides || alerts.flags
            ? [
                alerts.missingProduct ? `${alerts.missingProduct} missing` : null,
                alerts.overrides ? `${alerts.overrides} override${alerts.overrides === 1 ? '' : 's'}` : null,
                alerts.flags ? `${alerts.flags} flag${alerts.flags === 1 ? '' : 's'}` : null,
              ]
                .filter(Boolean)
                .join(' | ')
            : 'None'

        return {
          room,
          scopeRows,
          displayScopeSubtotalMap,
          scopes,
          roomArea,
          roomTotal: displayRoomTotal,
          roomPct,
          totals,
          flagsLabel,
          alerts,
        }
      }),
    [displayRoomTotalMap, ps?.finalTotal, roomAlertsByRoom, roomAreaMap, roomScopeRows, roomTotalMap, rooms]
  )

  function displayScopePaintCost(scope: RoomScopeSummary) {
    return scope.paintCost != null
      ? scope.paintCost
      : scope.subtotal != null
        ? Math.max(scope.subtotal - (scope.laborHours ?? 0) * laborRateEffective - (scope.suppliesCost ?? 0), 0)
        : null
  }

  const pricingKpis = useMemo(
    () => ({
      finalTotal: ps?.finalTotal ?? null,
      laborHours: ps?.effectiveLaborHours ?? null,
      laborDays: ps?.effectiveLaborHours != null ? ps.effectiveLaborHours / 8 : null,
      laborCost: ps?.laborCost ?? null,
      suppliesCost: ps?.supplyCost ?? null,
      rooms: rooms.length,
      laborRate: laborRateEffective,
    }),
    [laborRateEffective, ps?.effectiveLaborHours, ps?.finalTotal, ps?.laborCost, ps?.supplyCost, rooms.length]
  )

  const summaryAlerts = useMemo(() => {
    const alerts: { kind: 'warn' | 'info' | 'error'; title: string; detail: string }[] = []
    const firstMissingProduct = [...roomScopeRows.values()].flat().find((scope) => scope.missingProduct)
    const firstOverride = [...roomScopeRows.values()].flat().find((scope) => scope.hasOverride)
    const missingProductCount = [...roomScopeRows.values()].flat().filter((scope) => scope.missingProduct).length
    const overrideCount = [...roomScopeRows.values()].flat().filter((scope) => scope.hasOverride).length
    const flagCount = roomFlags.length

    if (!ps || !data?.inputs?.jobsettings) {
      alerts.push({
        kind: 'error',
        title: 'Missing pricing input',
        detail: 'Pricing summary not available',
      })
    } else if (missingProductCount > 0) {
      const roomName = rooms.find((room) => room.room_id === firstMissingProduct?.roomId)
      alerts.push({
        kind: 'error',
        title: 'Missing product selection',
        detail: `${roomName ? roomLabel(roomName) : 'A room'} needs a paint product`,
      })
    }

    if (overrideCount > 0 || data?.inputs?.jobsettings?.override_labor_rate != null) {
      alerts.push({
        kind: 'warn',
        title: 'Manual override detected',
        detail: data?.inputs?.jobsettings?.override_labor_rate != null ? 'Labor rate override active' : 'Scope override active',
      })
    }

    if (flagCount > 0) {
      alerts.push({
        kind: 'warn',
        title: 'Warning flags active',
        detail: `${flagCount} room flag${flagCount === 1 ? '' : 's'} selected`,
      })
    }

    if (alerts.length === 0) {
      alerts.push({
        kind: 'info',
        title: 'No active alerts',
        detail: 'Estimate is currently clean',
      })
    }

    return alerts.slice(0, 4)
  }, [data?.inputs?.jobsettings, ps, roomFlags.length, roomScopeRows, rooms])

  const alertTheme = (kind: 'warn' | 'info' | 'error') => {
    if (kind === 'error') {
      return {
        border: 'rgba(248,113,113,0.34)',
        fill: 'rgba(248,113,113,0.08)',
        accent: '#fca5a5',
      }
    }
    if (kind === 'warn') {
      return {
        border: 'rgba(250,204,21,0.28)',
        fill: 'rgba(250,204,21,0.06)',
        accent: '#fbbf24',
      }
    }
    return {
      border: 'rgba(96,165,250,0.26)',
      fill: 'rgba(96,165,250,0.06)',
      accent: '#93c5fd',
    }
  }

  const shellStyle: CSSProperties = {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top left, rgba(255,255,255,0.03), transparent 28%), linear-gradient(180deg, #0a0a0a 0%, #090909 100%)',
    color: C.ink,
    fontFamily: C.sans,
    display: 'flex',
    flexDirection: 'column',
  }

  const contentShellStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 18,
    padding: '22px 22px 76px',
    minWidth: 0,
  }

  const mainColStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'grid',
    gap: 16,
  }

  const utilityRailStyle: CSSProperties = {
    width: 300,
    flexShrink: 0,
    position: 'sticky',
    top: 54,
    height: 'calc(100vh - 54px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    paddingLeft: 2,
  }

  const kpiGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1.2fr repeat(5, minmax(0, 1fr))',
    gap: 12,
  }

  const summaryGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 16,
  }

  const roomHeaderGrid = 'minmax(230px, 1.35fr) minmax(170px, 1.05fr) 92px 92px 100px 100px 100px 76px 110px'
  const roomDetailGrid = 'minmax(180px, 1.6fr) 110px 92px 100px 100px 100px'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.ink3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.sans }}>
        Loading...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: '#fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.sans }}>
        {error ?? 'Something went wrong'}
      </div>
    )
  }

  const versionName = data.estimate.version_name ?? 'Estimate'
  const statusLabel = data.estimate.version_state ?? 'Draft'
  const finalTotal = ps?.finalTotal ?? null
  const laborShare = ps?.effectiveLaborHours ? finalTotal != null ? finalTotal / ps.effectiveLaborHours : null : null
  const priceAdjustment = ps ? ps.postLaborPolicyTotal - ps.prePolicyTotal : null
  const paintSuppliesTotal =
    (ps?.wallPaintMaterialCost ?? 0) +
    (ps?.ceilingPaintMaterialCost ?? 0) +
    (ps?.trimPaintMaterialCost ?? 0) +
    (ps?.supplyCost ?? 0)

  return (
    <div style={shellStyle}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 22px',
          background: 'rgba(10,10,10,0.94)',
          backdropFilter: 'blur(18px)',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Link href="/crm/estimates/v2" style={{ fontSize: 12, color: C.ink3, textDecoration: 'none', flexShrink: 0 }}>
            Back to Estimates
          </Link>
          <span style={{ color: C.border }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{versionName}</span>
          {job?.customer_name && (
            <>
              <span style={{ color: C.border }}>/</span>
              <span style={{ fontSize: 12, color: C.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.customer_name}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              padding: '4px 8px',
              borderRadius: 999,
              background: 'rgba(249,115,22,0.12)',
              border: '1px solid rgba(249,115,22,0.18)',
              color: '#fbbf24',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {statusLabel}
          </span>
          <Link
            href={`/crm/estimates/${estimateId}/v2`}
            style={{
              padding: '5px 12px',
              borderRadius: C.radiusSm,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.ink3,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Edit
          </Link>
          <Link
            href={`/crm/estimates/${estimateId}/v2/send`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px 14px',
              borderRadius: C.radiusSm,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.ink2,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Send to Client
          </Link>
        </div>
      </header>

      <div style={contentShellStyle}>
        <main style={mainColStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.ink3 }}>
              Internal estimate summary
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' as const }}>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: C.ink }}>{versionName}</h2>
              {(job?.customer_name || job?.customer_address) && (
                <div style={{ color: C.inkSub, fontSize: 13 }}>
                  {[job?.customer_name, job?.customer_address].filter(Boolean).join(' | ')}
                </div>
              )}
            </div>
          </div>

          <section style={kpiGridStyle}>
            <div
              style={{
                ...card,
                background: 'linear-gradient(180deg, rgba(28,28,28,0.96), rgba(20,20,20,0.96))',
                borderColor: 'rgba(132,204,147,0.26)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, marginBottom: 8 }}>
                Final Total
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 900, color: C.green, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {fmtUSD(finalTotal)}
              </div>
            </div>
            {[
              { label: 'Labor Hours', value: fmtH(ps?.effectiveLaborHours), color: C.ink },
              { label: 'Days', value: fmtD(pricingKpis.laborDays), color: C.ink },
              { label: 'Labor Cost', value: fmtUSD(ps?.laborCost), color: C.ink },
              { label: 'Supplies Cost', value: fmtUSD(ps?.supplyCost), color: C.ink },
              { label: 'Rooms', value: String(pricingKpis.rooms), color: C.ink },
            ].map((item) => (
              <div key={item.label} style={card}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 800, color: item.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </section>

          <section style={summaryGridStyle}>
            <div style={card}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, marginBottom: 10 }}>
                System Alerts
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {summaryAlerts.map((alert) => {
                  const theme = alertTheme(alert.kind)
                  return (
                    <div
                      key={`${alert.title}:${alert.detail}`}
                      style={{
                        display: 'flex',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: C.radiusSm,
                        border: `1px solid ${theme.border}`,
                        background: theme.fill,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: 4,
                          alignSelf: 'stretch',
                          borderRadius: 999,
                          background: theme.accent,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 2 }}>{alert.title}</div>
                        <div style={{ fontSize: 11, color: C.ink3, lineHeight: 1.35 }}>{alert.detail}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, marginBottom: 12 }}>
                Price Breakdown
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { label: 'Base Estimate / Pre-policy total', value: fmtUSD(ps?.prePolicyTotal) },
                  { label: 'Labor Adjustment', value: fmtUSD(priceAdjustment) },
                  { label: 'Job Minimum', value: fmtUSD(ps?.minimumAdjustmentAmount) },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'baseline',
                      paddingBottom: 8,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    <span style={{ fontSize: 12, color: C.inkSub, lineHeight: 1.25 }}>{row.label}</span>
                    <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 800, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.ink3 }}>Final Total</span>
                <span style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 900, color: C.green, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtUSD(finalTotal)}
                </span>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, marginBottom: 12 }}>
                Paint & Supplies Summary
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { label: 'Wall paint', value: fmtUSD(ps?.wallPaintMaterialCost) },
                  { label: 'Ceiling paint', value: fmtUSD(ps?.ceilingPaintMaterialCost) },
                  { label: 'Primer', value: fmtUSD(ps?.primerMaterialCost) },
                  { label: 'Supplies', value: fmtUSD(ps?.supplyCost) },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: C.inkSub }}>{row.label}</span>
                    <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 800, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.ink3 }}>Total</span>
                <span style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 900, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtUSD(paintSuppliesTotal)}
                </span>
              </div>
            </div>
          </section>

          <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                borderBottom: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3, marginBottom: 4 }}>
                  Room Details
                </div>
                <div style={{ fontSize: 12, color: C.ink3 }}>{rooms.length} rooms</div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: roomHeaderGrid,
                gap: 0,
                padding: '10px 16px',
                borderBottom: `1px solid ${C.border}`,
                background: C.cardDark,
                color: C.ink3,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              {['Room', 'Scopes', 'Eff. Sq Ft', 'Labor Hrs', 'Paint $', 'Supplies $', 'Total $', '% of Job', 'Flags'].map((label, index) => (
                <div key={label} style={{ textAlign: index >= 2 ? 'right' : 'left' }}>
                  {label}
                </div>
              ))}
            </div>

            {roomBlocks.length === 0 ? (
              <div style={{ padding: '18px 16px', color: C.ink3, fontSize: 13 }}>No rooms</div>
            ) : (
              roomBlocks.map(({ room, scopeRows, displayScopeSubtotalMap, scopes, roomArea, roomTotal, roomPct, totals, flagsLabel, alerts }) => {
                const isOpen = !!openRooms[room.room_id]
                return (
                  <div key={room.id ?? room.room_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <button
                      type="button"
                      onClick={() => setOpenRooms((prev) => ({ ...prev, [room.room_id]: !prev[room.room_id] }))}
                      style={{
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: roomHeaderGrid,
                        gap: 0,
                        alignItems: 'center',
                        padding: '14px 16px',
                        background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent',
                        border: 'none',
                        borderTop: 'none',
                        color: C.ink,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ color: C.ink3, fontSize: 12, flexShrink: 0 }}>{isOpen ? 'v' : '>'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {roomLabel(room)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
                        {scopes.length > 0 ? (
                          scopes.map((scope) => (
                            <span
                              key={scope}
                              style={{
                                padding: '3px 7px',
                                borderRadius: 4,
                                border: `1px solid ${C.border}`,
                                background: C.cardDark,
                                color: C.ink2,
                                fontSize: 10,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {scope}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: C.ink3, fontSize: 12 }}>None</span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: C.mono, fontVariantNumeric: 'tabular-nums' }}>{fmtNumber(roomArea, 0)}</div>
                      <div style={{ textAlign: 'right', fontFamily: C.mono, fontVariantNumeric: 'tabular-nums' }}>{fmtH(totals.labor)}</div>
                      <div style={{ textAlign: 'right', fontFamily: C.mono, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(totals.paint)}</div>
                      <div style={{ textAlign: 'right', fontFamily: C.mono, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(totals.supplies)}</div>
                      <div style={{ textAlign: 'right', fontFamily: C.mono, fontWeight: 900, color: (roomTotal ?? 0) > 0 ? C.green : C.ink, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtUSD(roomTotal)}
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: C.mono, fontVariantNumeric: 'tabular-nums' }}>{fmtPct(roomPct)}</div>
                      <div
                        style={{
                          textAlign: 'right',
                          fontSize: 11,
                          color: alerts.missingProduct || alerts.overrides || alerts.flags ? '#fbbf24' : C.ink3,
                          fontWeight: 700,
                        }}
                      >
                        {flagsLabel}
                      </div>
                    </button>

                    {isOpen && scopeRows.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${C.border}` }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: roomDetailGrid,
                            gap: 0,
                            padding: '10px 16px',
                            borderBottom: `1px solid ${C.border}`,
                            color: C.ink3,
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            background: 'rgba(255,255,255,0.01)',
                          }}
                        >
                          {['Scope', 'Qty / SF', 'Labor Hrs', 'Paint $', 'Supplies $', 'Subtotal'].map((label, index) => (
                            <div key={label} style={{ textAlign: index === 0 ? 'left' : 'right' }}>
                              {label}
                            </div>
                          ))}
                        </div>
                        {scopeRows.map((scope) => {
                          const derivedPaint = displayScopePaintCost(scope)
                          const qtyUnit = scope.kind === 'trim' ? 'lf' : 'sf'
                          return (
                            <div
                              key={scope.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: roomDetailGrid,
                                gap: 0,
                                alignItems: 'center',
                                padding: '10px 16px',
                                borderBottom: `1px solid rgba(38,38,38,0.5)`,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: C.cardDark, border: `1px solid ${C.border}`, color: C.ink3, fontSize: 10, fontWeight: 800 }}>
                                  {roomScopeTypeLabel(scope.kind)}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {scope.label}
                                </span>
                                {scope.hasOverride && (
                                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Override
                                  </span>
                                )}
                              </div>
                              <div style={{ textAlign: 'right', fontFamily: C.mono, fontVariantNumeric: 'tabular-nums' }}>
                                {scope.quantity == null ? '-' : `${fmtNumber(scope.quantity, scope.kind === 'trim' ? 1 : 0)} ${qtyUnit}`}
                              </div>
                              <div style={{ textAlign: 'right', fontFamily: C.mono, fontVariantNumeric: 'tabular-nums' }}>{fmtH(scope.laborHours)}</div>
                              <div style={{ textAlign: 'right', fontFamily: C.mono, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(derivedPaint)}</div>
                              <div style={{ textAlign: 'right', fontFamily: C.mono, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(scope.suppliesCost)}</div>
                              <div style={{ textAlign: 'right', fontFamily: C.mono, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtUSD(displayScopeSubtotalMap.get(scope.id) ?? scope.subtotal)}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </section>
        </main>

        <aside style={utilityRailStyle}>
          {policySaving && (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: C.radiusSm,
                background: 'rgba(132,204,147,0.08)',
                border: `1px solid rgba(132,204,147,0.2)`,
                fontSize: 11,
                color: C.green,
                textAlign: 'center',
              }}
            >
              Saving...
            </div>
          )}

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3 }}>Labor Day Policy</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: laborDayEnabled ? C.green : C.ink3 }}>{laborDayEnabled ? 'ON' : 'OFF'}</span>
                <Toggle
                  on={laborDayEnabled}
                  onClick={() => {
                    const next = !laborDayEnabled
                    setLaborDayEnabled(next)
                    savePolicyDebounced({ laborDayEnabled: next, dayhours, roundIncrement, laborRate, jobMinEnabled, jobMinAmount })
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPolicyOpen((o) => !o)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: '2px 6px',
                    cursor: 'pointer',
                    color: C.ink3,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  <span style={{ display: 'inline-block', transform: policyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>v</span>
                </button>
              </div>
            </div>
            {policyOpen && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.ink3, fontWeight: 600, marginBottom: 4 }}>Hours / day</div>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={dayhours}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setDayhours(v)
                        savePolicyDebounced({ laborDayEnabled, dayhours: v, roundIncrement, laborRate, jobMinEnabled, jobMinAmount })
                      }}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.ink3, fontWeight: 600, marginBottom: 4 }}>Round (hrs)</div>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={roundIncrement}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setRoundIncrement(v)
                        savePolicyDebounced({ laborDayEnabled, dayhours, roundIncrement: v, laborRate, jobMinEnabled, jobMinAmount })
                      }}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.ink3, fontWeight: 600, marginBottom: 4 }}>Labor rate ($/hr)</div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={laborRate}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setLaborRate(v)
                      savePolicyDebounced({ laborDayEnabled, dayhours, roundIncrement, laborRate: v, jobMinEnabled, jobMinAmount })
                    }}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3 }}>Job Minimum</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: jobMinEnabled ? C.green : C.ink3 }}>{jobMinEnabled ? 'ON' : 'OFF'}</span>
                <Toggle
                  on={jobMinEnabled}
                  onClick={() => {
                    const next = !jobMinEnabled
                    setJobMinEnabled(next)
                    savePolicyDebounced({ laborDayEnabled, dayhours, roundIncrement, laborRate, jobMinEnabled: next, jobMinAmount })
                  }}
                />
              </div>
            </div>
            {jobMinEnabled && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.ink3, fontWeight: 600, marginBottom: 4 }}>Minimum amount ($)</div>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={jobMinAmount}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setJobMinAmount(v)
                    savePolicyDebounced({ laborDayEnabled, dayhours, roundIncrement, laborRate, jobMinEnabled, jobMinAmount: v })
                  }}
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {hasTrimPaint && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3 }}>Trim Paint</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, lineHeight: 1.2 }}>
                    {resolvePaintProductLabel(trimPaint?.paint_product_id, trimPaint?.paint_product_label)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3 }}>Cost</div>
                  <div style={{ fontFamily: C.mono, fontSize: 18, fontWeight: 900, color: C.green }}>{fmtUSD(trimPaint?.paint_cost)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.ink3, marginBottom: 4, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Paint Product</div>
                  <input
                    type="text"
                    value={trimPaintProductId}
                    onChange={(e) => {
                      const next = e.target.value.trim()
                      setTrimPaintProductId(next)
                      saveTrimPaintDebounced({
                        trimPaintProductId: next,
                        trimPaintGallons,
                        trimPaintQuarts,
                      })
                    }}
                    placeholder="Product"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.ink3, marginBottom: 4, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Gallons</div>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={trimPaintGallons}
                      onChange={(e) => {
                        const next = Math.max(0, Math.floor(Number(e.target.value) || 0))
                        setTrimPaintGallons(next)
                        saveTrimPaintDebounced({
                          trimPaintProductId,
                          trimPaintGallons: next,
                          trimPaintQuarts,
                        })
                      }}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.ink3, marginBottom: 4, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Quarts</div>
                    <input
                      type="number"
                      min={0}
                      max={3}
                      step={1}
                      value={trimPaintQuarts}
                      onChange={(e) => {
                        const raw = Math.round(Number(e.target.value) || 0)
                        const next = Math.min(3, Math.max(0, raw))
                        setTrimPaintQuarts(next)
                        saveTrimPaintDebounced({
                          trimPaintProductId,
                          trimPaintGallons,
                          trimPaintQuarts: next,
                        })
                      }}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Gallons', val: String(trimPaint?.gallons ?? 0) },
                    { label: 'Normalized', val: fmtGallons(trimPaint?.normalized_gallons) },
                  ].map((item) => (
                    <div key={item.label} style={{ background: C.cardDark, border: `1px solid ${C.border}`, borderRadius: C.radiusSm, padding: '8px 10px' }}>
                      <div style={{ fontSize: 9, color: C.ink3, marginBottom: 3, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.label}</div>
                      <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 800, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
