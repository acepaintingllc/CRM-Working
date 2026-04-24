import { redirect } from 'next/navigation'
import QuotesHomePage from './QuotesHomePage'
import { getSessionUserOrg } from '@/lib/server/org'
import { loadQuoteHomeBootstrap } from '@/lib/server/estimateCollectionData'

export default async function QuotesPage() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    redirect(`/login?next=${encodeURIComponent('/crm/quotes')}`)
  }

  const bootstrapResult = await loadQuoteHomeBootstrap(session.orgId)
  const initialData = bootstrapResult?.ok ? bootstrapResult.data : null

  return <QuotesHomePage initialData={initialData} />
}
