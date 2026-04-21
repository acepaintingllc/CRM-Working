import { redirect } from 'next/navigation'

export default async function LegacyEstimateSummaryPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  redirect(`/crm/quotes/${resolved.id}/summary`)
}
