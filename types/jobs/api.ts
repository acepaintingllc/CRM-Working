import type { EstimatePublicTimelineEvent } from '@/types/customer-estimates/publicTimeline'
import type { JobActualsStatus } from '@/types/jobs/feedback'
import type { JobStatus } from '@/types/jobs/status'

export type JobLinkedEstimateSummary = {
  id: string
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  updated_at: string | null
  created_at: string | null
}

export type JobAcceptedEstimateDetail = {
  /**
   * Canonical accepted estimate id resolved from the operational loader.
   * For legacy accepted jobs this can still resolve even when
   * jobs.linked_estimate_id is null.
   */
  estimate_id: string
  accepted_public_version_id: string
  public_version_number: number
  public_token: string | null
  accepted_at: string
  accepted_by_legal_name: string | null
  signature_type: string | null
  user_agent: string | null
  ip: string | null
  version_name: string | null
  estimate_snapshot_id: string | null
  estimated_labor_hours: number
  estimated_paint_gallons: number
  estimated_supplies_cost: number
  estimated_other_cost: number
  final_total: number
}

export type JobSummary = {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  title: string
  description: string | null
  status: JobStatus
  created_at?: string | null
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  scheduled_end_date?: string | null
  scheduled_email_sent_at?: string | null
  completed_at: string | null
  completed_email_sent_at?: string | null
  closeout_notes?: string | null
  /**
   * Canonical accepted estimate link for operational job workflows such as
   * closeout catalogs, work orders, invoices, actuals, and review.
   */
  linked_estimate_id?: string | null
}

export type JobDetail = JobSummary & {
  customer_email: string | null
  customer_phone: string | null
  scheduled_end_date: string | null
  /**
   * Quote/estimate rows for timeline and quote navigation surfaces. This is not
   * the operational accepted-estimate contract.
   */
  linked_estimates?: JobLinkedEstimateSummary[]
  /**
   * Navigation-only estimate id for the user-facing Quote route. This can fall
   * back to the first linked estimate row for legacy/draft navigation, but it
   * must never be treated as accepted-estimate ownership.
   */
  estimate_navigation_id?: string | null
  /**
   * Canonical operational accepted-estimate data. This may be populated from a
   * legacy accepted-estimate fallback even when linked_estimate_id is null.
   */
  accepted_estimate?: JobAcceptedEstimateDetail | null
  job_actuals_status?: JobActualsStatus | null
  public_quote_timeline_events?: EstimatePublicTimelineEvent[]
}

export type EstimateDriveFile = {
  id: string
  name: string
  version?: number | null
  matchMode?: 'exact' | 'normalized' | 'manual' | string
  webViewLink?: string | null
}

export type ScheduleRow = {
  id: string
  start_at: string
  end_at: string
  notes: string | null
  calendar_event_id: string | null
  calendar_added_at: string | null
}

export type JobScheduleMeta = {
  scheduled_email_sent_at?: string | null
}

export type CreateJobPayload = {
  customer_id: string
  title: string
  description: string | null
  status: JobStatus
  estimate_date: string | null
  scheduled_date: string | null
}

export type JobStatusPatchPayload = {
  status: JobStatus
}

export type JobEstimateDatePatchPayload = {
  estimate_date: string
  status?: Extract<JobStatus, 'estimate_scheduled'>
}

export type JobCompletionPatchPayload = {
  completed_at: string
}

export type JobCloseoutNotesPatchPayload = {
  closeout_notes: string | null
}

export type JobScheduleDatePatchPayload = {
  scheduled_date: string | null
  scheduled_end_date?: string | null
  status?: Extract<JobStatus, 'scheduled'>
}

export type JobCalendarEventPayload = {
  summary: string
  location?: string | null
  description?: string | null
  startIso: string
  endIso: string
}

export type CalendarAddResult = {
  scheduleId: string
  eventId?: string | null
  skipped?: boolean
}

export type JobSitePhotoCategory = 'before' | 'damage' | 'after'

export type JobSitePhotoRecord = {
  id: string
  job_id: string
  jobId: string
  category: JobSitePhotoCategory
  job_drive_folder_id: string | null
  jobDriveFolderId: string | null
  drive_file_id: string
  driveFileId: string
  drive_folder_id: string | null
  driveFolderId: string | null
  url: string | null
  drive_url: string | null
  driveUrl: string | null
  caption: string | null
  file_name: string | null
  fileName: string | null
  original_name: string | null
  originalName: string | null
  mime_type: string | null
  mimeType: string | null
  size_bytes: number | null
  sizeBytes: number | null
  captured_at: string
  capturedAt: string
  uploaded_at: string | null
  uploadedAt: string | null
  client_local_id: string | null
  clientLocalId: string | null
  created_at: string | null
  createdAt: string | null
}

export type JobSitePhotoFolder = { id: string | null; webViewLink: string | null }

export type ListJobSitePhotosResponse = {
  photos: Record<JobSitePhotoCategory, JobSitePhotoRecord[]>
  jobFolder: JobSitePhotoFolder
  categoryFolders: Record<JobSitePhotoCategory, JobSitePhotoFolder>
}

export type UploadJobSitePhotoFailure = {
  originalName: string
  clientLocalId: string
  message: string
}

export type UploadJobSitePhotosResponse = {
  photos: JobSitePhotoRecord[]
  jobFolder: JobSitePhotoFolder
  categoryFolder: JobSitePhotoFolder
  failed: UploadJobSitePhotoFailure[]
}
