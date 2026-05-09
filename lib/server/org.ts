import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers.js'
import { createSupabaseServerClient } from '../supabase/server.ts'
import { codexBrowserTestOrgError, getCodexBrowserTestOrgId } from './codexBrowserTestOrg.ts'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getOrgIdForUser(userId: string) {
  const testOrgId = getCodexBrowserTestOrgId()
  let query = supabaseAdmin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (testOrgId) {
    query = query.eq('org_id', testOrgId)
  }

  const { data: membership, error } = await query.maybeSingle()

  if (error) throw error
  return membership?.org_id ?? null
}

export async function getSessionUserOrg() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: cookieUser },
    error: cookieUserErr,
  } = await supabase.auth.getUser()

  let userId = cookieUser?.id ?? null
  if (!userId) {
    const headerStore = await headers()
    const authHeader = headerStore.get('authorization') || ''
    const match = authHeader.match(/^Bearer (.+)$/i)
    if (match?.[1]) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(match[1])
      if (userErr || !userData?.user) return { error: 'Not authenticated' } as const
      userId = userData.user.id
    }
  }

  if (!userId) {
    if (cookieUserErr) return { error: cookieUserErr.message } as const
    return { error: 'Not authenticated' } as const
  }

  const orgId = await getOrgIdForUser(userId)
  if (!orgId) {
    return {
      error: getCodexBrowserTestOrgId() ? codexBrowserTestOrgError() : 'No org membership found',
    } as const
  }

  return { userId, orgId } as const
}
