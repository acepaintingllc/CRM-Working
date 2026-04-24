'use client'

import {
  useQuoteVersionWorkflowController,
  type UseQuoteVersionWorkflowOptions,
} from './quoteVersionWorkflowController'

export type {
  QuoteVersionWorkflowController,
  UseQuoteVersionWorkflowOptions,
} from './quoteVersionWorkflowController'

export function useQuoteVersionWorkflow(options: UseQuoteVersionWorkflowOptions) {
  return useQuoteVersionWorkflowController(options)
}
