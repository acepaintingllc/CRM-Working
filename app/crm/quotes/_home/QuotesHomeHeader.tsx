'use client'

import Link from 'next/link'
import { SETTINGS_LINKS, formatToday } from './quoteHomePresentation'
import { S } from './quoteHomeStyles'
import type { QuotesHomeHeaderVm } from './quoteHomeTypes'

type Props = {
  vm: QuotesHomeHeaderVm
  onSearchFocusedChange: (focused: boolean) => void
  onSearchQueryChange: (value: string) => void
  onSearchRetry: () => void
}

export function QuotesHomeHeader({
  vm,
  onSearchFocusedChange,
  onSearchQueryChange,
  onSearchRetry,
}: Props) {
  return (
    <div
      style={{
        ...S.card,
        display: 'grid',
        gap: 18,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={S.eyebrow}>{formatToday()}</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Quote home overview</div>
          <div style={S.subhead}>{vm.heroSummaryText}</div>
        </div>

        <div style={S.topControls}>
          <div style={S.searchWrap}>
            <input
              value={vm.searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onFocus={() => onSearchFocusedChange(true)}
              onBlur={() => setTimeout(() => onSearchFocusedChange(false), 150)}
              placeholder="Search quote versions"
              style={S.search}
              aria-label="Search quote versions"
            />
            {vm.searchFocused && vm.searchQuery.trim() ? (
              <div style={S.searchResults}>
                {vm.searchLoading ? (
                  <div style={S.searchStatusPanel}>
                    <div style={S.searchStatusTitle}>Searching quote versions</div>
                    <div style={S.searchStatusText}>
                      Looking up versions that match &quot;{vm.searchQuery.trim()}&quot;.
                    </div>
                  </div>
                ) : null}

                {!vm.searchLoading && vm.searchErrorMessage ? (
                  <div style={S.searchStatusPanel}>
                    <div style={S.searchStatusTitle}>Search results failed to load</div>
                    <div style={S.searchStatusText}>{vm.searchErrorMessage}</div>
                    {vm.searchCanRetry ? (
                      <button type="button" style={S.searchRetryButton} onClick={onSearchRetry}>
                        Retry search
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {!vm.searchLoading && !vm.searchErrorMessage && vm.searchResults.length > 0
                  ? vm.searchResults.map((estimate) => (
                      <Link key={estimate.id} href={estimate.href} style={S.searchResultLink}>
                        <div style={S.estimateTitle}>{estimate.title}</div>
                        <div style={S.estimateMeta}>{estimate.meta}</div>
                      </Link>
                    ))
                  : null}

                {!vm.searchLoading && !vm.searchErrorMessage && vm.searchEmptyMessage ? (
                  <div style={S.searchStatusPanel}>
                    <div style={S.searchStatusTitle}>No matching quote versions</div>
                    <div style={S.searchStatusText}>{vm.searchEmptyMessage}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <details style={S.settingsMenu}>
              <summary style={S.settingsSummary}>Settings & Constants</summary>
              <div style={S.settingsPanel}>
                {SETTINGS_LINKS.map((item) =>
                  item.disabled ? (
                    <span key={item.label} style={S.settingsDisabled}>
                      {item.label}
                    </span>
                  ) : (
                    <Link key={item.label} href={item.href ?? '#'} style={S.settingsLink}>
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  )
}
