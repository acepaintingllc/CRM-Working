import type { JobActualsStatus } from '../../types/jobs/feedback.ts'
import type { JobStatus } from '../../types/jobs/status.ts'
export type { JobStatus } from '../../types/jobs/status.ts'

export const JOB_STATUSES = [
  'estimate_scheduled',
  'estimate_sent',
  'follow_up',
  'scheduled',
  'completed',
  'lost',
] as const satisfies readonly JobStatus[]

export const STAGE_EMAIL_STAGES = [
  'estimate_scheduled',
  'estimate_sent',
  'follow_up',
  'scheduled',
  'completed',
] as const

export type StageEmailStage = (typeof STAGE_EMAIL_STAGES)[number]

export type JobStatusOption = {
  value: JobStatus
  title: string
}

export const JOB_STATUS_OPTIONS: JobStatusOption[] = [
  { value: 'estimate_scheduled', title: 'Quote scheduled' },
  { value: 'estimate_sent', title: 'Quote sent' },
  { value: 'follow_up', title: 'Follow up' },
  { value: 'scheduled', title: 'Scheduled' },
  { value: 'completed', title: 'Completed' },
  { value: 'lost', title: 'Lost' },
]

export type JobWorkflowSurface = 'board' | 'detail'

export type JobWorkflowActionId =
  | 'send_quote_scheduled'
  | 'review_send_quote'
  | 'edit_send_quote'
  | 'mark_quote_sent'
  | 'set_quote_date'
  | 'move_to_follow_up'
  | 'schedule_job'
  | 'send_follow_up'
  | 'send_scheduled_email'
  | 'mark_completed'
  | 'change_scheduled_date'
  | 'mark_lost'
  | 'open_closeout'
  | 'open_quote'
  | 'open_job_actuals'
  | 'open_estimate_review'

type JobWorkflowActions = Record<JobWorkflowSurface, JobWorkflowActionId[]>

export type JobWorkflowStatusConfig = {
  columnTitle: string
  actions: JobWorkflowActions
}

export type JobWorkflowResolvedActionKind =
  | 'navigate'
  | 'stage_email'
  | 'patch_status'
  | 'patch_date'
  | 'open_closeout'
  | 'message'

export type JobWorkflowSubject = {
  id: string
  status: JobStatus
  /**
   * Canonical persisted accepted-estimate link for operational workflows.
   */
  linked_estimate_id?: string | null
  /**
   * Quote-route navigation contract only. This may be derived from linked
   * estimate rows for legacy/draft navigation, but operational workflow gates
   * must not treat it as accepted estimate ownership.
   */
  estimate_navigation_id?: string | null
  accepted_estimate?: {
    estimate_snapshot_id?: string | null
    estimate_id?: string | null
  } | null
  job_actuals_status?: JobActualsStatus | string | null
  scheduled_date?: string | null
  scheduled_end_date?: string | null
  scheduled_email_sent_at?: string | null
  completed_email_sent_at?: string | null
}

type JobWorkflowActionDescriptor = {
  kind: JobWorkflowResolvedActionKind
  tone?: 'default' | 'accent' | 'danger'
  getTone?: (job: JobWorkflowSubject, surface: JobWorkflowSurface) => 'default' | 'accent' | 'danger'
  stage?: StageEmailStage
  status?: JobStatus
  dateField?: 'estimate_sent_at' | 'completed_at'
  getLabel: (job: JobWorkflowSubject, surface: JobWorkflowSurface) => string
  getHref?: (job: JobWorkflowSubject) => string
  getDisabledReason?: (job: JobWorkflowSubject, surface: JobWorkflowSurface) => string | null
  confirmMessage?: string
  isVisible?: (job: JobWorkflowSubject, surface: JobWorkflowSurface) => boolean
}

function hasOperationalAcceptedEstimate(job: JobWorkflowSubject) {
  return Boolean(job.accepted_estimate)
}

function resolveQuoteNavigationEstimateId(job: JobWorkflowSubject) {
  if (job.estimate_navigation_id) return job.estimate_navigation_id
  // Keep a narrow compatibility fallback for callers that have not yet been
  // updated to pass the explicit navigation contract.
  return job.linked_estimate_id ?? null
}

export type JobWorkflowResolvedAction = {
  id: JobWorkflowActionId
  kind: JobWorkflowResolvedActionKind
  tone: 'default' | 'accent' | 'danger'
  label: string
  href?: string
  disabledReason?: string
  stage?: StageEmailStage
  status?: JobStatus
  dateField?: 'estimate_sent_at' | 'completed_at'
  confirmMessage?: string
}

export type JobPatchTransitionSignal =
  | 'completed_at'
  | 'scheduled_date'
  | 'estimate_sent_at'
  | 'estimate_date'

export type JobEmailTimestampField =
  | 'estimate_sent_at'
  | 'scheduled_email_sent_at'
  | 'completed_email_sent_at'

export type JobEmailStageRule = {
  allowedFrom: readonly JobStatus[]
  requiresEstimateDate?: boolean
  requiresScheduleBlocks?: boolean
  requiresCompleted?: boolean
  status?: JobStatus
  timestampField?: JobEmailTimestampField
  syncScheduleSummary?: boolean
}

export const JOB_WORKFLOW: Record<JobStatus, JobWorkflowStatusConfig> = {
  estimate_scheduled: {
    columnTitle: 'Quote scheduled',
    actions: {
      board: ['review_send_quote', 'mark_quote_sent', 'set_quote_date'],
      detail: [
        'send_quote_scheduled',
        'open_quote',
        'send_scheduled_email',
        'mark_quote_sent',
      ],
    },
  },
  estimate_sent: {
    columnTitle: 'Quote sent',
    actions: {
      board: ['move_to_follow_up', 'schedule_job', 'send_follow_up', 'mark_lost'],
      detail: [
        'edit_send_quote',
        'open_quote',
        'schedule_job',
        'send_scheduled_email',
        'send_follow_up',
        'move_to_follow_up',
        'mark_lost',
      ],
    },
  },
  follow_up: {
    columnTitle: 'Follow up',
    actions: {
      board: ['schedule_job', 'send_follow_up', 'mark_lost'],
      detail: [
        'edit_send_quote',
        'open_quote',
        'schedule_job',
        'send_scheduled_email',
        'send_follow_up',
        'mark_lost',
      ],
    },
  },
  scheduled: {
    columnTitle: 'Scheduled',
    actions: {
      board: ['send_scheduled_email', 'mark_completed', 'change_scheduled_date'],
      detail: [
        'edit_send_quote',
        'open_quote',
        'schedule_job',
        'send_scheduled_email',
        'mark_completed',
      ],
    },
  },
  completed: {
    columnTitle: 'Completed',
    actions: {
      board: ['open_closeout'],
      detail: ['open_quote', 'open_job_actuals', 'open_estimate_review', 'open_closeout'],
    },
  },
  lost: {
    columnTitle: 'Lost',
    actions: {
      board: [],
      detail: ['open_quote', 'send_scheduled_email'],
    },
  },
}

const JOB_WORKFLOW_ACTION_DESCRIPTORS: Record<JobWorkflowActionId, JobWorkflowActionDescriptor> = {
  send_quote_scheduled: {
    kind: 'stage_email',
    stage: 'estimate_scheduled',
    tone: 'accent',
    getLabel: () => 'Edit & send quote scheduled',
  },
  review_send_quote: {
    kind: 'stage_email',
    stage: 'estimate_sent',
    getLabel: () => 'Review & send quote',
  },
  edit_send_quote: {
    kind: 'stage_email',
    stage: 'estimate_sent',
    getLabel: () => 'Edit & send quote',
  },
  mark_quote_sent: {
    kind: 'patch_date',
    dateField: 'estimate_sent_at',
    getLabel: () => 'Mark quote sent',
  },
  set_quote_date: {
    kind: 'navigate',
    getHref: (job) => `/crm/jobs/${job.id}/estimate`,
    getLabel: () => 'Set quote date',
  },
  move_to_follow_up: {
    kind: 'patch_status',
    status: 'follow_up',
    getLabel: () => 'Move to follow up',
  },
  schedule_job: {
    kind: 'navigate',
    getHref: (job) => `/crm/jobs/${job.id}/schedule`,
    getLabel: (job) => (job.status === 'scheduled' ? 'Change scheduled date' : 'Schedule job'),
  },
  send_follow_up: {
    kind: 'stage_email',
    stage: 'follow_up',
    getLabel: (_job, surface) => (surface === 'detail' ? 'Edit & send follow up' : 'Send follow up'),
  },
  send_scheduled_email: {
    kind: 'stage_email',
    stage: 'scheduled',
    getTone: (job) => (job.scheduled_email_sent_at ? 'default' : 'accent'),
    getLabel: (job) =>
      stageEmailActionLabel('scheduled', Boolean(job.scheduled_email_sent_at)),
    isVisible: (job, surface) => {
      if (surface === 'board') return true
      return Boolean(job.scheduled_date || job.scheduled_end_date) && job.status !== 'completed'
    },
  },
  mark_completed: {
    kind: 'patch_date',
    dateField: 'completed_at',
    tone: 'accent',
    getLabel: () => 'Mark completed',
  },
  change_scheduled_date: {
    kind: 'navigate',
    getHref: (job) => `/crm/jobs/${job.id}/schedule`,
    getLabel: () => 'Change scheduled date',
  },
  mark_lost: {
    kind: 'patch_status',
    status: 'lost',
    tone: 'danger',
    confirmMessage: 'Mark this job as lost?',
    getLabel: () => 'Mark lost',
  },
  open_closeout: {
    kind: 'open_closeout',
    getTone: (job) => (job.completed_email_sent_at ? 'default' : 'accent'),
    getLabel: () => 'Open closeout',
  },
  open_quote: {
    kind: 'navigate',
    getHref: (job) => {
      const estimateId = resolveQuoteNavigationEstimateId(job)
      return estimateId ? `/crm/quotes/${estimateId}` : `/crm/quotes/create?job=${job.id}`
    },
    getLabel: () => 'Open quote',
  },
  open_job_actuals: {
    kind: 'navigate',
    tone: 'accent',
    getHref: (job) => `/crm/jobs/${job.id}/actuals`,
    getLabel: () => 'Job actuals',
    getDisabledReason: (job) => {
      if (!hasOperationalAcceptedEstimate(job)) {
        return 'Accept a quote before entering job actuals.'
      }
      return null
    },
  },
  open_estimate_review: {
    kind: 'navigate',
    getHref: (job) => `/crm/jobs/${job.id}/review`,
    getLabel: () => 'Quote review',
    getDisabledReason: (job) => {
      if (!hasOperationalAcceptedEstimate(job)) {
        return 'Accept a quote before reviewing the quote.'
      }
      if (job.job_actuals_status !== 'submitted' && job.job_actuals_status !== 'locked') {
        return 'Submit job actuals before quote review.'
      }
      return null
    },
  },
}

export const JOB_ALLOWED_STATUS_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  estimate_scheduled: ['estimate_scheduled', 'estimate_sent', 'follow_up', 'scheduled', 'completed', 'lost'],
  estimate_sent: ['estimate_sent', 'follow_up', 'scheduled', 'completed', 'lost'],
  follow_up: ['follow_up', 'scheduled', 'completed', 'lost'],
  scheduled: ['scheduled', 'completed', 'lost'],
  completed: ['completed'],
  lost: ['lost'],
}

export const JOB_PATCH_IMPLIED_STATUS_ORDER: readonly JobPatchTransitionSignal[] = [
  'completed_at',
  'scheduled_date',
  'estimate_sent_at',
  'estimate_date',
]

export const JOB_PATCH_IMPLIED_STATUS: Record<JobPatchTransitionSignal, JobStatus> = {
  completed_at: 'completed',
  scheduled_date: 'scheduled',
  estimate_sent_at: 'estimate_sent',
  estimate_date: 'estimate_scheduled',
}

export const JOB_EMAIL_STAGE_RULES: Record<StageEmailStage, JobEmailStageRule> = {
  estimate_scheduled: {
    allowedFrom: JOB_STATUSES,
    requiresEstimateDate: true,
  },
  estimate_sent: {
    allowedFrom: JOB_STATUSES,
    status: 'estimate_sent',
    timestampField: 'estimate_sent_at',
  },
  follow_up: {
    allowedFrom: JOB_STATUSES,
  },
  scheduled: {
    allowedFrom: JOB_STATUSES,
    requiresScheduleBlocks: true,
    status: 'scheduled',
    timestampField: 'scheduled_email_sent_at',
    syncScheduleSummary: true,
  },
  completed: {
    allowedFrom: JOB_STATUSES,
    requiresCompleted: true,
    timestampField: 'completed_email_sent_at',
  },
}

export type {
  JobCloseoutNotesPatchPayload,
  JobCompletionPatchPayload,
  JobEstimateDatePatchPayload,
  JobScheduleDatePatchPayload,
  JobStatusPatchPayload,
} from '../../types/jobs/api.ts'

export function isJobStatus(value: string | null | undefined): value is JobStatus {
  return JOB_STATUSES.includes(value as JobStatus)
}

export function isStageEmailStage(value: string | null | undefined): value is StageEmailStage {
  return STAGE_EMAIL_STAGES.includes(value as StageEmailStage)
}

export function stageEmailActionLabel(stage: StageEmailStage, alreadySent: boolean) {
  switch (stage) {
    case 'scheduled':
      return alreadySent ? 'Resend scheduled email' : 'Send scheduled email'
    case 'completed':
      return alreadySent ? 'Resend review email' : 'Send review email'
    case 'estimate_scheduled':
      return 'Send quote scheduled email'
    case 'estimate_sent':
      return 'Send quote email'
    case 'follow_up':
      return 'Send follow up email'
    default:
      return 'Send email'
  }
}

export function formatStageEmailName(stage: StageEmailStage) {
  switch (stage) {
    case 'estimate_scheduled':
      return 'quote scheduled'
    case 'estimate_sent':
      return 'quote'
    case 'follow_up':
      return 'follow up'
    case 'scheduled':
      return 'scheduled'
    case 'completed':
      return 'review'
    default:
      return 'email'
  }
}

export function createJobStatusBuckets<T>() {
  return {
    estimate_scheduled: [] as T[],
    estimate_sent: [] as T[],
    follow_up: [] as T[],
    scheduled: [] as T[],
    completed: [] as T[],
    lost: [] as T[],
  }
}

export function jobHasWorkflowAction(
  surface: JobWorkflowSurface,
  status: JobStatus,
  actionId: JobWorkflowActionId
) {
  return JOB_WORKFLOW[status].actions[surface].includes(actionId)
}

export function getJobWorkflowActions(
  surface: JobWorkflowSurface,
  job: JobWorkflowSubject
): JobWorkflowResolvedAction[] {
  const actions: Array<JobWorkflowResolvedAction | null> = JOB_WORKFLOW[job.status].actions[surface]
    .map((id) => {
      const descriptor = JOB_WORKFLOW_ACTION_DESCRIPTORS[id]
      if (descriptor.isVisible && !descriptor.isVisible(job, surface)) {
        return null
      }
      return {
        id,
        kind: descriptor.getDisabledReason?.(job, surface) ? 'message' : descriptor.kind,
        tone: descriptor.getTone?.(job, surface) ?? descriptor.tone ?? 'default',
        label: descriptor.getLabel(job, surface),
        href: descriptor.getHref?.(job),
        disabledReason: descriptor.getDisabledReason?.(job, surface) ?? undefined,
        stage: descriptor.stage,
        status: descriptor.status,
        dateField: descriptor.dateField,
        confirmMessage: descriptor.confirmMessage,
      } satisfies JobWorkflowResolvedAction
    })
  return actions.filter((value): value is JobWorkflowResolvedAction => value != null)
}

export function resolveImpliedJobStatusFromPatch(
  patch: Partial<Record<JobPatchTransitionSignal, unknown>>
) {
  for (const signal of JOB_PATCH_IMPLIED_STATUS_ORDER) {
    if (patch[signal]) {
      return JOB_PATCH_IMPLIED_STATUS[signal]
    }
  }
  return null
}

export function jobStageAllowsCurrentStatus(
  stage: StageEmailStage,
  status: string | null | undefined
) {
  if (!isJobStatus(status)) return false
  return JOB_EMAIL_STAGE_RULES[stage].allowedFrom.includes(status)
}
