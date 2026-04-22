'use client'

import Link from 'next/link'
import { S } from './quoteHomeStyles'
import type { QuotesHomeSelectedJobVm } from './quoteHomeTypes'

type Props = {
  vm: QuotesHomeSelectedJobVm
}

export function QuotesHomeSelectedJobPanel({ vm }: Props) {
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

      {vm.emptyMessage ? <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>{vm.emptyMessage}</div> : null}

      {vm.title ? (
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
                {vm.title}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7, color: 'var(--v2-ink-2)' }}>
                {vm.customerLine}
              </div>
            </div>
            <Link
              href={vm.jobHref ?? '#'}
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
            {vm.stats.map((stat) => (
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
