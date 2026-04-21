import Link from 'next/link'
import { formatCurrency } from '@/lib/crm/home/formatters'
import type { CrmHomeMetrics } from '@/lib/crm/home/types'
import { DonutRing } from './DonutRing'

type HomeMetricsGridProps = {
  metrics: CrmHomeMetrics
}

export function HomeMetricsGrid({ metrics }: HomeMetricsGridProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div
          className="crm-card col-span-2 rounded-2xl border p-5 shadow-sm md:col-span-1 md:p-6"
          style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
        >
          <div className="flex items-center justify-between">
            <div
              className="text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: 'var(--crm-muted)' }}
            >
              Sales
            </div>
            <Link
              href="/crm/jobs"
              className="text-xs font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--crm-muted)' }}
            >
              View
            </Link>
          </div>
          <div
            className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl"
            style={{ color: 'var(--crm-text)' }}
          >
            {formatCurrency(metrics.salesTotal)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: 'var(--crm-border)' }}>
            <div>
              <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                Estimates Won
              </div>
              <div className="mt-0.5 text-xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
                {metrics.won}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                Avg. Value
              </div>
              <div className="mt-0.5 text-xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
                {metrics.avgTicket != null ? formatCurrency(metrics.avgTicket) : '-'}
              </div>
            </div>
          </div>
        </div>

        <div
          className="crm-card flex flex-col items-center justify-center gap-3 rounded-2xl border p-6 shadow-sm"
          style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
        >
          <div
            className="text-[11px] font-extrabold uppercase tracking-widest"
            style={{ color: 'var(--crm-muted)' }}
          >
            Win Rate
          </div>
          <DonutRing pct={metrics.winRate} label={`${metrics.winRate}%`} />
          <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
            {metrics.total} total decisions
          </div>
        </div>

        <div
          className="crm-card rounded-2xl border p-5 shadow-sm md:p-6"
          style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
        >
          <div className="flex items-center justify-between">
            <div
              className="text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: 'var(--crm-muted)' }}
            >
              Pipeline
            </div>
            <Link
              href="/crm/jobs"
              className="text-xs font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--crm-muted)' }}
            >
              View
            </Link>
          </div>
          <div
            className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl"
            style={{ color: 'var(--crm-text)' }}
          >
            {formatCurrency(metrics.pipelineTotal)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: 'var(--crm-border)' }}>
            <div>
              <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                Open Jobs
              </div>
              <div className="mt-0.5 text-xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
                {metrics.openJobsCount}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>
                Avg. Open Value
              </div>
              <div className="mt-0.5 text-xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
                {metrics.openJobsAvgValue != null ? formatCurrency(metrics.openJobsAvgValue) : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div
          className="crm-card rounded-2xl border p-5 shadow-sm"
          style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
        >
          <div className="flex items-center justify-between">
            <div
              className="text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: 'var(--crm-muted)' }}
            >
              Total Estimates
            </div>
            <Link
              href="/crm/jobs"
              className="text-xs font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--crm-muted)' }}
            >
              View
            </Link>
          </div>
          <div className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
            {metrics.totalEstimates}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--crm-border)' }}>
            <div>
              <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>Worth</div>
              <div className="mt-0.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
                {formatCurrency(metrics.pipelineTotal)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>Avg. Value</div>
              <div className="mt-0.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
                {metrics.avgTicket != null ? formatCurrency(metrics.avgTicket) : '-'}
              </div>
            </div>
          </div>
        </div>

        <div
          className="crm-card rounded-2xl border p-5 shadow-sm"
          style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
        >
          <div className="flex items-center justify-between">
            <div
              className="text-[11px] font-extrabold uppercase tracking-widest"
              style={{ color: 'var(--crm-muted)' }}
            >
              Open Estimates
            </div>
            <Link
              href="/crm/jobs"
              className="text-xs font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--crm-muted)' }}
            >
              View
            </Link>
          </div>
          <div className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
            {metrics.openJobsCount}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: 'var(--crm-border)' }}>
            <div>
              <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>Worth</div>
              <div className="mt-0.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
                {formatCurrency(metrics.openJobsTotal)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--crm-muted)' }}>Avg. Value</div>
              <div className="mt-0.5 text-sm font-extrabold" style={{ color: 'var(--crm-text)' }}>
                {metrics.openJobsAvgValue != null ? formatCurrency(metrics.openJobsAvgValue) : '-'}
              </div>
            </div>
          </div>
        </div>

        <div
          className="crm-card col-span-2 rounded-2xl border p-5 shadow-sm sm:col-span-1"
          style={{ background: 'var(--crm-card)', borderColor: 'var(--crm-border)' }}
        >
          <div
            className="text-[11px] font-extrabold uppercase tracking-widest"
            style={{ color: 'var(--crm-muted)' }}
          >
            Close Rate
          </div>
          <div className="mt-2 text-3xl font-extrabold" style={{ color: 'var(--crm-text)' }}>
            {metrics.winRate}%
          </div>
          <div className="mt-3">
            <div className="h-5 overflow-hidden rounded-full" style={{ background: 'var(--crm-border)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${metrics.winRate}%`,
                  background: 'var(--crm-accent)',
                }}
              />
            </div>
            <div className="mt-2 text-xs" style={{ color: 'var(--crm-muted)' }}>
              {metrics.won} won {'\u2022'} {metrics.lost} lost
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
