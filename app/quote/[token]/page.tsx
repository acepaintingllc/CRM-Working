import QuotePortalClient from './QuotePortalClient'
import { PublicEstimatePortalErrorState } from '@/lib/customer-estimates/PublicEstimatePortal'
import { loadPublicEstimateSnapshot } from '@/lib/server/estimatePublicPortal'
import { quotePortalCopy } from './quotePortalCopy'

export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { token } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const loaded = await loadPublicEstimateSnapshot(
    token,
    undefined,
    {
      metadata: { route: 'public-page' },
    }
  )

  if (!loaded.ok) {
    return (
      <PublicEstimatePortalErrorState
        copy={quotePortalCopy}
        message={loaded.message}
      />
    )
  }

  return (
    <QuotePortalClient
      snapshot={loaded.data}
      printMode={resolvedSearchParams.print === '1'}
    />
  )
}
