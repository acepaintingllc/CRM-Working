import { EstimateV2ErrorBoundary } from './_components/EstimateV2ErrorBoundary'
import { EstimateV2EditorPageContent } from './_components/EstimateV2EditorPageContent'

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
