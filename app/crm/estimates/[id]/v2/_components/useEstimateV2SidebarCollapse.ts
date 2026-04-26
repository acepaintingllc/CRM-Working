'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ace.estimatorV2.sidebarCollapsed'

export function useEstimateV2SidebarCollapse() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      setCollapsed(false)
    }
  }, [])

  const updateCollapsed = (nextCollapsed: boolean) => {
    setCollapsed(nextCollapsed)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(nextCollapsed))
    } catch {
      // Persistence is best-effort only; the sidebar still works without storage.
    }
  }

  return {
    collapsed,
    collapseSidebar: () => updateCollapsed(true),
    expandSidebar: () => updateCollapsed(false),
  }
}
