import { EstimateV2SummaryPageContent } from '@/app/crm/estimates/[id]/v2/summary/_components/EstimateV2SummaryPageContent'

export default async function QuoteV2SummaryPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)
  return <EstimateV2SummaryPageContent estimateId={resolved.id} routeFamilyKey="quote-v2" />
}
