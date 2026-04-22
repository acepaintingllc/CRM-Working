import { EstimateV2SummaryPageContent } from './_components/EstimateV2SummaryPageContent'

export default async function EstimateSummaryPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  return <EstimateV2SummaryPageContent estimateId={resolved.id} />
}
