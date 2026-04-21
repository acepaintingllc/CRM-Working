import { buildCustomerAddress } from '@/lib/customers/validation'
import {
  customerError,
  customerOk,
  type CreateCustomerInput,
  type CreateCustomerTimelineNoteInput,
  type CustomerServiceResult,
  type UpdateCustomerInput,
} from '@/lib/customers/types'

type NormalizerOptions = {
  onUnsupportedFields?: (fields: string[]) => void
}

export type NormalizedUpdateCustomerInput = UpdateCustomerInput & {
  legacyAddress: string | null
  notesProvided: boolean
}

type CustomerDbRowLike = {
  id?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  notes?: string | null
  created_at?: string | null
  type?: string | null
  title?: string | null
  body?: string | null
  created_by?: string | null
  link_path?: string | null
  link_label?: string | null
}

type CustomerWritePayload = {
  name: string
  email: string | null
  phone: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
  address: string | null
  notes: string | null
}

type CustomerUpdateWritePayload = Omit<CustomerWritePayload, 'notes'> & {
  notes?: string | null
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function trimNullable(value: unknown) {
  return asOptionalString(value)?.trim() || null
}

function toLowerTrimNullable(value: unknown) {
  return asOptionalString(value)?.trim().toLowerCase() || null
}

function unsupportedKeys(body: Record<string, unknown>, allowed: readonly string[]) {
  const allowedSet = new Set(allowed)
  return Object.keys(body).filter((key) => !allowedSet.has(key))
}

function notifyUnsupportedFields(
  body: Record<string, unknown>,
  allowed: readonly string[],
  options: NormalizerOptions
) {
  const unsupported = unsupportedKeys(body, allowed)
  if (unsupported.length > 0) {
    options.onUnsupportedFields?.(unsupported)
  }
}

export function normalizeCreateCustomerInput(
  body: Record<string, unknown>,
  options: NormalizerOptions = {}
): CustomerServiceResult<CreateCustomerInput> {
  notifyUnsupportedFields(
    body,
    ['name', 'email', 'phone', 'street', 'city', 'state', 'zip', 'notes', 'address'],
    options
  )

  const name = trimNullable(body.name) ?? ''
  if (!name) {
    return customerError('invalid_input', 'Missing name')
  }

  return customerOk({
    name,
    email: toLowerTrimNullable(body.email),
    phone: trimNullable(body.phone),
    street: trimNullable(body.street),
    city: trimNullable(body.city),
    state: trimNullable(body.state),
    zip: trimNullable(body.zip),
    notes: trimNullable(body.notes),
  })
}

export function normalizeUpdateCustomerInput(
  body: Record<string, unknown>,
  options: NormalizerOptions = {}
): CustomerServiceResult<NormalizedUpdateCustomerInput> {
  notifyUnsupportedFields(
    body,
    ['name', 'email', 'phone', 'street', 'city', 'state', 'zip', 'notes', 'address'],
    options
  )

  const name = trimNullable(body.name) ?? ''
  if (!name) {
    return customerError('invalid_input', 'Missing name')
  }

  return customerOk({
    name,
    email: toLowerTrimNullable(body.email),
    phone: trimNullable(body.phone),
    street: trimNullable(body.street),
    city: trimNullable(body.city),
    state: trimNullable(body.state),
    zip: trimNullable(body.zip),
    notes: trimNullable(body.notes),
    legacyAddress: trimNullable(body.address),
    notesProvided: Object.prototype.hasOwnProperty.call(body, 'notes'),
  })
}

export function normalizeCreateCustomerTimelineNoteInput(
  body: Record<string, unknown>
): CustomerServiceResult<CreateCustomerTimelineNoteInput> {
  const text = trimNullable(body.body) ?? ''
  if (!text) {
    return customerError('invalid_input', 'Missing note body')
  }

  return customerOk({
    body: text,
    type: trimNullable(body.type) ?? 'note',
    title: trimNullable(body.title),
  })
}

export function buildCreateCustomerWritePayload(input: CreateCustomerInput): CustomerWritePayload {
  return {
    name: input.name.trim(),
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    street: input.street?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    zip: input.zip?.trim() || null,
    notes: input.notes?.trim() || null,
    address: buildCustomerAddress(input),
  }
}

export function buildUpdateCustomerWritePayload(
  input: NormalizedUpdateCustomerInput
): CustomerUpdateWritePayload {
  const payload: CustomerUpdateWritePayload = {
    name: input.name.trim(),
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    street: input.street?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    zip: input.zip?.trim() || null,
    address: buildCustomerAddress({
      street: input.street,
      city: input.city,
      state: input.state,
      zip: input.zip,
      address: input.legacyAddress,
    }),
  }

  if (input.notesProvided) {
    payload.notes = input.notes?.trim() || null
  }

  return payload
}

export function mapCustomerSummary(row: CustomerDbRowLike) {
  return {
    id: row.id ?? '',
    name: row.name ?? '',
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
  }
}

export function mapCustomerDetail(row: CustomerDbRowLike) {
  return {
    ...mapCustomerSummary(row),
    street: row.street ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    zip: row.zip ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
  }
}

export function mapCustomerTimelineEvent(row: CustomerDbRowLike) {
  return {
    id: row.id ?? '',
    type: row.type ?? 'note',
    title: row.title ?? null,
    body: row.body ?? '',
    created_at: row.created_at ?? null,
    created_by: row.created_by ?? null,
    link_path: row.link_path ?? null,
    link_label: row.link_label ?? null,
  }
}
