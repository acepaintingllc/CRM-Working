import type { MoneyValue, QuantityValue, UUID, YN } from '@/types/estimator/core'

export type MaterialType = 'PAINT' | 'PRIMER'
export type MaterialSourceType = 'WALL_SCOPE' | 'WALL_SEGMENT' | 'MANUAL'
export type PurchaseAllocationMethod = 'RAW_QUANTITY' | 'AREA' | 'MANUAL'
export type SupplyRequirementKind = 'PER_COLOR' | 'AREA_BASED' | 'MANUAL'
export type SupplySourceType = 'WALL_SCOPE' | 'WALL_SEGMENT' | 'ESTIMATE_VERSION'
export type SupplyAllocationMethod = 'DIRECT' | 'RAW_GALLONS' | 'AREA' | 'MANUAL'

export type MaterialRequirement = {
  id: UUID
  orgId: UUID
  estimateId: UUID
  jobId: UUID
  position: number
  roomId: string | null
  wallScopeId: UUID | null
  segmentId: UUID | null
  sourceType: MaterialSourceType
  materialType: MaterialType
  productId: string | null
  colorId: string | null
  groupKey: string | null
  unit: string
  quantity: QuantityValue
  allocatedCost: number | null
  notes: string | null
  active: YN
  createdAt: string
  updatedAt: string
}

export type MaterialPurchaseGroup = {
  id: UUID
  orgId: UUID
  estimateId: UUID
  jobId: UUID
  position: number
  groupKey: string | null
  materialType: MaterialType
  productId: string | null
  colorId: string | null
  purchaseUnit: string
  purchaseQuantity: QuantityValue
  unitCost: number | null
  totalCost: number | null
  allocationMethod: PurchaseAllocationMethod
  notes: string | null
  active: YN
  createdAt: string
  updatedAt: string
}

export type SupplyRequirement = {
  id: UUID
  orgId: UUID
  estimateId: UUID
  jobId: UUID
  position: number
  roomId: string | null
  wallScopeId: UUID | null
  materialPurchaseGroupId: UUID | null
  sourceType: SupplySourceType
  supplyKind: SupplyRequirementKind
  allocationMethod: SupplyAllocationMethod
  description: string
  quantity: number | null
  unit: string | null
  cost: MoneyValue
  notes: string | null
  active: YN
  createdAt: string
  updatedAt: string
}
