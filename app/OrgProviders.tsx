'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

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

    // Fetch membership once for this section
    const { data: rows, error: memErr } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)

    if (memErr) {
      setError(memErr.message)
      setLoading(false)
      return
    }

    const id = rows?.[0]?.org_id ?? null
    if (!id) {
      // If you expect bootstrap to always create membership, this should never happen.
      setError('No org membership found. Visit /crm to bootstrap your org.')
      setOrgId(null)
      setLoading(false)
      return
    }

    setOrgId(id)
    setLoading(false)
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
