import SendQuoteClient from './SendQuoteClient'

export default async function SendQuotePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  return <SendQuoteClient estimateId={resolved.id} catalogSource="v2" />
}
