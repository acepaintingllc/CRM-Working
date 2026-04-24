'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

type Options = {
  searchFocused: boolean
  onSearchFocusedChange: (focused: boolean) => void
}

export function useQuotesHomeHeaderInteractions({
  searchFocused,
  onSearchFocusedChange,
}: Options) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const settingsContainerRef = useRef<HTMLDivElement | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)
  const searchResultsId = useId()
  const settingsPanelId = useId()

  const closeSearch = useCallback(() => {
    if (searchFocused) onSearchFocusedChange(false)
  }, [onSearchFocusedChange, searchFocused])

  const closeSettings = useCallback(
    (options?: { restoreFocus?: boolean }) => {
      if (settingsOpen && options?.restoreFocus) settingsButtonRef.current?.focus()
      setSettingsOpen(false)
    },
    [settingsOpen]
  )

  const openSearch = useCallback(() => {
    onSearchFocusedChange(true)
  }, [onSearchFocusedChange])

  const toggleSettings = useCallback(() => {
    setSettingsOpen((open) => !open)
  }, [])

  const handleSearchBlur = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      const nextFocusedElement = event.relatedTarget
      if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) {
        return
      }

      closeSearch()
    },
    [closeSearch]
  )

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Escape' || !searchFocused) return
      event.preventDefault()
      event.stopPropagation()
      closeSearch()
    },
    [closeSearch, searchFocused]
  )

  const handleSettingsKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'Escape' || !settingsOpen) return
      event.preventDefault()
      event.stopPropagation()
      closeSettings({ restoreFocus: true })
    },
    [closeSettings, settingsOpen]
  )

  useEffect(() => {
    if (!searchFocused && !settingsOpen) return

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return

      const clickedInsideSearch = searchContainerRef.current?.contains(event.target) ?? false
      const clickedInsideSettings = settingsContainerRef.current?.contains(event.target) ?? false

      if (!clickedInsideSearch) closeSearch()
      if (!clickedInsideSettings) closeSettings()
    }

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!searchFocused && !settingsOpen) return

      event.preventDefault()
      closeSearch()
      closeSettings({ restoreFocus: settingsOpen })
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [closeSearch, closeSettings, searchFocused, settingsOpen])

  return {
    searchContainerRef,
    settingsContainerRef,
    settingsButtonRef,
    searchResultsId,
    settingsPanelId,
    settingsOpen,
    openSearch,
    toggleSettings,
    handleSearchBlur,
    handleSearchKeyDown,
    handleSettingsKeyDown,
  }
}
