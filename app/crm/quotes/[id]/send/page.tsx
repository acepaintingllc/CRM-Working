import SendEstimateClient from '@/app/crm/estimates/[id]/send/sendEstimateClient'

export default async function SendQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string }
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolved = await Promise.resolve(params)
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {}
  const mode = resolvedSearchParams.mode
  const emailOnly = (Array.isArray(mode) ? mode[0] : mode) === 'uploaded-pdf'
  return (
    <SendEstimateClient
      estimateId={resolved.id}
      catalogSource="v2"
      routeFamilyKey="quote"
      emailOnly={emailOnly}
    />
  )
}
