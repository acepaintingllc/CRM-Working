import {
  errorResult,
  okResult,
  type ServiceError,
  type ServiceErrorKind,
  type ServiceResult,
  type ServiceSuccess,
} from '@/lib/server/serviceResult'

export type CustomerSummary = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
}

export type CustomerListPage = {
  data: CustomerSummary[]
  total: number
  page: number
  pageSize: number
}

export type CustomerListQuery = {
  search?: string
  page?: number
  pageSize?: number
}

export type CustomerDetail = CustomerSummary & {
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  created_at: string | null
}

export type CustomerTimelineEvent = {
  id: string
  type: string
  title: string | null
  body: string
  created_at: string | null
  created_by: string | null
  link_path: string | null
  link_label: string | null
}

export type CreateCustomerInput = {
  name: string
  email: string | null
  phone: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
}

export type UpdateCustomerInput = CreateCustomerInput

export type CreateCustomerTimelineNoteInput = {
  body: string
  type: string
  title: string | null
}

export type CustomerServiceErrorKind = ServiceErrorKind
export type CustomerServiceError = ServiceError
export type CustomerServiceSuccess<T> = ServiceSuccess<T>
export type CustomerServiceResult<T> = ServiceResult<T>

export function customerOk<T>(data: T): CustomerServiceSuccess<T> {
  return okResult(data)
}

export function customerError(
  kind: CustomerServiceErrorKind,
  message: string
): CustomerServiceError {
  return errorResult(kind, message)
}
