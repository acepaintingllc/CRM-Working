import type { QuoteHomeJobVersion, QuotesHomeDeleteDialogVm } from './quoteHomeTypes'

export const QUOTES_HOME_DELETE_COPY = {
  buttonLabel: 'Delete',
  deletingButtonLabel: 'Deleting...',
  closeLabel: 'Close delete confirmation',
  warning: 'This permanently deletes the quote version. This cannot be undone.',
  info:
    'The home page will refresh job counts and the selected job version list after delete.',
  cancelLabel: 'Cancel',
} as const

export function buildQuotesHomeDeleteDialogVm(
  estimate: QuoteHomeJobVersion | null,
  deletingId: string | null,
): QuotesHomeDeleteDialogVm {
  const versionName = estimate?.version_name?.trim() || 'this quote version'
  const jobTitle = estimate?.job_title?.trim() || 'the selected job'
  const isDeletingThisVersion = Boolean(
    estimate?.estimate_id && deletingId === estimate.estimate_id,
  )
  const hasDeleteInFlight = Boolean(deletingId)

  return {
    isOpen: Boolean(estimate?.estimate_id),
    estimateId: estimate?.estimate_id ?? null,
    versionName: estimate?.version_name ?? null,
    jobTitle: estimate?.job_title ?? null,
    deleting: isDeletingThisVersion,
    title: `Delete ${versionName}?`,
    description: `Permanently delete quote version ${versionName} from ${jobTitle}.`,
    closeLabel: QUOTES_HOME_DELETE_COPY.closeLabel,
    warning: QUOTES_HOME_DELETE_COPY.warning,
    info: QUOTES_HOME_DELETE_COPY.info,
    cancelLabel: QUOTES_HOME_DELETE_COPY.cancelLabel,
    cancelAriaLabel: `Cancel deleting quote version ${versionName}`,
    confirmLabel: `Delete ${versionName}`,
    confirmAriaLabel: `Permanently delete quote version ${versionName} from ${jobTitle}`,
    confirmingLabel: `Deleting ${versionName}...`,
    confirmingAriaLabel: `Deleting quote version ${versionName} from ${jobTitle}`,
    confirmDisabled: hasDeleteInFlight,
    cancelDisabled: hasDeleteInFlight,
  }
}
