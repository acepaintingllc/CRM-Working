'use client'

import { useCallback } from 'react'
import { flushSync } from 'react-dom'

const EDITOR_FIELD_SELECTOR = 'input, select, textarea, [contenteditable="true"]'
const EDITOR_SURFACE_SELECTOR = '#estimate-v2-settings-drawer, .ace-v2-rooms-layout'

export function useEstimateV2FocusedFieldCommit() {
  return useCallback(() => {
    if (typeof document === 'undefined') return
    const activeElement = document.activeElement
    if (!(activeElement instanceof HTMLElement)) return
    if (!activeElement.matches(EDITOR_FIELD_SELECTOR)) return
    if (!activeElement.closest(EDITOR_SURFACE_SELECTOR)) return

    flushSync(() => {
      activeElement.blur()
    })
  }, [])
}
