'use client'

import Link from 'next/link'
import { QUOTE_META_SEPARATOR } from './quoteHomePresentation'
import type { QuotesHomeJobListVm } from './quoteHomeTypes'
import { S } from './quoteHomeStyles'

type Props = {
  vm: QuotesHomeJobListVm
  renderDesktop?: boolean
  renderMobile?: boolean
  onJobQueryChange: (value: string) => void
  onSelectJob: (jobId: string) => void
}

export function QuotesHomeJobList({
  vm,
  renderDesktop = true,
  renderMobile = true,
  onJobQueryChange,
  onSelectJob,
}: Props) {
  return (
    <>
      {renderMobile ? (
        <div>
          <div style={S.mobileSectionLabel}>Jobs</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {vm.loading ? <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>Loading...</div> : null}
            {!vm.loading && vm.emptyState === 'no_jobs' ? (
              <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>
                No eligible jobs yet.{' '}
                <Link href="/crm/customers/new" style={{ color: 'var(--v2-green-2)' }}>
                  Add a contact
                </Link>{' '}
                first.
              </div>
            ) : null}
            {vm.mobileItems.map((job) => (
              <Link
                key={job.id}
                href={job.href ?? '#'}
                style={{
                  display: 'block',
                  borderRadius: 14,
                  border: '1px solid var(--v2-line)',
                  background: '#111111',
                  padding: 14,
                  color: 'var(--v2-ink)',
                  textDecoration: 'none',
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 3 }}>{job.title}</div>
                <div style={{ fontSize: 14, color: 'var(--v2-ink-3)' }}>
                  {job.customerName}
                  {QUOTE_META_SEPARATOR}
                  {job.versionCountLabel}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {renderDesktop ? (
        <section
          style={{
            borderRadius: 18,
            border: '1px solid var(--v2-line)',
            background: 'var(--v2-bg-2)',
            padding: 18,
            display: 'grid',
            gap: 16,
            alignSelf: 'start',
          }}
        >
          <div>
            <div style={{ ...S.cardLabel, marginBottom: 10 }}>Jobs</div>
            <input
              value={vm.searchQuery}
              onChange={(event) => onJobQueryChange(event.target.value)}
              placeholder="Search jobs by title, customer, or address"
              aria-label="Search jobs"
              style={{
                width: '100%',
                padding: '13px 14px',
                borderRadius: 12,
                border: '1px solid var(--v2-line)',
                background: '#111111',
                color: 'var(--v2-ink)',
                fontSize: 14,
              }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 10,
              maxHeight: 620,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {vm.loading ? <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>Loading jobs...</div> : null}

            {!vm.loading && vm.emptyState === 'no_matches' ? (
              <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>No jobs match this search.</div>
            ) : null}

            {!vm.loading && vm.emptyState === 'no_jobs' ? (
              <div
                style={{
                  borderRadius: 14,
                  border: '1px solid var(--v2-line)',
                  background: '#111111',
                  padding: 16,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700 }}>No eligible jobs yet</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--v2-ink-3)' }}>
                  Quote creation starts from a job with a linked customer. Add the contact first, then
                  create the job in the normal CRM flow.
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link
                    href="/crm/customers/new"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(134,239,172,0.24)',
                      background: 'rgba(74,222,128,0.08)',
                      color: '#b7f3c9',
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Add contact
                  </Link>
                  <Link
                    href="/crm/jobs"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--v2-line)',
                      background: 'transparent',
                      color: 'var(--v2-ink-2)',
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Open jobs
                  </Link>
                </div>
              </div>
            ) : null}

            {vm.items.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => onSelectJob(job.id)}
                style={{
                  textAlign: 'left',
                  borderRadius: 14,
                  border: `1px solid ${
                    job.isSelected ? 'rgba(134,239,172,0.28)' : 'var(--v2-line)'
                  }`,
                  background: job.isSelected ? 'rgba(74,222,128,0.08)' : '#111111',
                  padding: 14,
                  color: 'var(--v2-ink)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{job.title}</div>
                <div style={{ fontSize: 14, color: 'var(--v2-ink-3)' }}>{job.customerName}</div>
                <div
                  style={{
                    fontFamily: 'var(--v2-mono)',
                    fontSize: 11,
                    color: 'var(--v2-ink-3)',
                    marginTop: 4,
                  }}
                >
                  {job.versionCountLabel}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
