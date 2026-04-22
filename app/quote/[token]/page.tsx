import QuotePortalClient from './QuotePortalClient'
import {
  loadPublicEstimateByToken,
  markPublicEstimateViewed,
} from '@/lib/server/estimatePublicPortal'

export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { token } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const loaded = await loadPublicEstimateByToken(token)

  if ('error' in loaded) {
    return <div style={{ padding: 24, fontFamily: 'system-ui' }}>{loaded.error}</div>
  }

  if (loaded.snapshot.status === 'sent') {
    await markPublicEstimateViewed({
      versionId: loaded.snapshot.estimate_version_id,
      orgId: loaded.version.org_id as string,
      metadata: { route: 'public-page' },
    }).catch(() => null)
  }

  return (
    <QuotePortalClient
      snapshot={loaded.snapshot}
      printMode={resolvedSearchParams.print === '1'}
    />
  )
}
