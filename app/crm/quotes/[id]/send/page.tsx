import SendEstimateClient from '../../../estimates/[id]/send/sendEstimateClient'

export default async function SendQuotePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  return <SendEstimateClient estimateId={resolved.id} catalogSource="v2" />
}
