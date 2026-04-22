'use client'

import Link from 'next/link'
import type { QuoteHomeJob } from './quoteHomeTypes'
import { S } from './quoteHomeStyles'

type Props = {
  jobs: QuoteHomeJob[]
  filteredJobs: QuoteHomeJob[]
  jobQuery: string
  loading: boolean
  mobileJobs: QuoteHomeJob[]
  renderDesktop?: boolean
  renderMobile?: boolean
  selectedJobId: string
  versionCountByJob: Record<string, number>
  onJobQueryChange: (value: string) => void
  onSelectJob: (jobId: string) => void
}

export function QuotesHomeJobList({
  jobs,
  filteredJobs,
  jobQuery,
  loading,
  mobileJobs,
  renderDesktop = true,
  renderMobile = true,
  selectedJobId,
  versionCountByJob,
  onJobQueryChange,
  onSelectJob,
}: Props) {
  return (
    <>
      {renderMobile ? (
        <div>
          <div style={S.mobileSectionLabel}>Jobs</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {loading ? <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>Loading...</div> : null}
            {!loading && jobs.length === 0 ? (
              <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>
                No eligible jobs yet.{' '}
                <Link href="/crm/customers/new" style={{ color: 'var(--v2-green-2)' }}>
                  Add a contact
                </Link>{' '}
                first.
              </div>
            ) : null}
            {mobileJobs.map((job) => {
              const count = versionCountByJob[job.id] ?? 0
              return (
                <Link
                  key={job.id}
                  href={`/crm/quotes/create?job=${job.id}`}
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
                    {job.customer_name ?? 'Unknown customer'} · {count} version{count === 1 ? '' : 's'}
                  </div>
                </Link>
              )
            })}
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
              value={jobQuery}
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
            {loading ? <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>Loading jobs...</div> : null}

            {!loading && filteredJobs.length === 0 && jobs.length > 0 ? (
              <div style={{ color: 'var(--v2-ink-3)', fontSize: 14 }}>No jobs match this search.</div>
            ) : null}

            {!loading && jobs.length === 0 ? (
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

            {filteredJobs.map((job) => {
              const active = job.id === selectedJobId
              const versionCount = versionCountByJob[job.id] ?? 0

              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onSelectJob(job.id)}
                  style={{
                    textAlign: 'left',
                    borderRadius: 14,
                    border: `1px solid ${active ? 'rgba(134,239,172,0.28)' : 'var(--v2-line)'}`,
                    background: active ? 'rgba(74,222,128,0.08)' : '#111111',
                    padding: 14,
                    color: 'var(--v2-ink)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{job.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--v2-ink-3)' }}>
                    {job.customer_name ?? 'Unknown customer'}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--v2-mono)',
                      fontSize: 11,
                      color: 'var(--v2-ink-3)',
                      marginTop: 4,
                    }}
                  >
                    {versionCount} version{versionCount === 1 ? '' : 's'}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}
    </>
  )
}
