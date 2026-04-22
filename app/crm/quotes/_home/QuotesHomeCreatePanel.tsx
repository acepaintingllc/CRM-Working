'use client'

import { QUOTE_VERSION_KIND_OPTIONS, type QuoteVersionKind } from '@/lib/quotes/versionCreation'
import type { QuotesHomeCreateVm } from './quoteHomeTypes'

type Props = {
  vm: QuotesHomeCreateVm
  onCreate: () => void
  onVersionKindChange: (value: QuoteVersionKind) => void
  onVersionNameChange: (value: string) => void
}

export function QuotesHomeCreatePanel({
  vm,
  onCreate,
  onVersionKindChange,
  onVersionNameChange,
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
        <div
          style={{
            fontFamily: 'var(--v2-mono)',
            fontSize: 10,
            color: 'var(--v2-ink-3)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Create Version
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Add the next quote version
        </div>
        <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.7, color: 'var(--v2-ink-3)' }}>
          Creates a new quote version linked to this job, then opens it in the workspace.
        </div>
      </div>

      <label style={{ display: 'grid', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--v2-mono)',
            fontSize: 10,
            color: 'var(--v2-ink-3)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Version Name
        </span>
        <input
          value={vm.versionName}
          onChange={(event) => onVersionNameChange(event.target.value)}
          placeholder="Leave blank for the next default version name"
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
      </label>

      <label style={{ display: 'grid', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--v2-mono)',
            fontSize: 10,
            color: 'var(--v2-ink-3)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Version Kind
        </span>
        <select
          value={vm.versionKind}
          onChange={(event) => onVersionKindChange(event.target.value as QuoteVersionKind)}
          style={{
            width: '100%',
            padding: '13px 14px',
            borderRadius: 12,
            border: '1px solid var(--v2-line)',
            background: '#111111',
            color: 'var(--v2-ink)',
            fontSize: 14,
          }}
        >
          {QUOTE_VERSION_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={onCreate}
        disabled={!vm.canCreate}
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: 12,
          border: '1px solid rgba(134,239,172,0.34)',
          background: !vm.canCreate ? 'rgba(74,222,128,0.12)' : '#8ad39b',
          color: !vm.canCreate ? '#9cd7ae' : '#062410',
          fontSize: 14,
          fontWeight: 800,
          cursor: !vm.canCreate ? 'not-allowed' : 'pointer',
        }}
      >
        {vm.creating ? 'Creating version...' : 'Create version'}
      </button>
    </div>
  )
}
