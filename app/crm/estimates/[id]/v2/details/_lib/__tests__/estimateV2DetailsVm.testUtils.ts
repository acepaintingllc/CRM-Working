import {
  buildEstimateV2DetailsVm,
  type BuildDetailsVmParams,
} from '../estimateV2DetailsVm'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2RoomDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2'

type DetailsVm = ReturnType<typeof buildEstimateV2DetailsVm>

export function validationMessages(vm: DetailsVm) {
  return vm.validationIssues.map((issue) => issue.message)
}

export function validationIds(vm: DetailsVm) {
  return vm.validationIssues.map((issue) => issue.id)
}

export function testIssue(patch: {
  id?: string
  message: string
  section?: 'material' | 'rollers' | 'rates' | 'save' | 'unknown'
  targetId?: string
  field?: string
  severity?: 'blocking' | 'warning'
}) {
  return {
    id: patch.id ?? `test:${patch.message}`,
    section: patch.section ?? 'unknown',
    targetId: patch.targetId ?? 'test',
    field: patch.field,
    severity: patch.severity ?? 'blocking',
    message: patch.message,
  }
}

export const rooms: EstimateV2RoomDraft[] = [
  {
    id: 'room-1',
    roomId: 'R001',
    roomName: 'Living',
    roomTypeId: '',
    lengthIn: '',
    widthIn: '',
    heightIn: '',
    wallComplexityId: '',
    notes: '',
    position: 0,
  },
]

export function wallScope(patch: Partial<EstimateV2WallScopeDraft>): EstimateV2WallScopeDraft {
  return {
    id: 'wall-1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: '',
    colorId: 'COLOR1',
    paintProductId: 'P-WALL',
    primerProductId: '',
    primeMode: 'NONE',
    heightIn: '',
    perimeterIn: '',
    standardDoorCount: '',
    standardWindowCount: '',
    heightFactor: '1',
    complexityFactor: '1',
    wallFlagFactor: '1',
    cutInTopFactor: '1',
    cutInBottomFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    spotPrimePercent: '',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
    ...patch,
  }
}

export function ceilingScope(
  patch: Partial<EstimateV2CeilingScopeDraft>
): EstimateV2CeilingScopeDraft {
  return {
    id: 'ceil-1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: '',
    colorId: '',
    paintProductId: 'P-CEIL',
    primerProductId: '',
    primeMode: 'NONE',
    spotPrimePercent: '',
    ceilingTypeId: '',
    lengthIn: '',
    widthIn: '',
    areaSf: '',
    heightFactor: '1',
    complexityFactor: '1',
    ceilingFlagFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
    ...patch,
  }
}

export function trimScope(patch: Partial<EstimateV2TrimScopeDraft>): EstimateV2TrimScopeDraft {
  return {
    id: 'trim-1',
    roomId: 'R001',
    position: 0,
    include: 'Y',
    scopeName: '',
    trimTypeId: '',
    trimFamily: '',
    unitType: 'LF',
    measurementMode: 'MANUAL',
    helperSource: '',
    measurementValue: '',
    helperValue: '',
    baseboardOpeningCount: '',
    colorId: '',
    paintProductId: 'P-TRIM',
    primerProductId: '',
    paintEnabled: 'Y',
    primeMode: 'NONE',
    spotPrimePercent: '',
    productionRateId: '',
    prepFactor: '1',
    heightFactor: '1',
    profileFactor: '1',
    roomFlagFactor: '1',
    maskingFactor: '1',
    stairFactor: '1',
    difficultFinishFactor: '1',
    caulkFillFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideMeasurement: '',
    overrideHours: '',
    overrideGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    overrideDescription: '',
    notes: '',
    ...patch,
  }
}

export function wallCalculationRow(params: {
  id: string
  effectiveAreaSf: number | null
  rawPaintGallons: number | null
}) {
  return params
}

export function ceilingCalculationRow(params: {
  id: string
  effectiveAreaSf: number | null
  rawPaintGallons: number | null
}) {
  return params
}

export function trimCalculationRow(params: {
  id: string
  effectiveMeasurement: number | null
  rawPaintGallons: number | null
}) {
  return params
}

export function buildVmParams(overrides: Partial<BuildDetailsVmParams> = {}): BuildDetailsVmParams {
  return {
    rooms,
    wallScopes: [wallScope({}), wallScope({ id: 'wall-2', colorId: 'COLOR2' })],
    ceilingScopes: [ceilingScope({})],
    trimScopes: [trimScope({})],
    wallCalculations: [
      wallCalculationRow({ id: 'wall-1', effectiveAreaSf: 100, rawPaintGallons: 1.2 }),
      wallCalculationRow({ id: 'wall-2', effectiveAreaSf: 50, rawPaintGallons: 0.6 }),
    ],
    ceilingCalculations: [
      ceilingCalculationRow({ id: 'ceil-1', effectiveAreaSf: 75, rawPaintGallons: 0.7 }),
    ],
    trimCalculations: [
      trimCalculationRow({ id: 'trim-1', effectiveMeasurement: 40, rawPaintGallons: 0.2 }),
    ],
    pricingSummary: null,
    paintProductLabelById: new Map([
      ['P-WALL', 'Wall Paint'],
      ['P-CEIL', 'Ceiling Paint'],
      ['P-TRIM', 'Trim Paint'],
    ]),
    colorLabelById: new Map([
      ['COLOR1', 'Primary'],
      ['COLOR2', 'Accent'],
    ]),
    rollerOptions: [
      { id: 'WALL_9', label: 'Wall 9"', scope: 'Wall', sizeIn: 9, priceEach: 6 },
      { id: 'CEIL_14', label: 'Ceiling 14"', scope: 'Ceiling', sizeIn: 14, priceEach: 10 },
      { id: 'TRIM_4', label: 'Trim applicator 4"', scope: 'Trim', sizeIn: 4, priceEach: 4 },
    ],
    rollers: [],
    ...overrides,
  }
}

export function buildVm(overrides: Partial<BuildDetailsVmParams> = {}) {
  return buildEstimateV2DetailsVm(buildVmParams(overrides))
}
