'use client'

import { S } from './quoteHomeStyles'
import type { HomeEstimate } from './quoteHomeTypes'

type Props = {
  deletingId: string | null
  estimate: HomeEstimate | null
  onCancel: () => void
  onConfirm: () => void
}

export function QuotesHomeDeleteDialog({ deletingId, estimate, onCancel, onConfirm }: Props) {
  if (!estimate) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        zIndex: 80,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 500,
          borderRadius: 18,
          border: '1px solid var(--v2-line)',
          background: 'var(--v2-bg-2)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          padding: 20,
          display: 'grid',
          gap: 14,
        }}
      >
        <div>
          <div style={{ ...S.cardLabel, marginBottom: 8 }}>Delete version</div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Delete {estimate.version_name}
          </div>
          <div style={{ marginTop: 8, color: 'var(--v2-ink-3)', lineHeight: 1.6, fontSize: 14 }}>
            This will permanently delete the version for {estimate.job_title}. This cannot be undone.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={Boolean(deletingId)}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--v2-line)',
              background: 'var(--v2-bg)',
              color: 'var(--v2-ink)',
              fontWeight: 700,
              fontSize: 13,
              cursor: deletingId ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={Boolean(deletingId)}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(248,113,113,0.38)',
              background: deletingId ? 'rgba(220,38,38,0.75)' : '#dc2626',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              cursor: deletingId ? 'not-allowed' : 'pointer',
              opacity: deletingId ? 0.8 : 1,
            }}
          >
            {deletingId ? 'Deleting...' : 'Delete version'}
          </button>
        </div>
      </div>
    </div>
  )
}

