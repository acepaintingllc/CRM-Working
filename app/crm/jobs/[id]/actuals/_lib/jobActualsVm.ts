import type { JobDetail } from '@/types/jobs/api'
import {
  jobActualsNumericFields,
  parseJobActualsNumberDraft,
  validateJobActualsForm,
  type JobActualsFormState,
  type JobActualsNumericField,
} from '@/lib/estimate-feedback/forms'

export type JobActualsSnapshotVm = {
  estimateSnapshotId: string
  versionName: string
  acceptedAt: string
  finalTotal: string
  hasInvalidActuals: boolean
  rows: Array<{
    id: keyof Omit<JobActualsFormState, 'notes'>
    label: string
    estimate: string
    actual: string
    variance: string
    error: string | null
  }>
  inputFields: Array<{
    id: JobActualsNumericField
    label: string
    step: string
    help: string
  }>
}

function formatNumber(value: number, suffix = '') {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)
  return suffix ? `${formatted} ${suffix}` : formatted
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function toNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function formatVariance(actual: number, estimated: number, formatter: (value: number) => string) {
  const variance = actual - estimated
  if (variance === 0) return formatter(0)
  return `${variance > 0 ? '+' : ''}${formatter(variance)}`
}

function actualsFieldFormatter(field: (typeof jobActualsNumericFields)[number]) {
  if (field.unit === 'hours') return (value: number) => formatNumber(value, 'hr')
  if (field.unit === 'gallons') return (value: number) => formatNumber(value, 'gal')
  return formatCurrency
}

export function buildJobActualsVm(params: {
  job: JobDetail | null
  form: JobActualsFormState
}): JobActualsSnapshotVm | null {
  const acceptedQuote = params.job?.accepted_quote ?? null
  if (!acceptedQuote?.estimate_snapshot_id) return null

  const validation = validateJobActualsForm(params.form)
  const hasInvalidActuals = Object.keys(validation).length > 0

  return {
    estimateSnapshotId: acceptedQuote.estimate_snapshot_id,
    versionName: acceptedQuote.version_name ?? 'Accepted estimate',
    acceptedAt: acceptedQuote.accepted_at
      ? new Date(acceptedQuote.accepted_at).toLocaleString()
      : '-',
    finalTotal: formatCurrency(toNumber(acceptedQuote.final_total)),
    hasInvalidActuals,
    inputFields: jobActualsNumericFields.map((field) => ({
      id: field.id,
      label: field.label,
      step: field.step,
      help: field.blankHelp,
    })),
    rows: jobActualsNumericFields.map((field) => {
      const formatter = actualsFieldFormatter(field)
      const actual = parseJobActualsNumberDraft(params.form[field.id], field.label)
      const estimate = toNumber(acceptedQuote[field.estimateKey])
      return {
        id: field.id,
        label: field.label,
        estimate: formatter(estimate),
        actual: actual.ok ? formatter(actual.value) : 'Invalid input',
        variance: actual.ok ? formatVariance(actual.value, estimate, formatter) : 'Fix input',
        error: actual.error,
      }
    }),
  }
}
