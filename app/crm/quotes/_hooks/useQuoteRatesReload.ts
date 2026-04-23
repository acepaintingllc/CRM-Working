'use client'

import { useCallback } from 'react'
import type { useQuoteRatesData } from './useQuoteRatesData'
import type { useQuoteRatesEditorState } from './useQuoteRatesEditorState'

type Options = {
  resource: ReturnType<typeof useQuoteRatesData>
  editor: ReturnType<typeof useQuoteRatesEditorState>
}

export function useQuoteRatesReload({ resource, editor }: Options) {
  return useCallback(
    async (keepId?: string) => {
      const ok = await resource.refresh()
      if (ok && keepId) {
        editor.setSelectedId(keepId)
      }
      return ok
    },
    [editor, resource]
  )
}
