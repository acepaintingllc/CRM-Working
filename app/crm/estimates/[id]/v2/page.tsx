import { EstimateV2EditorPageContent } from '@/app/crm/estimates/[id]/v2/_components/EstimateV2EditorPageContent'
import { EstimateV2ErrorBoundary } from '@/app/crm/estimates/[id]/v2/_components/EstimateV2ErrorBoundary'

export default async function EstimateWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolved = await Promise.resolve(params)

  return (
    <EstimateV2ErrorBoundary>
      <EstimateV2EditorPageContent estimateId={resolved.id} />
    </EstimateV2ErrorBoundary>
  )
}
