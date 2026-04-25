import { EstimateV2DetailsPageContent } from '@/app/crm/estimates/[id]/v2/details/_components/EstimateV2DetailsPageContent'

export default async function QuoteDetailsPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  return <EstimateV2DetailsPageContent estimateId={resolved.id} routeFamilyKey="quote" />
}
