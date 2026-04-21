import type { CrmHomeSourceErrorKey, CrmHomeSourceErrorMap } from '@/lib/crm/home/types'

type HomeStatusBannerProps = {
  errorsBySource: CrmHomeSourceErrorMap
  hasCriticalError: boolean
  hasWarnings: boolean
  isBusy: boolean
  onRetry: () => void
}

const sourceLabels: Record<CrmHomeSourceErrorKey, string> = {
  jobs: 'Jobs',
  customers: 'Customers',
  calendarStatus: 'Calendar status',
  calendarEvents: 'Calendar events',
  notes: 'Notes',
}

export function HomeStatusBanner({
  errorsBySource,
  hasCriticalError,
  hasWarnings,
  isBusy,
  onRetry,
}: HomeStatusBannerProps) {
  if (!hasCriticalError && !hasWarnings) return null

  const degradedSources = (Object.keys(errorsBySource) as CrmHomeSourceErrorKey[])
    .filter((key) => key !== 'jobs')
    .map((key) => sourceLabels[key])

  const title = hasCriticalError
    ? 'Dashboard metrics are unavailable.'
    : 'Some dashboard data is degraded.'
  const message = hasCriticalError
    ? (errorsBySource.jobs ?? 'Unable to load jobs.')
    : `Unavailable sources: ${degradedSources.join(', ')}.`

  return (
    <div
      role="alert"
      aria-live={hasCriticalError ? 'assertive' : 'polite'}
      className="crm-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      style={{
        background: hasCriticalError ? 'var(--crm-danger-bg)' : 'var(--crm-card)',
        borderColor: hasCriticalError ? 'var(--crm-danger-border)' : 'var(--crm-border)',
      }}
    >
      <div>
        <div
          className="text-sm font-extrabold"
          style={{
            color: hasCriticalError ? 'var(--crm-danger-text)' : 'var(--crm-text)',
          }}
        >
          {title}
        </div>
        <div
          className="mt-1 text-sm"
          style={{
            color: hasCriticalError ? 'var(--crm-danger-text)' : 'var(--crm-muted)',
          }}
        >
          {message}
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={isBusy}
        className="inline-flex w-fit items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: hasCriticalError ? 'var(--crm-danger-border)' : 'var(--crm-border)',
          background: hasCriticalError ? 'var(--crm-card)' : 'var(--crm-button)',
          color: hasCriticalError ? 'var(--crm-danger-text)' : 'var(--crm-button-text)',
        }}
      >
        {isBusy ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  )
}
