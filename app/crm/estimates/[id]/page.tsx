import { redirect } from 'next/navigation'

type EstimateLegacyRouteProps = {
  params: { id: string } | Promise<{ id: string }>
}

export default async function EstimateLegacyRoute(props: EstimateLegacyRouteProps) {
  const params = await Promise.resolve(props.params)
  redirect(`/crm/estimates/${params.id}/v2`)
}
