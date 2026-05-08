import type { PublicEstimatePortalCopy } from '@/lib/customer-estimates/PublicEstimatePortal'

export const quotePortalCopy: PublicEstimatePortalCopy = {
  shellTitle: 'Customer Quote',
  documentLabel: 'Quote',
  acceptanceTitle: 'Review this quote and choose how to proceed',
  agreementText: 'I agree to the scope, pricing, and terms shown above.',
  downloadLabel: 'Print Quote',
  submitAcceptanceMessage: 'Sending your acceptance...',
  submitDeclineMessage: 'Sending your decline...',
  acceptedMessage: "Quote accepted. We'll contact you soon to confirm the next steps.",
  declinedMessage: "Quote declined. We'll review your note and follow up if anything else is needed.",
  unavailableTitle: 'Quote unavailable',
  unavailableMessage: "This quote isn't available right now. Please try again or contact us.",
  invalidTokenTitle: "This quote link isn't valid",
  invalidTokenMessage:
    'This quote link is incomplete or no longer valid. Please contact us for a new link.',
  notFoundTitle: 'This quote is no longer available',
  notFoundMessage:
    'This quote is no longer available. Please contact us if you need an updated copy or a new link.',
  expiredTitle: 'This quote has expired',
  expiredMessage:
    'This quote has expired. Please contact us for an updated quote.',
  expiredActionMessage:
    'This quote can no longer be accepted. Please contact us for an updated quote.',
  alreadyAcceptedMessage:
    "This quote has already been accepted. We'll contact you soon to confirm the next steps.",
  alreadyDeclinedMessage:
    "This quote has already been declined. Please contact us if you'd like to revisit it.",
  supersededMessage:
    'This quote is no longer current. Please contact us for the latest version.',
  acceptedElsewhereMessage:
    'This quote is no longer available because another version has already been approved.',
  genericSubmitErrorMessage:
    "We couldn't update this quote right now. Please try again or contact us.",
}
