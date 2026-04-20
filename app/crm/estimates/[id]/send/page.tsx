import { redirect } from 'next/navigation'

export default async function SendEstimatePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  redirect(`/crm/estimates/${resolved.id}/v2/send`)
}
