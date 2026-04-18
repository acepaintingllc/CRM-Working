import type { UUID } from '@/types/estimator/core'

export type EstimatePricingPolicy = {
  id: UUID
  orgId: UUID
  estimateId: UUID
  jobId: UUID
  laborDayPolicyEnabled: boolean
  laborDayMinimum: number
  laborDayRoundingIncrement: number
  jobMinimumEnabled: boolean
  jobMinimumAmount: number
  manualTotalOverride: number | null
  hiddenAdjustmentAmount: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type EstimateRoomRollup = {
  id: UUID
  orgId: UUID
  estimateId: UUID
  jobId: UUID
  roomId: string
  position: number
  rawLaborHours: number | null
  rawLaborCost: number | null
  rawMaterialCost: number | null
  rawSupplyCost: number | null
  baseTotal: number | null
  allocatedSharedCharges: number | null
  allocatedMinimumAdjustment: number | null
  finalTotal: number | null
  createdAt: string
  updatedAt: string
}

export type EstimateVersionRollup = {
  id: UUID
  orgId: UUID
  estimateId: UUID
  jobId: UUID
  rawLaborHours: number | null
  rawLaborDays: number | null
  effectiveLaborDays: number | null
  laborCost: number | null
  paintMaterialCost: number | null
  primerMaterialCost: number | null
  supplyCost: number | null
  sharedAccessCost: number | null
  prepTripCost: number | null
  prePolicyTotal: number | null
  postLaborPolicyTotal: number | null
  minimumAdjustmentAmount: number | null
  finalTotal: number | null
  createdAt: string
  updatedAt: string
}
