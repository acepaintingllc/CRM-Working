import { redirect } from 'next/navigation'

export default async function LegacyEstimateSendPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  redirect(`/crm/quotes/${resolved.id}/send`)
}
