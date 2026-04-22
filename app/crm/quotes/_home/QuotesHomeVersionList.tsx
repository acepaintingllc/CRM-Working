'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import {
  estimateWorkspaceHref,
  formatCurrency,
  formatDateTime,
  formatVersionState,
} from './quoteHomePresentation'
import { S } from './quoteHomeStyles'
import type { HomeEstimate, QuoteHomeJob } from './quoteHomeTypes'

type Props = {
  deletingId: string | null
  selectedJob: QuoteHomeJob | null
  versions: HomeEstimate[]
  onRequestDelete: (estimate: HomeEstimate) => void
}

export function QuotesHomeVersionList({
  deletingId,
  selectedJob,
  versions,
  onRequestDelete,
}: Props) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: '1px solid var(--v2-line)',
        background: 'var(--v2-bg-2)',
        padding: 20,
        display: 'grid',
        gap: 14,
        alignSelf: 'start',
      }}
    >
      <div>
        <div style={{ ...S.cardLabel, marginBottom: 8 }}>Existing Versions</div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
          {selectedJob
            ? `${versions.length} version${versions.length === 1 ? '' : 's'} under this job`
            : 'Pick a job first'}
        </div>
      </div>

      {!selectedJob ? <div style={S.emptyState}>Versions will appear here once a job is selected.</div> : null}

      {selectedJob && versions.length === 0 ? (
        <div style={S.emptyState}>
          No quote versions exist under this job yet. Use the panel on the right to create the first
          one.
        </div>
      ) : null}

      {versions.map((estimate) => (
        <div
          key={estimate.estimate_id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 14,
            alignItems: 'center',
            borderTop: '1px solid var(--v2-line)',
            paddingTop: 14,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--v2-ink)' }}>
                {estimate.version_name ?? 'Quote Version'}
              </div>
              {estimate.final_total != null && estimate.final_total > 0 ? (
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--v2-green-2)' }}>
                  {formatCurrency(estimate.final_total)}
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 5, ...S.estimateMeta }}>
              {formatVersionState(estimate.version_state)} / {formatVersionState(estimate.version_kind)}
              {' · '}Updated {formatDateTime(estimate.updated_at)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link
              href={estimateWorkspaceHref(estimate.estimate_id)}
              prefetch={false}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(134,239,172,0.24)',
                background: 'rgba(74,222,128,0.08)',
                color: '#b7f3c9',
                textDecoration: 'none',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              Open version
            </Link>
            <button
              type="button"
              onClick={() => onRequestDelete(estimate)}
              disabled={deletingId === estimate.estimate_id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 9px',
                borderRadius: 8,
                border: '1px solid rgba(248,113,113,0.28)',
                background: 'rgba(239,68,68,0.08)',
                color: '#fecaca',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 12,
                whiteSpace: 'nowrap',
                cursor: deletingId === estimate.estimate_id ? 'not-allowed' : 'pointer',
              }}
            >
              <Trash2 size={12} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

