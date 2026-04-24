'use client'

import { useSearchParams } from 'next/navigation'
import { useQuoteCreatePageController } from './quoteCreatePageController'
import { buildQuoteCreatePageVm } from './quoteCreatePageVm'

export function useQuoteCreatePage() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job') ?? ''
  const controller = useQuoteCreatePageController({ jobId })
  const pageVm = buildQuoteCreatePageVm({
    jobId: controller.jobId,
    shouldLoadJobData: controller.shouldLoadJobData,
    resource: controller.resource,
    workflow: controller.workflow,
  })

  return {
    ...pageVm,
    actions: controller.actions,
  }
}
