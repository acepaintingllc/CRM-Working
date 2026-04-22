'use client'

import { useCallback, useEffect, useRef } from 'react'

export function useEstimateV2BeforeUnload(params: { loading: boolean; dirty: boolean }) {
  const { loading, dirty } = params
  const stateRef = useRef({ loading, dirty })

  useEffect(() => {
    stateRef.current = { loading, dirty }
  }, [dirty, loading])

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (stateRef.current.loading || !stateRef.current.dirty) return
    event.preventDefault()
    event.returnValue = ''
  }, [])

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [handleBeforeUnload])
}
