import QuotePortalClient from './QuotePortalClient'
import { loadPublicEstimateSnapshot } from '@/lib/server/estimatePublicPortal'

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
    { metadata: { route: 'public-page' } }
  )

  if (!loaded.ok) {
    return <div style={{ padding: 24, fontFamily: 'system-ui' }}>{loaded.message}</div>
  }

  return (
    <QuotePortalClient
      snapshot={loaded.data}
      printMode={resolvedSearchParams.print === '1'}
    />
  )
}
