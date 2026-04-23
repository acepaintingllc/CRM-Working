import QuotesHomePage from './QuotesHomePage'
import { getSessionUserOrg } from '@/lib/server/org'
import { loadQuoteHomeBootstrap } from '@/lib/server/estimateCollectionData'

export default async function QuotesPage() {
  const session = await getSessionUserOrg()
  const bootstrapResult = 'error' in session ? null : await loadQuoteHomeBootstrap(session.orgId)
  const initialData = bootstrapResult?.ok ? bootstrapResult.data : null

  return <QuotesHomePage initialData={initialData} />
}
