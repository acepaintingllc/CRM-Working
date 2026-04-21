import { redirect } from 'next/navigation'

export default async function SimpleEstimatePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  redirect(`/crm/quotes/create?job=${resolved.id}`)
}
