import { EstimateV2DetailsPageContent } from './_components/EstimateV2DetailsPageContent'

export default async function EstimateDetailsPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  return <EstimateV2DetailsPageContent estimateId={resolved.id} />
}
