'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { S } from './quoteHomeStyles'
import type { NavItem, QuotesHomeHeaderVm } from './quoteHomeTypes'

const SETTINGS_LINKS: NavItem[] = [
  { label: 'Defaults', href: '/crm/quotes/defaults' },
  { label: 'Products', href: '/crm/quotes/products' },
  { label: 'Rates & Flags', href: '/crm/quotes/rates' },
  { label: 'Settings', href: '/crm/settings' },
]

function formatToday() {
  const now = new Date()
  return now
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .replace(',', ' /')
    .toUpperCase()
}

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const settingsContainerRef = useRef<HTMLDivElement | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!vm.searchFocused && !settingsOpen) return

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return
      if (searchContainerRef.current?.contains(event.target)) return
      if (settingsContainerRef.current?.contains(event.target)) return
      if (vm.searchFocused) onSearchFocusedChange(false)
      if (settingsOpen) setSettingsOpen(false)
    }

    const handleDocumentFocusIn = (event: FocusEvent) => {
      if (!vm.searchFocused) return
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
  }, [onSearchFocusedChange, settingsOpen, vm.searchFocused])

  const handleSettingsButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Escape' || !settingsOpen) return
    event.preventDefault()
    setSettingsOpen(false)
    settingsButtonRef.current?.focus()
  }

  return (
    <div style={S.headerCard}>
      <div style={S.headerRow}>
        <div>
          <div style={S.eyebrow}>{formatToday()}</div>
          <div style={S.headerTitle}>Quote home overview</div>
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
            <div ref={settingsContainerRef} style={{ position: 'relative' }}>
              <button
                ref={settingsButtonRef}
                type="button"
                style={S.settingsToggle}
                onClick={() => setSettingsOpen((open) => !open)}
                onKeyDown={handleSettingsButtonKeyDown}
              >
                Settings & Constants
              </button>
              {settingsOpen ? (
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
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
