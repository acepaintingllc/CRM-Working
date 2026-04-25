'use client'

import type { QuoteHomeBootstrapReadModel } from '@/lib/quotes/collectionData'
import type { QuoteHomePageVmInput } from '../_home/quoteHomePageVm'
import {
  useQuoteHomePageResource,
  type QuoteHomePageResourceFacade,
} from './quoteHomePageResource'

type QuoteHomePageResources = QuoteHomePageVmInput & {
  vmState: QuoteHomePageVmInput['state']
  vmResources: QuoteHomePageVmInput['resources']
  facade: QuoteHomePageResourceFacade
}

export function useQuoteHomePageResources(
  initialData?: QuoteHomeBootstrapReadModel | null
): QuoteHomePageResources {
  const facade = useQuoteHomePageResource(initialData)

  return {
    ...facade.vmInput,
    vmState: facade.vmInput.state,
    vmResources: facade.vmInput.resources,
    facade,
  }
}

export { useQuoteHomePageResource }
export type { QuoteHomePageResourceFacade }
