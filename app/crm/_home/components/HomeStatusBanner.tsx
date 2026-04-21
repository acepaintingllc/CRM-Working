type HomeStatusBannerViewModel = {
  tone: 'critical' | 'warning'
  title: string
  message: string
  retryLabel: string
}

type HomeStatusBannerWithViewModelProps = {
  viewModel: HomeStatusBannerViewModel | null
  isBusy: boolean
  onRetry: () => void
}

type HomeStatusBannerLegacyProps = {
  errorsBySource: Partial<Record<'jobs' | 'customers' | 'calendarStatus' | 'calendarEvents' | 'notes', string>>
  hasCriticalError: boolean
  hasWarnings: boolean
  isBusy: boolean
  onRetry: () => void
}

type HomeStatusBannerProps = HomeStatusBannerWithViewModelProps | HomeStatusBannerLegacyProps

function buildViewModelFromLegacyProps({
  errorsBySource,
  hasCriticalError,
  hasWarnings,
  isBusy,
}: HomeStatusBannerLegacyProps): HomeStatusBannerViewModel | null {
  if (!hasCriticalError && !hasWarnings) return null

  const warningLabels: Record<string, string> = {
    customers: 'Customers',
    calendarStatus: 'Calendar status',
    calendarEvents: 'Calendar events',
    notes: 'Notes',
  }

  const degradedSources = Object.keys(errorsBySource)
    .filter((key) => key !== 'jobs')
    .map((key) => warningLabels[key] ?? key)

  return {
    tone: hasCriticalError ? 'critical' : 'warning',
    title: hasCriticalError ? 'Dashboard metrics are unavailable.' : 'Some dashboard data is degraded.',
    message: hasCriticalError
      ? (errorsBySource.jobs ?? 'Unable to load jobs.')
      : `Unavailable sources: ${degradedSources.join(', ')}.`,
    retryLabel: isBusy ? 'Retrying...' : 'Retry',
  }
}

export function HomeStatusBanner(props: HomeStatusBannerProps) {
  const { isBusy, onRetry } = props
  const viewModel =
    'viewModel' in props
      ? props.viewModel
      : buildViewModelFromLegacyProps(props)

  if (!viewModel) return null

  const isCritical = viewModel.tone === 'critical'

  return (
    <div
      role="alert"
      aria-live={isCritical ? 'assertive' : 'polite'}
      className="crm-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      style={{
        background: isCritical ? 'var(--crm-danger-bg)' : 'var(--crm-card)',
        borderColor: isCritical ? 'var(--crm-danger-border)' : 'var(--crm-border)',
      }}
    >
      <div>
        <div
          className="text-sm font-extrabold"
          style={{
            color: isCritical ? 'var(--crm-danger-text)' : 'var(--crm-text)',
          }}
        >
          {viewModel.title}
        </div>
        <div
          className="mt-1 text-sm"
          style={{
            color: isCritical ? 'var(--crm-danger-text)' : 'var(--crm-muted)',
          }}
        >
          {viewModel.message}
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={isBusy}
        className="inline-flex w-fit items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: isCritical ? 'var(--crm-danger-border)' : 'var(--crm-border)',
          background: isCritical ? 'var(--crm-card)' : 'var(--crm-button)',
          color: isCritical ? 'var(--crm-danger-text)' : 'var(--crm-button-text)',
        }}
      >
        {viewModel.retryLabel}
      </button>
    </div>
  )
}
