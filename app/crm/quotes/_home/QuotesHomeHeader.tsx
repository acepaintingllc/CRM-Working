'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { SETTINGS_LINKS, formatToday } from './quoteHomePresentation'
import { S } from './quoteHomeStyles'
import type { QuotesHomeHeaderVm, QuotesHomeSearchStatusVm } from './quoteHomeTypes'
import { useQuotesHomeHeaderInteractions } from './useQuotesHomeHeaderInteractions'

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
  const {
    searchContainerRef,
    settingsContainerRef,
    settingsButtonRef,
    searchResultsId,
    settingsPanelId,
    settingsOpen,
    closeSearch,
    closeSettings,
    openSearch,
    openSettings,
    toggleSettings,
    handleSearchBlur,
    handleSearchKeyDown,
  } = useQuotesHomeHeaderInteractions({
    searchFocused: vm.searchFocused,
    onSearchFocusedChange,
  })
  const settingsPanelRef = useRef<HTMLDivElement | null>(null)
  const searchResultsPanelRef = useRef<HTMLDivElement | null>(null)
  const [settingsFocusTarget, setSettingsFocusTarget] = useState<'first' | 'last'>('first')

  const searchStatus =
    vm.searchStatus ??
    buildLegacySearchStatus({
      query: vm.searchQuery,
      loading: vm.searchLoading,
      errorMessage: vm.searchErrorMessage,
      emptyMessage: vm.searchEmptyMessage,
      resultCount: vm.searchResults.length,
      canRetry: vm.searchCanRetry,
    })
  const searchOpen = vm.searchFocused && searchStatus.kind !== 'idle'
  useEffect(() => {
    if (!settingsOpen) return
    focusSettingsItem(settingsPanelRef.current, settingsFocusTarget)
  }, [settingsFocusTarget, settingsOpen])

  const openSettingsWithFocus = (target: 'first' | 'last') => {
    setSettingsFocusTarget(target)
    openSettings()
  }

  const handleSettingsButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && settingsOpen) {
      event.preventDefault()
      event.stopPropagation()
      closeSettings({ restoreFocus: true })
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openSettingsWithFocus(event.key === 'ArrowUp' ? 'last' : 'first')
    }
  }

  const handleSearchInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && searchOpen) {
      const firstResult = searchResultsPanelRef.current?.querySelector<HTMLElement>(
        '[role="option"], button',
      )
      if (firstResult) {
        event.preventDefault()
        firstResult.focus()
        return
      }
    }

    handleSearchKeyDown(event)
  }

  const handleSettingsMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeSettings({ restoreFocus: true })
      return
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    event.preventDefault()
    const menuItems = getEnabledSettingsItems(event.currentTarget)
    if (menuItems.length === 0) return

    const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement)
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? menuItems.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1) % menuItems.length
            : currentIndex <= 0
              ? menuItems.length - 1
              : currentIndex - 1

    menuItems[nextIndex]?.focus()
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
            <div
              ref={searchContainerRef}
              onBlur={handleSearchBlur}
              style={S.searchBox}
            >
              <input
                type="search"
                value={vm.searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                onFocus={openSearch}
                onKeyDown={handleSearchInputKeyDown}
                placeholder="Search quote versions"
                style={S.search}
                aria-label="Search quote versions"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={searchOpen}
                aria-haspopup="listbox"
                aria-controls={searchOpen ? searchResultsId : undefined}
                aria-busy={vm.searchLoading || undefined}
              />
              {searchOpen ? (
                <div
                  ref={searchResultsPanelRef}
                  id={searchResultsId}
                  style={S.searchResults}
                  role="listbox"
                  aria-label="Quote search results"
                  aria-busy={vm.searchLoading || undefined}
                >
                  {searchStatus.kind === 'loading' ? (
                    <div
                      style={S.searchStatusPanel}
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <div style={S.searchStatusTitle}>{searchStatus.title}</div>
                      <div style={S.searchStatusText}>
                        {searchStatus.message}
                      </div>
                    </div>
                  ) : null}

                  {searchStatus.kind === 'error' ? (
                    <div style={S.searchStatusPanel} role="alert">
                      <div style={S.searchStatusTitle}>{searchStatus.title}</div>
                      <div style={S.searchStatusText}>{searchStatus.message}</div>
                      {searchStatus.canRetry ? (
                        <button type="button" style={S.searchRetryButton} onClick={onSearchRetry}>
                          Retry search
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {searchStatus.kind === 'results'
                    ? vm.searchResults.map((estimate) => (
                        <Link
                          key={estimate.id}
                          href={estimate.href}
                          style={S.searchResultLink}
                          role="option"
                          aria-selected="false"
                          onClick={closeSearch}
                        >
                          <div style={S.estimateTitle}>{estimate.title}</div>
                          <div style={S.estimateMeta}>{estimate.meta}</div>
                        </Link>
                      ))
                    : null}

                  {searchStatus.kind === 'empty' ? (
                    <div
                      style={S.searchStatusPanel}
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <div style={S.searchStatusTitle}>{searchStatus.title}</div>
                      <div style={S.searchStatusText}>{searchStatus.message}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div
              ref={settingsContainerRef}
              style={{ position: 'relative', minWidth: 0 }}
            >
              <button
                ref={settingsButtonRef}
                type="button"
                style={S.settingsToggle}
                onClick={toggleSettings}
                onKeyDown={handleSettingsButtonKeyDown}
                aria-expanded={settingsOpen}
                aria-controls={settingsOpen ? settingsPanelId : undefined}
                aria-haspopup="menu"
              >
                Settings & Constants
              </button>
              {settingsOpen ? (
                <div
                  ref={settingsPanelRef}
                  id={settingsPanelId}
                  style={S.settingsPanel}
                  role="menu"
                  aria-label="Quote settings"
                  onKeyDown={handleSettingsMenuKeyDown}
                >
                  {SETTINGS_LINKS.map((item) =>
                    item.disabled ? (
                      <span
                        key={item.label}
                        style={S.settingsDisabled}
                        role="menuitem"
                        aria-disabled="true"
                        tabIndex={-1}
                      >
                        {item.label}
                      </span>
                    ) : (
                      <Link
                        key={item.label}
                        href={item.href ?? '#'}
                        style={S.settingsLink}
                        role="menuitem"
                        tabIndex={-1}
                      >
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

function buildLegacySearchStatus(params: {
  query: string
  loading: boolean
  errorMessage: string | null
  emptyMessage: string | null
  resultCount: number
  canRetry: boolean
}): QuotesHomeSearchStatusVm {
  const query = params.query.trim()
  if (!query) return { kind: 'idle' }
  if (params.loading) {
    return {
      kind: 'loading',
      title: 'Searching quote versions',
      message: `Looking up versions that match "${query}".`,
    }
  }
  if (params.errorMessage) {
    return {
      kind: 'error',
      title: 'Search results failed to load',
      message: params.errorMessage,
      canRetry: params.canRetry,
    }
  }
  if (params.emptyMessage) {
    return {
      kind: 'empty',
      title: 'No matching quote versions',
      message: params.emptyMessage,
    }
  }
  return params.resultCount > 0 ? { kind: 'results' } : { kind: 'idle' }
}

function getEnabledSettingsItems(container: HTMLElement | null) {
  if (!container) return []

  return Array.from(
    container.querySelectorAll<HTMLElement>('[role="menuitem"]')
  ).filter((item) => item.getAttribute('aria-disabled') !== 'true')
}

function focusSettingsItem(
  container: HTMLElement | null,
  target: 'first' | 'last',
) {
  const menuItems = getEnabledSettingsItems(container)
  if (menuItems.length === 0) return

  const nextIndex = target === 'first' ? 0 : menuItems.length - 1
  menuItems[nextIndex]?.focus()
}
