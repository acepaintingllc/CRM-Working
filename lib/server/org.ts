import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getOrgIdForUser(userId: string) {
  const { data: membership, error } = await supabaseAdmin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return membership?.org_id ?? null
}

export async function getSessionUserOrg() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) return { error: sessionError.message } as const

  const userId = session?.user?.id
  if (!userId) {
    const headerStore = await headers()
    const authHeader = headerStore.get('authorization') || ''
    const match = authHeader.match(/^Bearer (.+)$/i)
    if (!match?.[1]) return { error: 'Not authenticated' } as const

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(match[1])
    if (userErr || !userData?.user) return { error: 'Not authenticated' } as const

    const orgId = await getOrgIdForUser(userData.user.id)
    if (!orgId) return { error: 'No org membership found' } as const

    return { userId: userData.user.id, orgId } as const
  }

  const orgId = await getOrgIdForUser(userId)
  if (!orgId) return { error: 'No org membership found' } as const

  return { userId, orgId } as const
}

