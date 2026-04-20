import { notFound } from 'next/navigation'
import EstimatePortalClient from './EstimatePortalClient'
import { loadPublicEstimateByToken, markPublicEstimateViewed } from '@/lib/server/estimatePublicPortal'

export default async function PublicEstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }> | { token: string }
  searchParams?: Promise<{ print?: string }> | { print?: string }
}) {
  const resolvedParams = await Promise.resolve(params)
  const token = resolvedParams.token
  if (!token) notFound()

  const resolvedSearchParams = await Promise.resolve(searchParams ?? {})
  const loaded = await loadPublicEstimateByToken(token)
  if ('error' in loaded) notFound()

  if ((loaded.snapshot.status === 'sent' || loaded.snapshot.status === 'viewed') && !loaded.snapshot.viewed_at) {
    await markPublicEstimateViewed({
      versionId: loaded.snapshot.estimate_version_id,
      orgId: loaded.version.org_id as string,
      metadata: {
        route: 'public-page',
      },
    })
  }

  return <EstimatePortalClient snapshot={loaded.snapshot} printMode={resolvedSearchParams.print === '1'} />
}

