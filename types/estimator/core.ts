export type UUID = string

export type YN = 'Y' | 'N'

export type EstimateVersionState = 'draft' | 'live' | 'archived'
export type EstimateVersionKind = 'standard' | 'alternate' | 'split' | 'combined' | 'revision'

export type CalculatedValue<T extends number | null = number | null> = {
  raw: T
  override: T
  effective: T
}

export type QuantityValue = CalculatedValue<number | null>
export type MoneyValue = CalculatedValue<number | null>
export type HoursValue = CalculatedValue<number | null>

export type EstimatorJob = {
  id: UUID
  orgId: UUID
  customerId: UUID
  title: string
  description: string | null
  status: string
  estimateDate: string | null
  createdAt: string
  updatedAt: string
}

export type EstimateVersion = {
  id: UUID
  orgId: UUID
  jobId: UUID
  customerId: UUID
  status: string
  versionName: string
  versionState: EstimateVersionState
  versionKind: EstimateVersionKind
  versionSortOrder: number
  createdBy: UUID | null
  createdAt: string
  updatedAt: string
}

export type EstimateRoom = {
  id: UUID
  orgId: UUID
  estimateId: UUID
  jobId: UUID
  roomId: string
  roomName: string
  roomTypeId: string | null
  position: number
  notes: string | null
  createdAt: string
  updatedAt: string
}
