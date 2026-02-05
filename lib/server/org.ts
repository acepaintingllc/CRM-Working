import { createClient } from '@supabase/supabase-js'
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
  if (!userId) return { error: 'Not authenticated' } as const

  const orgId = await getOrgIdForUser(userId)
  if (!orgId) return { error: 'No org membership found' } as const

  return { userId, orgId } as const
}

