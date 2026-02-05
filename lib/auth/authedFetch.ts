import { supabaseBrowser } from '@/lib/supabase/client'

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data } = await supabaseBrowser.auth.getSession()
  const token = data.session?.access_token

  const headers = new Headers(init.headers || {})
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, { ...init, headers })
}
