'use client'

import { useMemo } from 'react'
import {
  buildPaintOptionsByScope,
  buildPrimerOptionsByScope,
  buildProductLabelById,
  buildProductionRateById,
  buildRoomFlagById,
} from '../_lib/estimateV2EditorDerived'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorMetaState,
} from './estimateV2EditorTypes'
import type {
  EstimateV2CatalogOption,
  EstimateV2DoorTypeOption,
  EstimateV2DrywallRateOption,
  EstimateV2RoomDraft,
  EstimateV2TrimTypeOption as TrimTypeOption,
} from '@/types/estimator/v2'
import { asText } from '@/lib/estimator/parsing'

const FALLBACK_COLOR_CODES = Array.from({ length: 6 }, (_, index) => ({
  id: `COLOR${index + 1}`,
  label: `Color ${index + 1}`,
}))

export function useEstimateV2CatalogDerived(params: {
  collections: Pick<EstimateV2EditorCollections, 'rooms'>
  meta: Pick<EstimateV2EditorMetaState, 'catalogs'>
  selectedRoom: EstimateV2RoomDraft | null
}) {
  const { collections, meta, selectedRoom } = params

  const wallProductionRates = useMemo(
    () =>
      (meta.catalogs.production_rates ?? []).filter(
        (option) => asText(option?.scope_id).toUpperCase() === 'WALLS'
      ),
    [meta.catalogs.production_rates]
  )
  const trimProductionRates = useMemo(
    () =>
      (meta.catalogs.production_rates ?? []).filter(
        (option) => asText(option?.scope_id).toUpperCase() === 'TRIM'
      ),
    [meta.catalogs.production_rates]
  )
  const wallProductionRateById = useMemo(
    () => buildProductionRateById(wallProductionRates),
    [wallProductionRates]
  )
  const trimTypeOptions = useMemo<TrimTypeOption[]>(
    () =>
      (meta.catalogs.trim_items ?? []).map((item) => ({
        id: item.id,
        label: item.label || item.id,
        family: item.family || null,
        category: item.category || item.family || null,
        unit_type: item.unit_type,
        helper_allowed: !!item.helper_allowed,
        default_production_rate_id: item.default_production_rate_id,
        trim_category: (item as Record<string, unknown>).trim_category as TrimTypeOption['trim_category'],
        measurement_class: (item as Record<string, unknown>).measurement_class as TrimTypeOption['measurement_class'],
        picker_group: (item as Record<string, unknown>).picker_group as TrimTypeOption['picker_group'],
      })),
    [meta.catalogs.trim_items]
  )
  const doorTypeOptions = useMemo<EstimateV2DoorTypeOption[]>(
    () =>
      (meta.catalogs.door_types ?? []).map((item) => ({
        id: item.id,
        label: item.label || item.id,
        unit_rate_type: item.unit_rate_type ?? null,
        unit: item.unit ?? null,
        default_qty: item.default_qty ?? null,
        labor_rate: item.labor_rate ?? null,
        material_rate: item.material_rate ?? null,
        amount: item.amount ?? null,
      })),
    [meta.catalogs.door_types]
  )
  const drywallRateOptions = useMemo<EstimateV2DrywallRateOption[]>(
    () =>
      (meta.catalogs.drywall_rates ?? []).map((item) => ({
        id: item.id,
        label: item.label || item.id,
        unit_rate_type: item.unit_rate_type ?? null,
        unit: item.unit ?? null,
        amount: item.amount ?? null,
        ceiling_multiplier: item.ceiling_multiplier ?? null,
      })),
    [meta.catalogs.drywall_rates]
  )
  const roomFlagById = useMemo(
    () => buildRoomFlagById(meta.catalogs.room_flags),
    [meta.catalogs.room_flags]
  )
  const colorCodeOptions = useMemo<EstimateV2CatalogOption[]>(
    () =>
      meta.catalogs.color_codes.length > 0 ? meta.catalogs.color_codes : FALLBACK_COLOR_CODES,
    [meta.catalogs.color_codes]
  )
  const defaultColorCodeId = colorCodeOptions[0]?.id ?? ''
  const productLabelById = useMemo(
    () => buildProductLabelById(meta.catalogs.paint_products),
    [meta.catalogs.paint_products]
  )
  const allPaintProducts = useMemo(
    () =>
      meta.catalogs.paint_products.filter((product) => product.type.toLowerCase() !== 'primer'),
    [meta.catalogs.paint_products]
  )
  const allPrimerProducts = useMemo(
    () =>
      meta.catalogs.paint_products.filter((product) =>
        product.type.toLowerCase().includes('primer')
      ),
    [meta.catalogs.paint_products]
  )
  const paintOptions = allPaintProducts
  const wallPaintOptions = useMemo(
    () => buildPaintOptionsByScope(meta.catalogs.paint_products, 'Walls'),
    [meta.catalogs.paint_products]
  )
  const ceilingPaintOptions = useMemo(
    () => buildPaintOptionsByScope(meta.catalogs.paint_products, 'Ceilings'),
    [meta.catalogs.paint_products]
  )
  const trimPaintOptions = useMemo(
    () => buildPaintOptionsByScope(meta.catalogs.paint_products, 'Trim'),
    [meta.catalogs.paint_products]
  )
  const wallPrimerOptions = useMemo(
    () => buildPrimerOptionsByScope(meta.catalogs.paint_products, 'Walls'),
    [meta.catalogs.paint_products]
  )
  const ceilingPrimerOptions = useMemo(
    () => buildPrimerOptionsByScope(meta.catalogs.paint_products, 'Ceilings'),
    [meta.catalogs.paint_products]
  )
  const trimPrimerOptions = useMemo(
    () => buildPrimerOptionsByScope(meta.catalogs.paint_products, 'Trim'),
    [meta.catalogs.paint_products]
  )
  const roomTypeOptions = useMemo(
    () =>
      meta.catalogs.room_types.length > 0
        ? meta.catalogs.room_types
        : selectedRoom?.roomTypeId
          ? [{ id: selectedRoom.roomTypeId, label: selectedRoom.roomTypeId }]
          : [],
    [meta.catalogs.room_types, selectedRoom]
  )
  const conditionModifiers = useMemo(
    () => meta.catalogs.condition_modifiers ?? [],
    [meta.catalogs.condition_modifiers]
  )

  return {
    rooms: collections.rooms,
    wallProductionRates,
    trimProductionRates,
    wallProductionRateById,
    trimTypeOptions,
    doorTypeOptions,
    drywallRateOptions,
    roomFlagById,
    colorCodeOptions,
    defaultColorCodeId,
    productLabelById,
    allPaintProducts,
    allPrimerProducts,
    paintOptions,
    wallPaintOptions,
    ceilingPaintOptions,
    trimPaintOptions,
    wallPrimerOptions,
    ceilingPrimerOptions,
    trimPrimerOptions,
    roomTypeOptions,
    conditionModifiers,
  }
}
