import QuotePortalClient from './QuotePortalClient'
import { PublicEstimatePortalErrorState } from '@/lib/customer-estimates/PublicEstimatePortal'
import { loadPublicEstimatePortalSnapshot } from '@/lib/server/estimatePublicPortal'
import { quotePortalCopy } from './quotePortalCopy'

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

function resolvePublicQuoteUnavailableState(params: {
  kind: string
  message: string
}) {
  const normalizedMessage = params.message.trim().toLowerCase()

  if (params.kind === 'invalid_input' || normalizedMessage === 'invalid token') {
    return {
      title: quotePortalCopy.invalidTokenTitle ?? quotePortalCopy.unavailableTitle,
      message: quotePortalCopy.invalidTokenMessage ?? quotePortalCopy.unavailableMessage,
    }
  }

  if (params.kind === 'not_found' || normalizedMessage === 'quote not found') {
    return {
      title: quotePortalCopy.notFoundTitle ?? quotePortalCopy.unavailableTitle,
      message: quotePortalCopy.notFoundMessage ?? quotePortalCopy.unavailableMessage,
    }
  }

  return {
    title: quotePortalCopy.unavailableTitle,
    message: quotePortalCopy.unavailableMessage,
  }
}

export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { token } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const loaded = await loadPublicEstimatePortalSnapshot({
    token,
    metadata: {
      route: 'public-page',
    },
    actorType: 'customer',
  })

  if (!loaded.ok) {
    const unavailableState = resolvePublicQuoteUnavailableState({
      kind: loaded.kind,
      message: loaded.message,
    })
    return (
      <PublicEstimatePortalErrorState
        copy={quotePortalCopy}
        title={unavailableState.title}
        message={unavailableState.message}
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
