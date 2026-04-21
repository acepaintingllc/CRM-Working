import { redirect } from 'next/navigation'

export default async function LegacyPublicEstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }> | { token: string }
  searchParams?: Promise<{ print?: string }> | { print?: string }
}) {
  const resolvedParams = await Promise.resolve(params)
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {})
  const printParam = resolvedSearchParams.print === '1' ? '?print=1' : ''
  redirect(`/quote/${resolvedParams.token}${printParam}`)
}
