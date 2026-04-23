'use client'

import { useEffect } from 'react'

export function useQuotePortalPrint(printMode: boolean) {
  useEffect(() => {
    if (!printMode) return

    const timer = setTimeout(() => {
      window.print()
    }, 350)

    return () => clearTimeout(timer)
  }, [printMode])
}
