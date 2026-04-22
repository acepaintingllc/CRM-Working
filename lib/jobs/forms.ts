import {
  next8amLocalDateTimeValue,
  toIsoFromLocalDateTimeValue,
} from '@/lib/jobs/dateHelpers'
import type { JobStatus, StageEmailStage } from '@/lib/jobs/types'

export type JobCreateValues = {
  customerId: string | null
  customerQuery: string
  status: JobStatus
  title: string
  description: string
  estimateDateLocal: string
  scheduledDateLocal: string
  addEstimateToCalendar: boolean
  estimateSummary: string
  estimateLocation: string
  estimateHours: number
  addScheduledToCalendar: boolean
  scheduledSummary: string
  scheduledLocation: string
  scheduledHours: number
  composeStage: StageEmailStage | null
  composeSubject: string
  composeBody: string
}

export type ValidateJobCreateOptions = {
  sendStage?: StageEmailStage | null
  selectedCustomerEmail?: string | null
}

export type ValidatedJobCreateValues = {
  customerId: string
  title: string
  description: string | null
  status: JobStatus
  estimateIso: string | null
  scheduledIso: string | null
  composeSubject: string
  composeBody: string
}

export function normalizeJobCreateValues(
  overrides: Partial<JobCreateValues> = {}
): JobCreateValues {
  return {
    customerId: null,
    customerQuery: '',
    status: 'estimate_scheduled',
    title: '',
    description: '',
    estimateDateLocal: next8amLocalDateTimeValue(),
    scheduledDateLocal: '',
    addEstimateToCalendar: true,
    estimateSummary: '',
    estimateLocation: '',
    estimateHours: 1,
    addScheduledToCalendar: true,
    scheduledSummary: '',
    scheduledLocation: '',
    scheduledHours: 8,
    composeStage: null,
    composeSubject: '',
    composeBody: '',
    ...overrides,
  }
}

export function syncJobCreateValuesFromCustomer(
  values: JobCreateValues,
  selectedCustomer: {
    name?: string | null
    address?: string | null
  } | null
) {
  const customerName = selectedCustomer?.name ?? 'Customer'
  const location = selectedCustomer?.address ?? ''

  return {
    ...values,
    estimateSummary: `Estimate: ${customerName}`,
    scheduledSummary: `Job - ${customerName}`,
    estimateLocation: location,
    scheduledLocation: location,
  }
}

export function ensureDefaultJobDates(values: JobCreateValues) {
  if (values.status === 'estimate_scheduled' && !values.estimateDateLocal) {
    return {
      ...values,
      estimateDateLocal: next8amLocalDateTimeValue(),
    }
  }

  if (values.status === 'scheduled' && !values.scheduledDateLocal) {
    return {
      ...values,
      scheduledDateLocal: next8amLocalDateTimeValue(),
    }
  }

  if (values.status !== 'estimate_scheduled' && values.composeStage === 'estimate_scheduled') {
    return {
      ...values,
      composeStage: null,
    }
  }

  return values
}

export function validateJobCreateValues(
  values: JobCreateValues,
  options: ValidateJobCreateOptions = {}
):
  | {
      ok: true
      value: ValidatedJobCreateValues
    }
  | {
      ok: false
      error: string
    } {
  if (!values.customerId) {
    return { ok: false, error: 'Select a customer' }
  }

  const title = values.title.trim()
  if (!title) {
    return { ok: false, error: 'Job title is required' }
  }

  if (options.sendStage === 'estimate_scheduled' && values.status !== 'estimate_scheduled') {
    return {
      ok: false,
      error: 'Quote scheduled email requires the "Quote scheduled" stage.',
    }
  }

  const estimateIso = values.estimateDateLocal
    ? toIsoFromLocalDateTimeValue(values.estimateDateLocal)
    : null
  if (values.estimateDateLocal && !estimateIso) {
    return { ok: false, error: 'Quote date/time is invalid' }
  }
  if (options.sendStage === 'estimate_scheduled' && !estimateIso) {
    return { ok: false, error: 'Add a quote date/time before sending the email.' }
  }

  const scheduledIso = values.scheduledDateLocal
    ? toIsoFromLocalDateTimeValue(values.scheduledDateLocal)
    : null
  if (values.scheduledDateLocal && !scheduledIso) {
    return { ok: false, error: 'Scheduled date/time is invalid' }
  }

  if (options.sendStage === 'estimate_scheduled' && !options.selectedCustomerEmail) {
    return { ok: false, error: 'Customer email is missing.' }
  }

  return {
    ok: true,
    value: {
      customerId: values.customerId,
      title,
      description: values.description.trim() || null,
      status: values.status,
      estimateIso,
      scheduledIso,
      composeSubject: values.composeSubject,
      composeBody: values.composeBody,
    },
  }
}
