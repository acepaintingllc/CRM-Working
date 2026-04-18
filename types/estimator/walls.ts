import type { HoursValue, MoneyValue, QuantityValue, UUID, YN } from '@/types/estimator/core'

export type WallScopeMode = 'RECT' | 'SEG'
export type WallPrimeMode = 'NONE' | 'SPOT' | 'FULL'
export type WallSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

export type RoomWallScope = {
  id: UUID
  orgId: UUID
  estimateId: UUID
  jobId: UUID
  roomId: string
  position: number
  mode: WallScopeMode
  include: YN
  scopeName: string | null
  colorId: string | null
  paintProductId: string | null
  primerProductId: string | null
  primeMode: WallPrimeMode
  heightIn: number | null
  perimeterIn: number | null
  standardDoorCount: number | null
  standardWindowCount: number | null
  heightFactor: number | null
  complexityFactor: number | null
  wallFlagFactor: number | null
  cutInTopFactor: number | null
  cutInBottomFactor: number | null
  areaSqFt: QuantityValue
  paintHours: HoursValue
  primerHours: HoursValue
  paintGallons: QuantityValue
  primerGallons: QuantityValue
  supplyCost: MoneyValue
  total: MoneyValue
  notes: string | null
  active: YN
  createdAt: string
  updatedAt: string
}

export type WallSegment = {
  id: UUID
  orgId: UUID
  estimateId: UUID
  jobId: UUID
  wallScopeId: UUID | null
  roomId: string | null
  position: number
  segmentNumber: number | null
  segmentName: string | null
  include: YN
  shapeType: WallSegmentShape
  quantity: number | null
  widthIn: number | null
  heightIn: number | null
  baseIn: number | null
  manualAreaSqFt: number | null
  standardDoorCount: number | null
  standardWindowCount: number | null
  areaSqFt: QuantityValue
  wallLabel: string | null
  wallColorOverrideId: string | null
  notes: string | null
  active: YN
  createdAt: string
  updatedAt: string
}
