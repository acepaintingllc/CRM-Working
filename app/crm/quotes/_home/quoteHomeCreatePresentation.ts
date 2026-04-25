import { QUOTE_VERSION_KIND_OPTIONS } from '@/lib/quotes/versionCreation'
import type { QuotesHomeCreateVm } from './quoteHomeTypes'

export const QUOTES_HOME_CREATE_PANEL_COPY = {
  eyebrow: 'Create Version',
  title: 'Add the next quote version',
  description:
    'Creates a new quote version linked to this job, then opens it in the workspace.',
  createButton: 'Create version',
  creatingButton: 'Creating version...',
  versionNameLabel: 'Version Name',
  versionNameHelp: 'Leave blank for the next default version name.',
  versionNamePlaceholder: 'Leave blank for the next default version name',
  versionKindLabel: 'Version Kind',
} as const

export function buildQuotesHomeCreateVm(params: {
  creating: boolean
  loading: boolean
  selectedJobName: string | null
  versionName: string
  versionKind: QuotesHomeCreateVm['versionKind']
  canCreate: boolean
}): QuotesHomeCreateVm {
  return {
    eyebrow: QUOTES_HOME_CREATE_PANEL_COPY.eyebrow,
    title: QUOTES_HOME_CREATE_PANEL_COPY.title,
    description: QUOTES_HOME_CREATE_PANEL_COPY.description,
    createButtonLabel: params.creating
      ? QUOTES_HOME_CREATE_PANEL_COPY.creatingButton
      : QUOTES_HOME_CREATE_PANEL_COPY.createButton,
    versionNameLabel: QUOTES_HOME_CREATE_PANEL_COPY.versionNameLabel,
    versionNameHelp: QUOTES_HOME_CREATE_PANEL_COPY.versionNameHelp,
    versionNamePlaceholder: QUOTES_HOME_CREATE_PANEL_COPY.versionNamePlaceholder,
    versionKindLabel: QUOTES_HOME_CREATE_PANEL_COPY.versionKindLabel,
    versionKindOptions: QUOTE_VERSION_KIND_OPTIONS,
    creating: params.creating,
    loading: params.loading,
    selectedJobName: params.selectedJobName,
    versionName: params.versionName,
    versionKind: params.versionKind,
    canCreate: params.canCreate,
    disabledReason: buildQuotesHomeCreateDisabledReason(params),
  }
}

function buildQuotesHomeCreateDisabledReason(params: {
  creating: boolean
  loading: boolean
  selectedJobName: string | null
  canCreate: boolean
}) {
  if (params.creating) return 'A quote version is already being created.'
  if (params.loading) return 'Quote home is still loading.'
  if (!params.selectedJobName) return 'Select a job before creating a quote version.'
  if (!params.canCreate) return 'Quote version creation is not available right now.'
  return null
}
