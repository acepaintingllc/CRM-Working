'use client'

import Link from 'next/link'
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const settingsMenuRef = useRef<HTMLDetailsElement | null>(null)
  const settingsSummaryRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!vm.searchFocused) return

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return
      if (searchContainerRef.current?.contains(event.target)) return
      onSearchFocusedChange(false)
    }

    const handleDocumentFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) return
      if (searchContainerRef.current?.contains(event.target)) return
      onSearchFocusedChange(false)
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    document.addEventListener('focusin', handleDocumentFocusIn)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      document.removeEventListener('focusin', handleDocumentFocusIn)
    }
  }, [onSearchFocusedChange, vm.searchFocused])

  const handleSettingsKeyDown = (event: ReactKeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== 'Escape' || !settingsMenuRef.current?.open) return
    event.preventDefault()
    settingsMenuRef.current.open = false
    settingsSummaryRef.current?.focus()
  }

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
            <div ref={searchContainerRef}>
              <input
                value={vm.searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                onFocus={() => onSearchFocusedChange(true)}
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
            </div>
            <details ref={settingsMenuRef} style={S.settingsMenu} onKeyDown={handleSettingsKeyDown}>
              <summary
                ref={(node) => {
                  settingsSummaryRef.current = node
                }}
                style={S.settingsSummary}
              >
                Settings & Constants
              </summary>
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
