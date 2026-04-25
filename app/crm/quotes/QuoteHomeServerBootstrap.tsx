import { redirect } from 'next/navigation'
import QuotesHomePage from './QuotesHomePage'
import { getSessionUserOrg } from '@/lib/server/org'
import { loadQuoteHomeBootstrap } from '@/lib/server/estimateCollectionData'
import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/quoteHomeTypes'

const QUOTES_HOME_PATH = '/crm/quotes'

export async function QuoteHomeServerBootstrap() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    redirect(`/login?next=${encodeURIComponent(QUOTES_HOME_PATH)}`)
  }

  const bootstrapResult = await loadQuoteHomeBootstrap(session.orgId)
  const initialData: QuoteHomeBootstrapReadModel | null = bootstrapResult.ok
    ? bootstrapResult.data
    : null

  return <QuotesHomePage initialData={initialData} />
}

export default QuoteHomeServerBootstrap
