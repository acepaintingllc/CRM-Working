import type {
  QuoteHomeActionWarning,
  QuoteHomeFailureSource,
  QuoteHomeFeedbackVm,
} from './quoteHomeTypes'

const HOME_FAILURE_MESSAGES: Record<
  Extract<QuoteHomeFailureSource, 'bootstrap' | 'jobs'>,
  string
> = {
  bootstrap: 'Quote home failed to load.',
  jobs: 'Quote home jobs failed to load.',
}

const QUOTE_HOME_JOB_VERSIONS_FAILURE_MESSAGE =
  'Job versions failed to load.'

const FAILURE_SOURCE_LABELS: Record<QuoteHomeFailureSource, string> = {
  bootstrap: 'bootstrap',
  jobs: 'jobs',
  jobVersions: 'job versions',
  create: 'quote creation',
  delete: 'quote deletion',
}

type QuoteHomeLoadFailure = {
  source: Extract<QuoteHomeFailureSource, 'bootstrap' | 'jobs'>
  message: string
}

export function buildHomeLoadFailureDetail(
  source: Extract<QuoteHomeFailureSource, 'bootstrap' | 'jobs'>,
  message: string,
) {
  const fallback = HOME_FAILURE_MESSAGES[source]
  if (!message) return fallback
  return message.startsWith(fallback) ? message : `${fallback} ${message}`
}

function buildJobVersionsFailureDetail(message: string) {
  if (message === 'Failed to load job quote versions.') {
    return QUOTE_HOME_JOB_VERSIONS_FAILURE_MESSAGE
  }

  return `${QUOTE_HOME_JOB_VERSIONS_FAILURE_MESSAGE} ${message}`
}

function appendFeedbackDetail(
  feedback: Pick<QuoteHomeFeedbackVm, 'details' | 'sources'>,
  source: QuoteHomeFailureSource,
  detail: string,
) {
  feedback.details.push(detail)
  feedback.sources.push(source)
}

function buildQuotesHomeFeedbackTitle(params: {
  homeFailureCount: number
  sources: QuoteHomeFailureSource[]
  hasJobVersionsError: boolean
  hasActionError: boolean
  hasActionWarning: boolean
}) {
  if (params.hasActionError) return 'Quote action failed'
  if (params.hasActionWarning) {
    return 'Quote action completed with refresh errors'
  }
  if (params.hasJobVersionsError) return 'Quote home loaded with errors'
  if (params.homeFailureCount > 1) {
    return 'Some quote home data failed to load'
  }

  return `Quote home ${FAILURE_SOURCE_LABELS[params.sources[0]]} failed to load`
}

export function buildQuotesHomeFeedbackVm(params: {
  homeFailures: QuoteHomeLoadFailure[]
  jobVersionsError: string | null
  createError: string | null
  deleteError: string | null
  actionWarning: QuoteHomeActionWarning | null
}): QuoteHomeFeedbackVm | null {
  const feedback: Pick<QuoteHomeFeedbackVm, 'details' | 'sources'> = {
    details: [],
    sources: [],
  }

  params.homeFailures.forEach((failure) => {
    appendFeedbackDetail(
      feedback,
      failure.source,
      buildHomeLoadFailureDetail(failure.source, failure.message),
    )
  })

  if (params.jobVersionsError) {
    appendFeedbackDetail(
      feedback,
      'jobVersions',
      buildJobVersionsFailureDetail(params.jobVersionsError),
    )
  }

  if (params.createError) {
    appendFeedbackDetail(feedback, 'create', params.createError)
  }

  if (params.deleteError) {
    appendFeedbackDetail(feedback, 'delete', params.deleteError)
  }

  if (params.actionWarning) {
    appendFeedbackDetail(
      feedback,
      params.actionWarning.source,
      params.actionWarning.message,
    )
  }

  if (feedback.details.length === 0) return null

  const actionError = Boolean(params.createError || params.deleteError)
  const actionWarning = Boolean(params.actionWarning)
  const title = buildQuotesHomeFeedbackTitle({
    homeFailureCount: params.homeFailures.length,
    sources: feedback.sources,
    hasJobVersionsError: Boolean(params.jobVersionsError),
    hasActionError: actionError,
    hasActionWarning: actionWarning,
  })

  return {
    tone: actionError ? 'error' : 'warning',
    title,
    details: feedback.details,
    sources: feedback.sources,
  }
}
