import { randomUUID } from 'node:crypto'

import { errorResult, okResult, type ServiceResult } from '../server/serviceResult.ts'

export const JOB_SITE_PHOTO_CATEGORIES = ['before', 'damage', 'after'] as const
export type JobSitePhotoCategory = (typeof JOB_SITE_PHOTO_CATEGORIES)[number]

export const JOB_SITE_PHOTO_LIMITS = {
  maxFiles: 20,
  maxBytesPerFile: 15 * 1024 * 1024,
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
} as const

export type JobSitePhotoRecord = {
  id: string
  org_id: string
  job_id: string
  category: JobSitePhotoCategory
  job_drive_folder_id?: string | null
  drive_file_id: string
  drive_folder_id: string | null
  drive_url?: string | null
  url?: string | null
  caption?: string | null
  file_name?: string | null
  original_name?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  captured_at: string
  uploaded_at?: string | null
  client_local_id: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type JobSitePhotoResponse = {
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

export type JobSitePhotoFolderRecord = {
  id: string
  org_id: string
  job_id: string
  drive_folder_id: string
  drive_folder_url: string | null
  folder_name: string
  created_at: string
  updated_at: string | null
}

export type JobSitePhotoFolderResponse = {
  job_id: string
  drive_folder_id: string
  drive_folder_url: string | null
  folder_name: string
}

export type JobSitePhotoUploadFile = {
  buffer: Buffer | Uint8Array | ArrayBuffer
  originalName: string
  mimeType: string
  sizeBytes: number
  category?: JobSitePhotoCategory | string | null
  capturedAt?: string | Date | null
  clientLocalId?: string | null
}

export type UploadJobSitePhotosInput = {
  orgId: string
  jobId: string
  userId: string
  createdByUserId?: string | null
  origin: string
  category: unknown
  files: JobSitePhotoUploadFile[]
}

type DriveFolderSummary = { id: string | null; webViewLink: string | null }
export type ListJobSitePhotosData = {
  photos: Record<JobSitePhotoCategory, JobSitePhotoResponse[]>
  jobFolder: DriveFolderSummary
  categoryFolders: Record<JobSitePhotoCategory, DriveFolderSummary>
}
export type UploadJobSitePhotoFailure = { originalName: string; clientLocalId: string; message: string }
export type UploadJobSitePhotosData = {
  photos: JobSitePhotoResponse[]
  failed: UploadJobSitePhotoFailure[]
  jobFolder: DriveFolderSummary
  categoryFolder: DriveFolderSummary
}

type QueryResponse<T> = { data: T | null; error: { code?: string | null; message?: string | null } | null }
type QueryBuilder = {
  select(columns: string): QueryBuilder
  eq(column: string, value: unknown): QueryBuilder
  order(column: string, options?: { ascending?: boolean }): QueryBuilder
  insert(payload: Record<string, unknown>): QueryBuilder
  maybeSingle<T = unknown>(): Promise<QueryResponse<T>>
  single<T = unknown>(): Promise<QueryResponse<T>>
  then<TResult1 = QueryResponse<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>
}
type DbClient = { from(table: string): QueryBuilder }
type DriveFolder = { id: string; name: string; webViewLink?: string | null }
type DriveFile = { id: string; name: string; webViewLink?: string | null }
type EnsureDriveFolder = (params: { origin: string; orgId: string; userId: string; parentFolderId: string; name: string }) => Promise<{ folder: DriveFolder } | { error: string; status?: number }>
type UploadDriveFile = (params: { origin: string; orgId: string; userId: string; folderId: string; name: string; mimeType: string; data: Buffer }) => Promise<{ file: DriveFile } | { error: string; status?: number }>
type SitePhotoDepsOverride = Partial<{
  db: DbClient
  ensureDriveFolder: EnsureDriveFolder
  uploadDriveFile: UploadDriveFile
  randomUUID: () => string
  now: () => Date
  env: Record<string, string | undefined>
}>
type JobPhotoDbDeps = { db: DbClient }
type UploadDeps = {
  db: DbClient
  ensureDriveFolder: EnsureDriveFolder
  uploadDriveFile: UploadDriveFile
  randomUUID: () => string
  now: () => Date
  env: Record<string, string | undefined>
}
type JobLookupRow = {
  id?: string | null
  title?: string | null
  customer_id?: string | null
  address?: string | null
  customer?: { address?: string | null } | { address?: string | null }[] | null
  customers?: { address?: string | null } | { address?: string | null }[] | null
}
type SitePhotoRow = Partial<JobSitePhotoRecord> & Record<string, unknown>

const sitePhotoSelect = [
  'id',
  'job_id',
  'category',
  'job_drive_folder_id',
  'drive_file_id',
  'drive_folder_id',
  'url',
  'caption',
  'captured_at',
  'uploaded_at',
  'client_local_id',
  'created_at',
].join(', ')

async function getDb(depsOverride?: SitePhotoDepsOverride): Promise<DbClient> {
  if (depsOverride?.db) return depsOverride.db
  const { supabaseAdmin } = await import('../server/org.ts')
  return supabaseAdmin as unknown as DbClient
}

async function getUploadDeps(depsOverride?: SitePhotoDepsOverride): Promise<UploadDeps> {
  const driveModule = depsOverride?.ensureDriveFolder && depsOverride?.uploadDriveFile ? null : await import('../server/googleDrive.ts')
  return {
    db: await getDb(depsOverride),
    ensureDriveFolder: depsOverride?.ensureDriveFolder ?? driveModule!.ensureDriveFolder,
    uploadDriveFile: depsOverride?.uploadDriveFile ?? driveModule!.uploadDriveFile,
    randomUUID: depsOverride?.randomUUID ?? randomUUID,
    now: depsOverride?.now ?? (() => new Date()),
    env: depsOverride?.env ?? process.env,
  }
}
function emptyPhotoGroups(): Record<JobSitePhotoCategory, JobSitePhotoResponse[]> {
  return { before: [], damage: [], after: [] }
}

function emptyCategoryFolders(): Record<JobSitePhotoCategory, DriveFolderSummary> {
  return {
    before: { id: null, webViewLink: null },
    damage: { id: null, webViewLink: null },
    after: { id: null, webViewLink: null },
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asCustomerAddress(value: unknown): string | null {
  if (Array.isArray(value)) return asCustomerAddress(value[0])
  if (!value || typeof value !== 'object') return null
  return asString((value as { address?: unknown }).address)
}

function readJobAddress(row: JobLookupRow): string | null {
  return asString(row.address) ?? asCustomerAddress(row.customer) ?? asCustomerAddress(row.customers)
}

async function loadJobForSitePhotos(deps: JobPhotoDbDeps, orgId: string, jobId: string): Promise<ServiceResult<JobLookupRow>> {
  const { data, error } = await deps.db
    .from('jobs')
    .select('id, title, customer_id, customer:customers(address)')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle<JobLookupRow>()
  if (error) return errorResult('server_error', error.message ?? 'Unable to load job.')
  if (!data) return errorResult('not_found', 'Job not found')
  return okResult(data)
}

function toPhotoResponse(row: SitePhotoRow): JobSitePhotoResponse {
  const category = isJobSitePhotoCategory(row.category) ? row.category : 'before'
  const url = asString(row.url) ?? asString(row.drive_url)
  const capturedAt = asString(row.captured_at) ?? ''
  const createdAt = asString(row.created_at)
  const uploadedAt = asString(row.uploaded_at)
  const driveFolderId = asString(row.drive_folder_id)
  const jobDriveFolderId = asString(row.job_drive_folder_id)
  const driveFileId = asString(row.drive_file_id) ?? ''
  const clientLocalId = asString(row.client_local_id)
  const fileName = asString(row.file_name)
  const originalName = asString(row.original_name)
  const mimeType = asString(row.mime_type)
  const sizeBytes = asNumber(row.size_bytes)
  return {
    id: asString(row.id) ?? '',
    job_id: asString(row.job_id) ?? '',
    jobId: asString(row.job_id) ?? '',
    category,
    job_drive_folder_id: jobDriveFolderId,
    jobDriveFolderId,
    drive_file_id: driveFileId,
    driveFileId,
    drive_folder_id: driveFolderId,
    driveFolderId,
    url,
    drive_url: url,
    driveUrl: url,
    caption: asString(row.caption),
    file_name: fileName,
    fileName,
    original_name: originalName,
    originalName,
    mime_type: mimeType,
    mimeType,
    size_bytes: sizeBytes,
    sizeBytes,
    captured_at: capturedAt,
    capturedAt,
    uploaded_at: uploadedAt,
    uploadedAt,
    client_local_id: clientLocalId,
    clientLocalId,
    created_at: createdAt,
    createdAt,
  }
}

function folderSummary(folderId: string | null | undefined): DriveFolderSummary {
  const id = folderId ?? null
  return { id, webViewLink: buildDriveFolderUrl(id) }
}

function categoryLabel(category: JobSitePhotoCategory): string {
  return `${category.slice(0, 1).toUpperCase()}${category.slice(1)}`
}

function parseCapturedAt(value: string | Date | null | undefined, fallback: Date): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  return fallback.toISOString()
}

function toBuffer(value: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value))
  return Buffer.from(value)
}

export function isJobSitePhotoCategory(value: unknown): value is JobSitePhotoCategory {
  return typeof value === 'string' && JOB_SITE_PHOTO_CATEGORIES.includes(value as JobSitePhotoCategory)
}

export function normalizeDriveFolderName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/-{2,}/g, '-')
    .trim()
}

export function deriveJobPhotoFolderName(input: { customerAddress?: string | null; title?: string | null }): string {
  const address = normalizeDriveFolderName(input.customerAddress ?? '')
  if (address) return address
  const title = normalizeDriveFolderName(input.title ?? '')
  if (title) return title
  return 'Untitled job'
}

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}
const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'])

export function getSafeJobPhotoExtension(input: { originalName?: string | null; mimeType?: string | null }): string {
  const originalName = input.originalName ?? ''
  const lastDotIndex = originalName.lastIndexOf('.')
  const rawExtension = lastDotIndex >= 0 ? originalName.slice(lastDotIndex + 1).toLowerCase() : ''
  if (allowedExtensions.has(rawExtension)) return rawExtension === 'jpeg' ? 'jpg' : rawExtension
  return extensionByMimeType[(input.mimeType ?? '').toLowerCase()] ?? 'jpg'
}

function formatUtcTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const second = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hour}-${minute}-${second}`
}

function shortClientLocalId(value: string | null | undefined): string {
  const sanitized = (value ?? '').replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 9)
  return sanitized || 'upload'
}

export function buildJobPhotoDriveFileName(input: {
  capturedAt: string | Date
  category: JobSitePhotoCategory
  clientLocalId?: string | null
  originalName?: string | null
  mimeType?: string | null
}): string {
  return `${formatUtcTimestamp(input.capturedAt)}_${input.category}_${shortClientLocalId(input.clientLocalId)}.${getSafeJobPhotoExtension({ originalName: input.originalName, mimeType: input.mimeType })}`
}

export function buildDriveFolderUrl(folderId: string | null | undefined): string | null {
  if (!folderId) return null
  return `https://drive.google.com/drive/folders/${folderId}`
}

function buildDriveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}

function isUniqueConflict(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  return error.code === '23505' || message.includes('duplicate') || message.includes('unique')
}

export async function listJobSitePhotos(
  orgId: string,
  jobId: string,
  depsOverride?: SitePhotoDepsOverride
): Promise<ServiceResult<ListJobSitePhotosData>> {
  const deps = { db: await getDb(depsOverride) }
  const jobResult = await loadJobForSitePhotos(deps, orgId, jobId)
  if (!jobResult.ok) return jobResult
  const { data, error } = await deps.db
    .from('job_site_photos')
    .select(sitePhotoSelect)
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .order('captured_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return errorResult('server_error', error.message ?? 'Unable to load job site photos.')

  const photos = emptyPhotoGroups()
  const categoryFolders = emptyCategoryFolders()
  let jobFolderId: string | null = null
  for (const row of ((data ?? []) as SitePhotoRow[])) {
    const photo = toPhotoResponse(row)
    photos[photo.category].push(photo)
    jobFolderId = jobFolderId ?? photo.job_drive_folder_id
    if (!categoryFolders[photo.category].id && photo.drive_folder_id) categoryFolders[photo.category] = folderSummary(photo.drive_folder_id)
  }
  return okResult({ photos, jobFolder: folderSummary(jobFolderId), categoryFolders })
}

function validateUploadInput(input: UploadJobSitePhotosInput): JobSitePhotoCategory | ServiceResult<never> {
  if (!isJobSitePhotoCategory(input.category)) return errorResult('invalid_input', 'Choose a valid photo category.')
  if (input.files.length === 0) return errorResult('invalid_input', 'Add at least one photo before uploading.')
  if (input.files.length > JOB_SITE_PHOTO_LIMITS.maxFiles) return errorResult('invalid_input', 'Upload at most 20 photos at a time.')
  const acceptedMimeTypes = new Set<string>(JOB_SITE_PHOTO_LIMITS.acceptedMimeTypes)
  for (const file of input.files) {
    if (file.sizeBytes <= 0) return errorResult('invalid_input', `${file.originalName} is empty.`)
    if (!acceptedMimeTypes.has(file.mimeType)) return errorResult('invalid_input', `${file.originalName} is not a supported image type.`)
    if (file.sizeBytes > JOB_SITE_PHOTO_LIMITS.maxBytesPerFile) return errorResult('invalid_input', `${file.originalName} is larger than the 15 MB limit.`)
  }
  return input.category
}

export async function uploadJobSitePhotos(
  input: UploadJobSitePhotosInput,
  depsOverride?: SitePhotoDepsOverride
): Promise<ServiceResult<UploadJobSitePhotosData>> {
  const validation = validateUploadInput(input)
  if (typeof validation !== 'string') return validation
  const deps = await getUploadDeps(depsOverride)
  const rootFolderId = deps.env.GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID
  if (!rootFolderId) return errorResult('server_error', 'Missing GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID configuration.')
  const jobResult = await loadJobForSitePhotos(deps, input.orgId, input.jobId)
  if (!jobResult.ok) return jobResult

  const photos: JobSitePhotoResponse[] = []
  const failed: UploadJobSitePhotoFailure[] = []
  let jobFolderId: string | null = null
  let categoryFolderId: string | null = null

  for (const file of input.files) {
    // Client-provided IDs are the idempotency mechanism. This generated fallback is
    // intentionally non-idempotent and only supports clients that do not supply one.
    const clientLocalId = file.clientLocalId?.trim() || deps.randomUUID()
    const duplicate = await deps.db
      .from('job_site_photos')
      .select(sitePhotoSelect)
      .eq('org_id', input.orgId)
      .eq('job_id', input.jobId)
      .eq('client_local_id', clientLocalId)
      .maybeSingle<SitePhotoRow>()
    if (duplicate.error) {
      failed.push({ originalName: file.originalName, clientLocalId, message: duplicate.error.message ?? 'Unable to check whether the photo was already uploaded.' })
      continue
    }
    if (duplicate.data) {
      const existingPhoto = toPhotoResponse(duplicate.data)
      photos.push(existingPhoto)
      jobFolderId = jobFolderId ?? existingPhoto.job_drive_folder_id
      if (existingPhoto.category === validation) {
        categoryFolderId = categoryFolderId ?? existingPhoto.drive_folder_id
      }
      continue
    }

    if (!jobFolderId) {
      const ensuredJobFolder = await deps.ensureDriveFolder({
        origin: input.origin,
        orgId: input.orgId,
        userId: input.userId,
        parentFolderId: rootFolderId,
        name: deriveJobPhotoFolderName({ customerAddress: readJobAddress(jobResult.data), title: asString(jobResult.data.title) }),
      })
      if (!('folder' in ensuredJobFolder)) return errorResult('server_error', 'error' in ensuredJobFolder ? ensuredJobFolder.error : 'Unable to prepare the job photo folder.')
      jobFolderId = ensuredJobFolder.folder.id
    }
    if (!categoryFolderId) {
      const ensuredCategoryFolder = await deps.ensureDriveFolder({
        origin: input.origin,
        orgId: input.orgId,
        userId: input.userId,
        parentFolderId: jobFolderId,
        name: categoryLabel(validation),
      })
      if (!('folder' in ensuredCategoryFolder)) return errorResult('server_error', 'error' in ensuredCategoryFolder ? ensuredCategoryFolder.error : 'Unable to prepare the photo category folder.')
      categoryFolderId = ensuredCategoryFolder.folder.id
    }

    const capturedAt = parseCapturedAt(file.capturedAt, deps.now())
    const driveFileName = buildJobPhotoDriveFileName({ capturedAt, category: validation, clientLocalId, originalName: file.originalName, mimeType: file.mimeType })
    const uploaded = await deps.uploadDriveFile({
      origin: input.origin,
      orgId: input.orgId,
      userId: input.userId,
      folderId: categoryFolderId,
      name: driveFileName,
      mimeType: file.mimeType,
      data: toBuffer(file.buffer),
    })
    if (!('file' in uploaded)) {
      failed.push({ originalName: file.originalName, clientLocalId, message: 'error' in uploaded ? uploaded.error : 'Unable to upload the photo to Drive.' })
      continue
    }

    const { data: inserted, error: insertError } = await deps.db
      .from('job_site_photos')
      .insert({
        org_id: input.orgId,
        job_id: input.jobId,
        client_local_id: clientLocalId,
        category: validation,
        job_drive_folder_id: jobFolderId,
        drive_file_id: uploaded.file.id,
        drive_folder_id: categoryFolderId,
        url: uploaded.file.webViewLink ?? buildDriveFileUrl(uploaded.file.id),
        caption: null,
        created_by_user_id: input.createdByUserId ?? input.userId,
        captured_at: capturedAt,
        uploaded_at: deps.now().toISOString(),
      })
      .select(sitePhotoSelect)
      .single<SitePhotoRow>()
    if (insertError || !inserted) {
      if (isUniqueConflict(insertError)) {
        const recovered = await deps.db
          .from('job_site_photos')
          .select(sitePhotoSelect)
          .eq('org_id', input.orgId)
          .eq('job_id', input.jobId)
          .eq('client_local_id', clientLocalId)
          .maybeSingle<SitePhotoRow>()

        if (!recovered.error && recovered.data) {
          const existingPhoto = toPhotoResponse(recovered.data)
          photos.push(existingPhoto)
          jobFolderId = jobFolderId ?? existingPhoto.job_drive_folder_id
          if (existingPhoto.category === validation) {
            categoryFolderId = categoryFolderId ?? existingPhoto.drive_folder_id
          }
          continue
        }
      }
      failed.push({ originalName: file.originalName, clientLocalId, message: insertError?.message ?? 'Unable to save the uploaded photo.' })
      continue
    }
    photos.push(toPhotoResponse(inserted))
  }

  return okResult({ photos, failed, jobFolder: folderSummary(jobFolderId), categoryFolder: folderSummary(categoryFolderId) })
}




