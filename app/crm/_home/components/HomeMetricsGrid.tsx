import { formatCurrency } from '@/lib/crm/home/formatters'
import type { CrmHomeMetrics } from '@/lib/crm/home/types'
import { DonutRing } from './DonutRing'
import { DashboardCardShell } from './primitives/DashboardCardShell'
import { DashboardSectionHeader } from './primitives/DashboardSectionHeader'
import { DashboardSkeletonBlock } from './primitives/DashboardSkeletonBlock'
import { DashboardSkeletonRow } from './primitives/DashboardSkeletonRow'
import { crmBorderStyle, crmMutedTextStyle, crmTextStyle } from './primitives/tokens'
import { cx } from './primitives/utils'

type HomeMetricsGridProps = {
  viewModel: {
    metrics: CrmHomeMetrics
    isLoading: boolean
    isUnavailable: boolean
  }
}

type MetricSubRowDescriptor = {
  label: string
  value: string | number
  valueClassName?: string
}

type MetricCardDescriptor = {
  label: string
  href: string
  value: string | number
  className?: string
  valueClassName?: string
  subRows: MetricSubRowDescriptor[]
  subRowValueClassName?: string
}

function MetricSubRow({
  label,
  value,
  valueClassName = 'mt-0.5 text-xl font-extrabold',
}: MetricSubRowDescriptor) {
  return (
    <div>
      <div className="text-xs" style={crmMutedTextStyle}>
        {label}
      </div>
      <div className={valueClassName} style={crmTextStyle}>
        {value}
      </div>
    </div>
  )
}

function renderMetricCard(
  descriptor: MetricCardDescriptor,
  isLoading: boolean,
  isUnavailable: boolean,
  loadingValueClassName: string
) {
  const unavailableValue = '\u2014'
  return (
    <DashboardCardShell key={descriptor.label} className={cx('p-3 sm:p-5', descriptor.className)}>
      <DashboardSectionHeader label={descriptor.label} actionHref={descriptor.href} actionLabel="View" />
      <div className={descriptor.valueClassName ?? 'mt-2 text-2xl font-extrabold md:mt-3 md:text-4xl'} style={crmTextStyle}>
        {isLoading ? (
          <DashboardSkeletonBlock className={loadingValueClassName} />
        ) : isUnavailable ? (
          unavailableValue
        ) : (
          descriptor.value
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:mt-4 sm:gap-3 sm:pt-4" style={crmBorderStyle}>
        {descriptor.subRows.map((subRow) =>
          isLoading ? (
            <DashboardSkeletonRow
              key={subRow.label}
              valueClassName={subRow.valueClassName === 'mt-0.5 text-sm font-extrabold' ? 'h-6 w-24' : 'h-8 w-20'}
            />
          ) : isUnavailable ? (
            <MetricSubRow
              key={subRow.label}
              label={subRow.label}
              value={unavailableValue}
              valueClassName={subRow.valueClassName}
            />
          ) : (
            <MetricSubRow key={subRow.label} {...subRow} />
          )
        )}
      </div>
    </DashboardCardShell>
  )
}

export function HomeMetricsGrid({ viewModel }: HomeMetricsGridProps) {
  const { metrics, isLoading, isUnavailable } = viewModel

  const primaryMetricCards: MetricCardDescriptor[] = [
    {
      label: 'Sales',
      href: '/crm/jobs',
      value: formatCurrency(metrics.salesTotal),
      className: 'col-span-2 md:col-span-1 md:p-6',
      subRows: [
        { label: 'Estimates Won', value: metrics.won },
        {
          label: 'Avg. Value',
          value: metrics.avgTicket != null ? formatCurrency(metrics.avgTicket) : '-',
        },
      ],
    },
    {
      label: 'Pipeline',
      href: '/crm/jobs',
      value: formatCurrency(metrics.pipelineTotal),
      className: 'md:p-6',
      subRows: [
        { label: 'Open Jobs', value: metrics.openJobsCount },
        {
          label: 'Avg. Open Value',
          value: metrics.openJobsAvgValue != null ? formatCurrency(metrics.openJobsAvgValue) : '-',
        },
      ],
    },
  ]

  const secondaryMetricCards: MetricCardDescriptor[] = [
    {
      label: 'Total Estimates',
      href: '/crm/jobs',
      value: metrics.totalEstimates,
      valueClassName: 'mt-2 text-2xl font-extrabold sm:text-3xl',
      subRows: [
        {
          label: 'Worth',
          value: formatCurrency(metrics.pipelineTotal),
          valueClassName: 'mt-0.5 text-sm font-extrabold',
        },
        {
          label: 'Avg. Value',
          value: metrics.avgTicket != null ? formatCurrency(metrics.avgTicket) : '-',
          valueClassName: 'mt-0.5 text-sm font-extrabold',
        },
      ],
    },
    {
      label: 'Open Estimates',
      href: '/crm/jobs',
      value: metrics.openJobsCount,
      valueClassName: 'mt-2 text-2xl font-extrabold sm:text-3xl',
      subRows: [
        {
          label: 'Worth',
          value: formatCurrency(metrics.openJobsTotal),
          valueClassName: 'mt-0.5 text-sm font-extrabold',
        },
        {
          label: 'Avg. Value',
          value: metrics.openJobsAvgValue != null ? formatCurrency(metrics.openJobsAvgValue) : '-',
          valueClassName: 'mt-0.5 text-sm font-extrabold',
        },
      ],
    },
  ]

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {renderMetricCard(primaryMetricCards[0], isLoading, isUnavailable, 'h-10 w-32')}

        <DashboardCardShell className="flex flex-col items-center justify-center gap-2 p-3 sm:gap-3 sm:p-6">
          <DashboardSectionHeader label="Win Rate" />
          {isLoading ? (
            <>
              <DashboardSkeletonBlock className="h-28 w-28 rounded-full" />
              <DashboardSkeletonBlock className="h-4 w-28" />
            </>
          ) : isUnavailable ? (
            <>
              <div className="text-3xl font-extrabold sm:text-5xl" style={crmTextStyle}>
                {'\u2014'}
              </div>
              <div className="text-xs" style={crmMutedTextStyle}>
                Metrics unavailable
              </div>
            </>
          ) : (
            <>
              <DonutRing pct={metrics.winRate} label={`${metrics.winRate}%`} />
              <div className="text-xs" style={crmMutedTextStyle}>
                {metrics.total} total decisions
              </div>
            </>
          )}
        </DashboardCardShell>

        {renderMetricCard(primaryMetricCards[1], isLoading, isUnavailable, 'h-10 w-32')}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {secondaryMetricCards.map((descriptor) =>
          renderMetricCard(descriptor, isLoading, isUnavailable, 'h-8 w-20')
        )}

        <DashboardCardShell className="col-span-2 p-3 sm:col-span-1 sm:p-5">
          <DashboardSectionHeader label="Close Rate" />
          <div className="mt-2 text-2xl font-extrabold sm:text-3xl" style={crmTextStyle}>
            {isLoading ? (
              <DashboardSkeletonBlock className="h-8 w-20" />
            ) : isUnavailable ? (
              '\u2014'
            ) : (
              `${metrics.winRate}%`
            )}
          </div>
          <div className="mt-3">
            <div className="h-5 overflow-hidden rounded-full" style={{ background: 'var(--crm-border)' }}>
              <div
                className={cx('h-full rounded-full transition-all duration-500', isLoading && 'animate-pulse')}
                style={{
                  width: isLoading ? '45%' : isUnavailable ? '0%' : `${metrics.winRate}%`,
                  background: isLoading
                    ? 'var(--crm-border-soft)'
                    : isUnavailable
                      ? 'var(--crm-border-soft)'
                      : 'var(--crm-accent)',
                }}
              />
            </div>
            <div className="mt-2 text-xs" style={crmMutedTextStyle}>
              {isLoading ? (
                <DashboardSkeletonBlock className="h-4 w-24" />
              ) : isUnavailable ? (
                'Metrics unavailable'
              ) : (
                <>
                  {metrics.won} won {'\u2022'} {metrics.lost} lost
                </>
              )}
            </div>
          </div>
        </DashboardCardShell>
      </div>
    </>
  )
}
