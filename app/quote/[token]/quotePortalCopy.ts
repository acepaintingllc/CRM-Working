import type { PublicEstimatePortalCopy } from '@/lib/customer-estimates/PublicEstimatePortal'

export const quotePortalCopy: PublicEstimatePortalCopy = {
  shellTitle: 'Customer Quote',
  documentLabel: 'Quote',
  acceptanceTitle: 'Review and accept this quote',
  agreementText: 'I agree to the scope, pricing, and terms shown above.',
  downloadLabel: 'Print Quote',
  acceptedMessage: "Quote accepted. We'll contact you to schedule.",
  declinedMessage: "Quote declined. We'll review your note and follow up if anything else is needed.",
  unavailableTitle: 'Quote unavailable',
  unavailableMessage: 'This quote could not be loaded.',
}
