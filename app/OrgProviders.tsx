'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { getActiveOrgId } from '@/lib/org/getActiveOrgId'

type OrgContextValue = {
  orgId: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside CustomersOrgProvider')
  return ctx
}

export function CustomersOrgProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = useMemo(() => supabaseBrowser, [])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
    if (sessionErr) {
      setError(sessionErr.message)
      setLoading(false)
      return
    }

    const user = sessionData.session?.user
    if (!user) {
      // Not logged in -> bounce
      router.replace('/login')
      return
    }

    try {
      const id = await getActiveOrgId()
      setOrgId(id)
      setLoading(false)
    } catch (e: any) {
      const message = e?.message ?? 'Failed to load org membership.'
      setError(message)
      setOrgId(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: OrgContextValue = {
    orgId,
    loading,
    error,
    refresh: load,
  }

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
