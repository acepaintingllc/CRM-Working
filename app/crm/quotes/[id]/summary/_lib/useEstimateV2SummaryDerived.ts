'use client'

import { useMemo } from 'react'
import type { EstimateV2SummaryPageData, EstimateV2TrimPaint } from '@/types/estimator/v2'
import {
  buildPaintSupplyRows,
  buildPriceBreakdownRows,
  buildPricingKpis,
  buildRoomAlertsByRoom,
  buildRoomBlocks,
  buildRoomFlagCountMap,
  buildRoomScopeRows,
  buildSummaryAlerts,
  calculatePaintSuppliesTotal,
  createDisplayScopePaintCostCalculator,
  createPaintProductLabelResolver,
  hasTrimPaintSummary,
  normalizeSummaryScopeRows,
  type EstimateV2SummaryAlert,
  type EstimateV2SummaryPricingKpis,
  type EstimateV2SummaryPricingTableRow,
  type EstimateV2SummaryRoomBlockVm,
} from './estimateV2SummaryDerived'
import { reconcileWholeDollarRows } from '@/lib/estimator/pricingPolicies'

export type {
  EstimateV2SummaryAlert,
  EstimateV2SummaryPricingKpis,
  EstimateV2SummaryPricingTableRow,
  EstimateV2SummaryRoomBlockVm,
  EstimateV2SummaryScopeRowVm,
} from './estimateV2SummaryDerived'

export function useEstimateV2SummaryDerived(params: {
  data: EstimateV2SummaryPageData | null
  job: Partial<{ customer_name: string | null; customer_address: string | null }> | null
  jobSettingsDraft: {
    dayhours: number
    laborRate: number
  }
}) {
  const { data, job, jobSettingsDraft } = params

  const pricingSummary = data?.pricing_summary ?? null
  const rooms = useMemo(() => data?.inputs?.rooms ?? [], [data?.inputs?.rooms])
  const roomFlags = useMemo(() => data?.inputs?.room_flags ?? [], [data?.inputs?.room_flags])
  const trimPaint = data?.trim_paint ?? pricingSummary?.trimPaint ?? null
  const hasTrimPaint = hasTrimPaintSummary(trimPaint)

  const resolvePaintProductLabel = useMemo(
    () => createPaintProductLabelResolver(data?.inputs?.paint_products ?? []),
    [data?.inputs?.paint_products]
  )

  const wallScopes = useMemo(
    () => normalizeSummaryScopeRows(data?.wall_calculations?.scopes ?? data?.inputs?.room_wall_scopes ?? []),
    [data?.inputs?.room_wall_scopes, data?.wall_calculations?.scopes]
  )

  const ceilingScopes = useMemo(
    () => normalizeSummaryScopeRows(data?.ceiling_calculations?.scopes ?? []),
    [data?.ceiling_calculations?.scopes]
  )

  const trimScopes = useMemo(
    () => normalizeSummaryScopeRows(data?.trim_calculations?.scopes ?? []),
    [data?.trim_calculations?.scopes]
  )

  const roomFlagCountMap = useMemo(() => buildRoomFlagCountMap(roomFlags), [roomFlags])

  const roomTotalMap = useMemo(() => {
    const next = new Map<string, number>()
    for (const room of pricingSummary?.rooms ?? []) next.set(room.room_id, room.finalTotal)
    return next
  }, [pricingSummary?.rooms])

  const displayRoomTotalMap = useMemo(() => {
    const rows = (pricingSummary?.rooms ?? []).map((room) => ({
      room_id: room.room_id,
      price: room.finalTotal,
    }))
    return new Map(
      reconcileWholeDollarRows(rows, pricingSummary?.finalTotal ?? null).map((row) => [
        row.room_id,
        row.price,
      ] as const)
    )
  }, [pricingSummary?.finalTotal, pricingSummary?.rooms])

  const roomAreaMap = useMemo(() => {
    const next = new Map<string, number>()
    for (const room of data?.wall_calculations?.room_totals ?? []) {
      next.set(room.room_id, room.effective_area_sf)
    }
    return next
  }, [data?.wall_calculations?.room_totals])

  const laborRateEffective =
    pricingSummary?.effectiveLaborHours && pricingSummary.effectiveLaborHours > 0
      ? pricingSummary.laborCost / pricingSummary.effectiveLaborHours
      : jobSettingsDraft.laborRate

  const displayScopePaintCost = useMemo(
    () => createDisplayScopePaintCostCalculator(laborRateEffective),
    [laborRateEffective]
  )

  const roomScopeRows = useMemo(
    () => buildRoomScopeRows({ wallScopes, ceilingScopes, trimScopes }),
    [ceilingScopes, trimScopes, wallScopes]
  )

  const roomAlertsByRoom = useMemo(
    () => buildRoomAlertsByRoom({ rooms, roomFlagCountMap, roomScopeRows }),
    [roomFlagCountMap, roomScopeRows, rooms]
  )

  const roomBlocks = useMemo<EstimateV2SummaryRoomBlockVm[]>(
    () =>
      buildRoomBlocks({
        rooms,
        roomScopeRows,
        roomTotalMap,
        displayRoomTotalMap,
        roomAreaMap,
        pricingSummaryFinalTotal: pricingSummary?.finalTotal,
        roomAlertsByRoom,
        displayScopePaintCost,
      }),
    [
      displayRoomTotalMap,
      displayScopePaintCost,
      pricingSummary?.finalTotal,
      roomAlertsByRoom,
      roomAreaMap,
      roomScopeRows,
      roomTotalMap,
      rooms,
    ]
  )

  const pricingKpis = useMemo<EstimateV2SummaryPricingKpis>(
    () =>
      buildPricingKpis({
        pricingSummary,
        dayhours: jobSettingsDraft.dayhours,
        roomsCount: rooms.length,
        laborRateEffective,
      }),
    [jobSettingsDraft.dayhours, laborRateEffective, pricingSummary, rooms.length]
  )

  const summaryAlerts = useMemo<EstimateV2SummaryAlert[]>(
    () =>
      buildSummaryAlerts({
        pricingSummary,
        hasJobSettings: !!data?.inputs?.jobsettings,
        laborRateOverrideActive: data?.inputs?.jobsettings?.override_labor_rate != null,
        roomScopeRows,
        roomFlags,
        rooms,
      }),
    [data?.inputs?.jobsettings, pricingSummary, roomFlags, roomScopeRows, rooms]
  )

  const versionName = data?.estimate.version_name ?? 'Estimate'
  const statusLabel = data?.estimate.version_state ?? 'Draft'
  const finalTotal = pricingSummary?.finalTotal ?? null
  const laborShare =
    pricingSummary?.effectiveLaborHours && finalTotal != null
      ? finalTotal / pricingSummary.effectiveLaborHours
      : null
  const priceAdjustment = pricingSummary
    ? pricingSummary.postLaborPolicyTotal - pricingSummary.prePolicyTotal
    : null
  const paintSuppliesTotal = calculatePaintSuppliesTotal(pricingSummary)

  const priceBreakdownRows = useMemo<EstimateV2SummaryPricingTableRow[]>(
    () => buildPriceBreakdownRows(pricingSummary),
    [pricingSummary]
  )

  const paintSupplyRows = useMemo<EstimateV2SummaryPricingTableRow[]>(
    () => buildPaintSupplyRows(pricingSummary),
    [pricingSummary]
  )

  return {
    job,
    rooms,
    roomFlags,
    pricingSummary,
    trimPaint: trimPaint as EstimateV2TrimPaint | null,
    hasTrimPaint,
    resolvePaintProductLabel,
    displayScopePaintCost,
    roomBlocks,
    pricingKpis,
    summaryAlerts,
    versionName,
    statusLabel,
    finalTotal,
    laborShare,
    priceAdjustment,
    paintSuppliesTotal,
    priceBreakdownRows,
    paintSupplyRows,
  }
}
