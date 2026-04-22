'use client'

import { useMemo } from 'react'
import {
  buildPaintOptionsByScope,
  buildPrimerOptionsByScope,
  buildProductLabelById,
  buildProductionRateById,
  buildRoomFlagById,
} from '../_lib/estimateV2EditorDerived'
import { inferTrimUnitTypeFromText } from '../_lib/estimateV2EditorNormalize'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorMetaState,
} from './estimateV2EditorTypes'
import type {
  EstimateV2CatalogOption,
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
      trimProductionRates.map((rate) => ({
        id: rate.id,
        label: rate.label || rate.id,
        family: rate.surface_type || null,
        category: rate.condition || rate.surface_type || null,
        unit_type: inferTrimUnitTypeFromText(
          `${rate.id} ${rate.label} ${rate.surface_type} ${rate.condition}`
        ),
        helper_allowed: false,
        default_production_rate_id: rate.id,
      })),
    [trimProductionRates]
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

  return {
    rooms: collections.rooms,
    wallProductionRates,
    trimProductionRates,
    wallProductionRateById,
    trimTypeOptions,
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
  }
}
