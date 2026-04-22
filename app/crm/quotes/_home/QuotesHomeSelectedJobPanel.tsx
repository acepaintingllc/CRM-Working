'use client'

import Link from 'next/link'
import { formatVersionState } from './quoteHomePresentation'
import { S } from './quoteHomeStyles'
import type { QuoteHomeJob } from './quoteHomeTypes'

type Props = {
  loading: boolean
  selectedJob: QuoteHomeJob | null
  selectedJobVersionsCount: number
}

export function QuotesHomeSelectedJobPanel({
  loading,
  selectedJob,
  selectedJobVersionsCount,
}: Props) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: '1px solid var(--v2-line)',
        background: 'var(--v2-bg-2)',
        padding: 20,
      }}
    >
      <div style={{ ...S.cardLabel, marginBottom: 10 }}>Selected Job</div>

      {!selectedJob && !loading ? (
        <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>
          Select a job from the left to view versions and create the next one.
        </div>
      ) : null}

      {selectedJob ? (
        <div style={{ display: 'grid', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 26,
                  lineHeight: 1.1,
                  letterSpacing: '-0.03em',
                  fontWeight: 700,
                  color: 'var(--v2-ink)',
                }}
              >
                {selectedJob.title}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7, color: 'var(--v2-ink-2)' }}>
                {selectedJob.customer_name ?? 'Unknown customer'}
                {selectedJob.customer_address ? ` | ${selectedJob.customer_address}` : ''}
              </div>
            </div>
            <Link
              href={`/crm/jobs/${selectedJob.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 14px',
                borderRadius: 12,
                border: '1px solid var(--v2-line)',
                background: '#111111',
                color: 'var(--v2-ink)',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Open job
            </Link>
          </div>

          <div
            className="v2-hub-job-stats"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 12,
            }}
          >
            {[
              { label: 'Customer', value: selectedJob.customer_name ?? 'Unknown' },
              { label: 'Job Status', value: formatVersionState(selectedJob.status) },
              { label: 'Versions', value: String(selectedJobVersionsCount) },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  borderRadius: 14,
                  border: '1px solid var(--v2-line)',
                  background: '#111111',
                  padding: 14,
                }}
              >
                <div style={{ ...S.cardLabel, marginBottom: 8 }}>{stat.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

