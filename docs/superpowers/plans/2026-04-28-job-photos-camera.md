# Job Photos Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the version-one Job Photos workflow so users can select a job, queue camera or uploaded images, upload them to Google Drive by category, and persist org-scoped metadata in `public.job_site_photos`.

**Architecture:** Keep the route handler thin and jobs-scoped. Put validation, folder naming, Google Drive calls, idempotency, and database writes in `lib/jobs/sitePhotos.ts`; keep the UI in a new shared-CRM page with route-local hook state.

**Tech Stack:** Next.js App Router, React client components, Supabase service-role server access, Google Drive helpers, Vitest, Node `node:test`, SQL migrations.

---

## Architecture Fit Summary

- Reuse `public.job_site_photos`; do not add a separate photo table.
- Reuse `lib/server/googleDrive.ts` `ensureDriveFolder` and `uploadDriveFile`.
- Reuse jobs API conventions from `app/api/jobs/[id]/route.ts`: `requireSessionUserOrg`, `resolveParams`, `readUuidParam`, and `serviceResultResponse`.
- Reuse `lib/jobs/client.ts` as the browser API boundary.
- Reuse shared CRM UI primitives: `CrmPageShell`, `CrmPageHeader`, `CrmSectionCard`, `CrmButton`, `CrmNotice`, `CrmEmptyState`, `CrmSearchBar`, and `CrmChip`.
- Introduce `lib/jobs/sitePhotos.ts` because Drive upload orchestration is jobs-domain business logic, not route or component logic.
- Introduce `app/crm/job-photos/_hooks/useJobPhotosUploadPage.ts` because queue, preview URL, upload, and retry state should stay out of the page component.

## File Structure

- Create `supabase/sql/070_job_site_photos_categories.sql`: additive schema for `category`, `job_drive_folder_id`, category check, and category-aware index.
- Create `lib/jobs/sitePhotos.ts`: server-side photo types, validation, folder/file naming, list service, upload service, idempotency, and test dependency injection.
- Create `lib/jobs/__tests__/sitePhotos.test.ts`: pure helper and mocked service tests.
- Create `app/api/jobs/[id]/site-photos/route.ts`: thin `GET` and `POST` API adapter.
- Create `app/api/__tests__/JobSitePhotosRoute.test.tsx`: route envelope and multipart parsing tests.
- Modify `lib/jobs/client.ts`: client types and `listJobSitePhotos`, `uploadJobSitePhotos`, `getJobPhotosFolderUrl`.
- Create `app/crm/job-photos/_hooks/useJobPhotosUploadPage.ts`: upload workflow state.
- Create `app/crm/job-photos/page.tsx`: shared CRM UI for the job photo workflow.
- Create `app/crm/job-photos/__tests__/JobPhotosPage.test.tsx`: queue, remove, upload, and partial failure tests.
- Modify `app/crm/jobs/_hooks/useJobDetailPage.ts`: load photo folder metadata.
- Modify `app/crm/jobs/[id]/page.tsx`: render lightweight `Open Photos` link.
- Create `app/crm/jobs/[id]/__tests__/JobDetailPhotosLink.test.tsx`: detail link visibility tests.

## API Contract Impact

- Add `GET /api/jobs/[id]/site-photos`.
- Add `POST /api/jobs/[id]/site-photos`.
- `GET` returns `{ data: { photosByCategory, jobFolder, categoryFolders } }`.
- `POST` accepts multipart fields `category`, repeated `photos`, repeated optional `clientLocalId`, and repeated optional `capturedAt`.
- `POST` returns `{ data: { photos, jobFolder, categoryFolder, failed }, notice? }`.
- Add `public.job_site_photos.category text not null default 'after'`.
- Add `public.job_site_photos.job_drive_folder_id text null`.
- Existing rows remain valid and become `after`.

## Risk or Exception Log

- Repeated multipart `clientLocalId` and `capturedAt` values are associated by index with repeated `photos`; missing values get server fallbacks.
- `GET` constructs Drive folder URLs from stored folder ids rather than fetching Drive metadata.
- HEIC/HEIF preview support may vary by browser; the UI should still show file-name cards for queued items.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/sql/070_job_site_photos_categories.sql`

- [ ] **Step 1: Create migration**

```sql
-- Add category-aware Google Drive metadata for version-one job site photos.

alter table public.job_site_photos
  add column if not exists category text not null default 'after',
  add column if not exists job_drive_folder_id text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_site_photos_category_check'
      and conrelid = 'public.job_site_photos'::regclass
  ) then
    alter table public.job_site_photos
      add constraint job_site_photos_category_check
      check (category in ('before', 'damage', 'after'));
  end if;
end $$;

create index if not exists job_site_photos_job_category_captured_at_idx
  on public.job_site_photos (org_id, job_id, category, captured_at desc, created_at desc);
```

- [ ] **Step 2: Manual migration review**

Confirm the migration is additive: no drops, no renames, and no change to existing `drive_folder_id` meaning.

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/070_job_site_photos_categories.sql
git commit -m "feat: add job site photo category metadata"
```

---

### Task 2: Domain Types and Helper Tests

**Files:**
- Create: `lib/jobs/sitePhotos.ts`
- Create: `lib/jobs/__tests__/sitePhotos.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `lib/jobs/__tests__/sitePhotos.test.ts`:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  JOB_SITE_PHOTO_CATEGORIES,
  buildDriveFolderUrl,
  buildJobPhotoDriveFileName,
  deriveJobPhotoFolderName,
  getSafeJobPhotoExtension,
  isJobSitePhotoCategory,
  normalizeDriveFolderName,
} from '../sitePhotos.ts'

test('category guard accepts only version-one categories', () => {
  assert.deepEqual(JOB_SITE_PHOTO_CATEGORIES, ['before', 'damage', 'after'])
  assert.equal(isJobSitePhotoCategory('before'), true)
  assert.equal(isJobSitePhotoCategory('damage'), true)
  assert.equal(isJobSitePhotoCategory('after'), true)
  assert.equal(isJobSitePhotoCategory('during'), false)
  assert.equal(isJobSitePhotoCategory(null), false)
})

test('folder names prefer address and fall back to title', () => {
  assert.equal(deriveJobPhotoFolderName({ customer_address: ' 123 Main St ', title: 'Paint' }), '123 Main St')
  assert.equal(deriveJobPhotoFolderName({ customer_address: null, title: ' Exterior repaint ' }), 'Exterior repaint')
  assert.equal(deriveJobPhotoFolderName({ customer_address: ' /:*?<>| ', title: ' /:*?<>| ' }), 'Untitled job')
})

test('folder names normalize whitespace and Drive-hostile characters', () => {
  assert.equal(normalizeDriveFolderName('  123   Main / East:*?<>|  '), '123 Main - East')
  assert.equal(normalizeDriveFolderName('Kitchen\\\\Hall'), 'Kitchen-Hall')
})

test('safe extensions preserve known image extensions and fall back from MIME', () => {
  assert.equal(getSafeJobPhotoExtension('IMG_001.JPG', 'image/jpeg'), 'jpg')
  assert.equal(getSafeJobPhotoExtension('damage.webp', 'image/webp'), 'webp')
  assert.equal(getSafeJobPhotoExtension('unknown.bin', 'image/png'), 'png')
  assert.equal(getSafeJobPhotoExtension('unknown', 'image/heic'), 'heic')
})

test('Drive file names are readable and duplicate-safe', () => {
  assert.equal(
    buildJobPhotoDriveFileName({
      capturedAt: new Date('2026-04-28T15:04:05.000Z'),
      category: 'damage',
      clientLocalId: 'abc-12345-xyz',
      originalName: 'Photo One.JPG',
      mimeType: 'image/jpeg',
    }),
    '2026-04-28_15-04-05_damage_abc-12345.jpg'
  )
})

test('Drive folder URLs are constructed from folder ids', () => {
  assert.equal(buildDriveFolderUrl('folder-123'), 'https://drive.google.com/drive/folders/folder-123')
  assert.equal(buildDriveFolderUrl(null), null)
})
```

- [ ] **Step 2: Run test and verify failure**

```bash
node --experimental-specifier-resolution=node --test lib/jobs/__tests__/sitePhotos.test.ts
```

Expected: FAIL because `../sitePhotos.ts` does not exist.

- [ ] **Step 3: Implement helper exports**

Create `lib/jobs/sitePhotos.ts` with:

```ts
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/server/org'
import { ensureDriveFolder, uploadDriveFile } from '@/lib/server/googleDrive'
import { errorResult, okResult, type ServiceResult } from '@/lib/server/serviceResult'

export const JOB_SITE_PHOTO_CATEGORIES = ['before', 'damage', 'after'] as const
export type JobSitePhotoCategory = (typeof JOB_SITE_PHOTO_CATEGORIES)[number]

export const JOB_SITE_PHOTO_LIMITS = {
  maxFiles: 20,
  maxBytesPerFile: 15 * 1024 * 1024,
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
} as const

export type JobSitePhotoRecord = {
  id: string
  job_id: string
  category: JobSitePhotoCategory
  job_drive_folder_id: string | null
  drive_file_id: string
  drive_folder_id: string | null
  url: string
  caption: string | null
  captured_at: string
  uploaded_at: string
  client_local_id?: string | null
}

export type JobSitePhotoFolder = { id: string; webViewLink: string | null }

export type ListJobSitePhotosResponse = {
  photosByCategory: Record<JobSitePhotoCategory, JobSitePhotoRecord[]>
  jobFolder: JobSitePhotoFolder | null
  categoryFolders: Partial<Record<JobSitePhotoCategory, JobSitePhotoFolder>>
}

export type UploadJobSitePhotosResponse = {
  photos: JobSitePhotoRecord[]
  jobFolder: JobSitePhotoFolder | null
  categoryFolder: JobSitePhotoFolder | null
  failed: Array<{ clientLocalId: string; name: string; error: string }>
}

export type JobSitePhotoUploadFile = {
  clientLocalId?: string | null
  name: string
  mimeType: string
  size: number
  data: Buffer
  capturedAt?: string | null
}

export type UploadJobSitePhotosInput = {
  origin: string
  orgId: string
  userId: string
  jobId: string
  category: string | null | undefined
  files: JobSitePhotoUploadFile[]
}

type SitePhotoDeps = {
  getRootFolderId: () => string | null
  ensureDriveFolder: typeof ensureDriveFolder
  uploadDriveFile: typeof uploadDriveFile
  randomId: () => string
  now: () => Date
  db: typeof supabaseAdmin
}

const defaultDeps: SitePhotoDeps = {
  getRootFolderId: () => process.env.GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID ?? null,
  ensureDriveFolder,
  uploadDriveFile,
  randomId: randomUUID,
  now: () => new Date(),
  db: supabaseAdmin,
}

function withDeps(overrides?: Partial<SitePhotoDeps>): SitePhotoDeps {
  return { ...defaultDeps, ...(overrides ?? {}) }
}

export function isJobSitePhotoCategory(value: unknown): value is JobSitePhotoCategory {
  return typeof value === 'string' && JOB_SITE_PHOTO_CATEGORIES.includes(value as JobSitePhotoCategory)
}

export function normalizeDriveFolderName(value: string | null | undefined) {
  const normalized = (value ?? '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .trim()
  return normalized || 'Untitled job'
}

export function deriveJobPhotoFolderName(job: { customer_address?: string | null; title?: string | null }) {
  return normalizeDriveFolderName(job.customer_address || job.title || 'Untitled job')
}

export function getSafeJobPhotoExtension(originalName: string, mimeType: string) {
  const extension = originalName.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extension)) return extension === 'jpeg' ? 'jpg' : extension
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/heic') return 'heic'
  if (mimeType === 'image/heif') return 'heif'
  return 'jpg'
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDriveTimestamp(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}_${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`
}

function shortClientId(clientLocalId: string) {
  return clientLocalId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 9) || 'photo'
}

export function buildJobPhotoDriveFileName(params: {
  capturedAt: Date
  category: JobSitePhotoCategory
  clientLocalId: string
  originalName: string
  mimeType: string
}) {
  return `${formatDriveTimestamp(params.capturedAt)}_${params.category}_${shortClientId(params.clientLocalId)}.${getSafeJobPhotoExtension(params.originalName, params.mimeType)}`
}

export function buildDriveFolderUrl(folderId: string | null | undefined) {
  return folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : null
}
```

- [ ] **Step 4: Run helper tests and commit**

```bash
node --experimental-specifier-resolution=node --test lib/jobs/__tests__/sitePhotos.test.ts
git add lib/jobs/sitePhotos.ts lib/jobs/__tests__/sitePhotos.test.ts
git commit -m "feat: add job site photo domain helpers"
```

Expected: PASS before commit.

---

### Task 3: List and Upload Services

**Files:**
- Modify: `lib/jobs/sitePhotos.ts`
- Modify: `lib/jobs/__tests__/sitePhotos.test.ts`

- [ ] **Step 1: Add service tests**

Append tests covering:

```ts
test('listJobSitePhotos verifies org-scoped job and groups rows by category', async () => {
  // Mock db.from('jobs') to return job-1.
  // Mock db.from('job_site_photos') to return before and damage rows.
  // Assert result.ok, before/damage/after grouping, jobFolder URL, and categoryFolders URLs.
})

test('listJobSitePhotos returns not_found when job is missing', async () => {
  // Mock jobs maybeSingle as null.
  // Assert { ok:false, kind:'not_found', message:'Job not found' }.
})

test('uploadJobSitePhotos rejects invalid category, empty files, too many files, unsupported MIME, and oversize files', async () => {
  // Call uploadJobSitePhotos with each invalid input.
  // Assert validation messages match client-facing copy.
})

test('uploadJobSitePhotos ensures job folder, ensures category folder, uploads images, inserts rows, and returns partial failures', async () => {
  // Mock job lookup, duplicate lookup as null, Drive folder creation, one successful Drive upload, one failed Drive upload, and insert.
  // Assert one photo returned, one failed returned, job_drive_folder_id is job folder, drive_folder_id is category folder.
})

test('uploadJobSitePhotos treats duplicate client_local_id as already uploaded', async () => {
  // Mock duplicate lookup to return an existing row.
  // Assert Drive upload and insert are not called, existing row is returned.
})
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --experimental-specifier-resolution=node --test lib/jobs/__tests__/sitePhotos.test.ts
```

Expected: FAIL because `listJobSitePhotos` and `uploadJobSitePhotos` do not exist.

- [ ] **Step 3: Implement services**

Add these exported functions and internal helpers to `lib/jobs/sitePhotos.ts`:

```ts
type JobSitePhotoRow = {
  id: string
  job_id: string
  category: string | null
  job_drive_folder_id: string | null
  drive_file_id: string
  drive_folder_id: string | null
  url: string
  caption: string | null
  captured_at: string
  uploaded_at: string
  client_local_id?: string | null
}

function toPhotoRecord(row: JobSitePhotoRow): JobSitePhotoRecord {
  return {
    id: row.id,
    job_id: row.job_id,
    category: isJobSitePhotoCategory(row.category) ? row.category : 'after',
    job_drive_folder_id: row.job_drive_folder_id ?? null,
    drive_file_id: row.drive_file_id,
    drive_folder_id: row.drive_folder_id ?? null,
    url: row.url,
    caption: row.caption ?? null,
    captured_at: row.captured_at,
    uploaded_at: row.uploaded_at,
    client_local_id: row.client_local_id ?? null,
  }
}

function emptyPhotosByCategory(): Record<JobSitePhotoCategory, JobSitePhotoRecord[]> {
  return { before: [], damage: [], after: [] }
}

async function loadJobForPhotos(orgId: string, jobId: string, deps: SitePhotoDeps) {
  const { data, error } = await deps.db
    .from('jobs')
    .select('id, title, customer_id, customer:customers(address)')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()
  if (error) return errorResult('server_error', error.message)
  if (!data) return errorResult('not_found', 'Job not found')
  const row = data as { id: string; title: string | null; customer?: { address?: string | null } | null }
  return okResult({ id: row.id, title: row.title ?? null, customer_address: row.customer?.address ?? null })
}

export async function listJobSitePhotos(
  orgId: string,
  jobId: string,
  depsOverride?: Partial<SitePhotoDeps>
): Promise<ServiceResult<ListJobSitePhotosResponse>> {
  const deps = withDeps(depsOverride)
  const job = await loadJobForPhotos(orgId, jobId, deps)
  if (!job.ok) return job
  const { data, error } = await deps.db
    .from('job_site_photos')
    .select('id, job_id, category, job_drive_folder_id, drive_file_id, drive_folder_id, url, caption, captured_at, uploaded_at, client_local_id')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .order('captured_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return errorResult('server_error', error.message)

  const photosByCategory = emptyPhotosByCategory()
  const categoryFolders: ListJobSitePhotosResponse['categoryFolders'] = {}
  let jobFolder: JobSitePhotoFolder | null = null
  for (const row of ((data ?? []) as unknown) as JobSitePhotoRow[]) {
    const photo = toPhotoRecord(row)
    photosByCategory[photo.category].push(photo)
    if (!jobFolder && photo.job_drive_folder_id) jobFolder = { id: photo.job_drive_folder_id, webViewLink: buildDriveFolderUrl(photo.job_drive_folder_id) }
    if (photo.drive_folder_id && !categoryFolders[photo.category]) categoryFolders[photo.category] = { id: photo.drive_folder_id, webViewLink: buildDriveFolderUrl(photo.drive_folder_id) }
  }
  return okResult({ photosByCategory, jobFolder, categoryFolders })
}
```

Then add upload helpers and `uploadJobSitePhotos`:

```ts
function categoryDriveName(category: JobSitePhotoCategory) {
  return category === 'before' ? 'Before' : category === 'damage' ? 'Damage' : 'After'
}

function validateUploadFiles(files: JobSitePhotoUploadFile[]) {
  if (files.length === 0) return 'Add at least one photo before uploading.'
  if (files.length > JOB_SITE_PHOTO_LIMITS.maxFiles) return 'Upload at most 20 photos at a time.'
  for (const file of files) {
    if (!JOB_SITE_PHOTO_LIMITS.acceptedMimeTypes.includes(file.mimeType as never)) return `${file.name} is not a supported image type.`
    if (file.size > JOB_SITE_PHOTO_LIMITS.maxBytesPerFile) return `${file.name} is larger than the 15 MB limit.`
  }
  return null
}

function parseCapturedAt(value: string | null | undefined, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

async function findExistingPhotoByClientLocalId(orgId: string, jobId: string, clientLocalId: string, deps: SitePhotoDeps) {
  const { data, error } = await deps.db
    .from('job_site_photos')
    .select('id, job_id, category, job_drive_folder_id, drive_file_id, drive_folder_id, url, caption, captured_at, uploaded_at, client_local_id')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('client_local_id', clientLocalId)
    .maybeSingle()
  if (error) return errorResult('server_error', error.message)
  return okResult(data ? toPhotoRecord(data as JobSitePhotoRow) : null)
}

export async function uploadJobSitePhotos(
  input: UploadJobSitePhotosInput,
  depsOverride?: Partial<SitePhotoDeps>
): Promise<ServiceResult<UploadJobSitePhotosResponse>> {
  const deps = withDeps(depsOverride)
  if (!isJobSitePhotoCategory(input.category)) return errorResult('validation', 'Choose a valid photo category.')
  const validationError = validateUploadFiles(input.files)
  if (validationError) return errorResult('validation', validationError)
  const rootFolderId = deps.getRootFolderId()
  if (!rootFolderId) return errorResult('server_error', 'Missing GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID configuration.')
  const job = await loadJobForPhotos(input.orgId, input.jobId, deps)
  if (!job.ok) return job

  const photos: JobSitePhotoRecord[] = []
  const failed: UploadJobSitePhotosResponse['failed'] = []
  let jobFolder: JobSitePhotoFolder | null = null
  let categoryFolder: JobSitePhotoFolder | null = null

  for (const file of input.files) {
    const clientLocalId = file.clientLocalId?.trim() || deps.randomId()
    const existing = await findExistingPhotoByClientLocalId(input.orgId, input.jobId, clientLocalId, deps)
    if (!existing.ok) return existing
    if (existing.data) {
      photos.push(existing.data)
      continue
    }
    if (!jobFolder) {
      const ensured = await deps.ensureDriveFolder({
        origin: input.origin,
        orgId: input.orgId,
        userId: input.userId,
        parentFolderId: rootFolderId,
        name: deriveJobPhotoFolderName({ customer_address: job.data.customer_address, title: job.data.title }),
      })
      if ('error' in ensured) return errorResult('server_error', ensured.error)
      jobFolder = { id: ensured.folder.id, webViewLink: ensured.folder.webViewLink ?? buildDriveFolderUrl(ensured.folder.id) }
    }
    if (!categoryFolder) {
      const ensured = await deps.ensureDriveFolder({
        origin: input.origin,
        orgId: input.orgId,
        userId: input.userId,
        parentFolderId: jobFolder.id,
        name: categoryDriveName(input.category),
      })
      if ('error' in ensured) return errorResult('server_error', ensured.error)
      categoryFolder = { id: ensured.folder.id, webViewLink: ensured.folder.webViewLink ?? buildDriveFolderUrl(ensured.folder.id) }
    }
    const capturedAt = parseCapturedAt(file.capturedAt, deps.now())
    const upload = await deps.uploadDriveFile({
      origin: input.origin,
      orgId: input.orgId,
      userId: input.userId,
      folderId: categoryFolder.id,
      name: buildJobPhotoDriveFileName({ capturedAt, category: input.category, clientLocalId, originalName: file.name, mimeType: file.mimeType }),
      mimeType: file.mimeType,
      data: file.data,
    })
    if ('error' in upload) {
      failed.push({ clientLocalId, name: file.name, error: upload.error })
      continue
    }
    const uploadedAt = deps.now().toISOString()
    const { data, error } = await deps.db
      .from('job_site_photos')
      .insert({
        org_id: input.orgId,
        job_id: input.jobId,
        client_local_id: clientLocalId,
        category: input.category,
        job_drive_folder_id: jobFolder.id,
        drive_file_id: upload.file.id,
        drive_folder_id: categoryFolder.id,
        url: upload.file.webViewLink ?? `https://drive.google.com/file/d/${encodeURIComponent(upload.file.id)}/view`,
        caption: null,
        created_by_user_id: input.userId,
        captured_at: capturedAt.toISOString(),
        uploaded_at: uploadedAt,
      })
      .select('id, job_id, category, job_drive_folder_id, drive_file_id, drive_folder_id, url, caption, captured_at, uploaded_at, client_local_id')
      .single()
    if (error) {
      failed.push({ clientLocalId, name: file.name, error: error.message })
      continue
    }
    photos.push(toPhotoRecord(data as JobSitePhotoRow))
  }
  return okResult({ photos, jobFolder, categoryFolder, failed })
}
```

- [ ] **Step 4: Run tests and commit**

```bash
node --experimental-specifier-resolution=node --test lib/jobs/__tests__/sitePhotos.test.ts
git add lib/jobs/sitePhotos.ts lib/jobs/__tests__/sitePhotos.test.ts
git commit -m "feat: add job site photo services"
```

Expected: PASS before commit.

---

### Task 4: API Route

**Files:**
- Create: `app/api/jobs/[id]/site-photos/route.ts`
- Create: `app/api/__tests__/JobSitePhotosRoute.test.tsx`

- [ ] **Step 1: Write route tests**

Test these cases in `app/api/__tests__/JobSitePhotosRoute.test.tsx` using the existing `JobDetailRoute.test.tsx` mocking style:

```ts
it('GET returns { data } from listJobSitePhotos')
it('POST parses category, photos, clientLocalId, and capturedAt from multipart FormData')
it('POST returns 400 when no photos are included')
it('service validation errors map to { error } with 400')
```

- [ ] **Step 2: Run route tests and verify failure**

```bash
npm run test:components -- app/api/__tests__/JobSitePhotosRoute.test.tsx
```

Expected: FAIL because route file does not exist.

- [ ] **Step 3: Implement route**

Create `app/api/jobs/[id]/site-photos/route.ts`:

```ts
import { readUuidParam, requireSessionUserOrg, resolveParams } from '@/lib/server/apiRoute'
import { serviceResultResponse } from '@/lib/server/routeResult'
import { listJobSitePhotos, uploadJobSitePhotos, type JobSitePhotoUploadFile } from '@/lib/jobs/sitePhotos'

async function readJobId(context: { params: { id: string } | Promise<{ id: string }> }) {
  const params = await resolveParams(context)
  return readUuidParam((params as { id?: string } | null | undefined)?.id, 'job id')
}

function jsonError(error: string, status = 400) {
  return Response.json({ error }, { status })
}

function readRepeatedStrings(form: FormData, key: string) {
  return form.getAll(key).map((value) => (typeof value === 'string' ? value : ''))
}

async function readPhotoFiles(form: FormData): Promise<JobSitePhotoUploadFile[]> {
  const clientLocalIds = readRepeatedStrings(form, 'clientLocalId')
  const capturedAtValues = readRepeatedStrings(form, 'capturedAt')
  const files = form.getAll('photos').filter((value): value is File => value instanceof File)
  const result: JobSitePhotoUploadFile[] = []
  for (const [index, file] of files.entries()) {
    result.push({
      clientLocalId: clientLocalIds[index] || null,
      capturedAt: capturedAtValues[index] || null,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    })
  }
  return result
}

export async function GET(_request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response
  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response
  return serviceResultResponse(await listJobSitePhotos(session.session.orgId, jobId.value), (data) => ({ data }))
}

export async function POST(request: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const session = await requireSessionUserOrg()
  if (!session.ok) return session.response
  const jobId = await readJobId(context)
  if (!jobId.ok) return jobId.response
  const form = await request.formData().catch(() => null)
  if (!form) return jsonError('Invalid multipart form data.')
  const files = await readPhotoFiles(form)
  if (files.length === 0) return jsonError('Add at least one photo before uploading.')
  const category = form.get('category')
  return serviceResultResponse(
    await uploadJobSitePhotos({
      origin: new URL(request.url).origin,
      orgId: session.session.orgId,
      userId: session.session.userId,
      jobId: jobId.value,
      category: typeof category === 'string' ? category : null,
      files,
    }),
    (data) => ({ data, notice: 'Photos uploaded.' })
  )
}
```

- [ ] **Step 4: Run route tests and commit**

```bash
npm run test:components -- app/api/__tests__/JobSitePhotosRoute.test.tsx
git add app/api/jobs/[id]/site-photos/route.ts app/api/__tests__/JobSitePhotosRoute.test.tsx
git commit -m "feat: add job site photos API"
```

Expected: PASS before commit.

---

### Task 5: Client API Helpers

**Files:**
- Modify: `lib/jobs/client.ts`

- [ ] **Step 1: Add client types and functions**

Append to `lib/jobs/client.ts`:

```ts
export type JobSitePhotoCategory = 'before' | 'damage' | 'after'

export type JobSitePhotoRecord = {
  id: string
  job_id: string
  category: JobSitePhotoCategory
  job_drive_folder_id: string | null
  drive_file_id: string
  drive_folder_id: string | null
  url: string
  caption: string | null
  captured_at: string
  uploaded_at: string
  client_local_id?: string | null
}

export type JobSitePhotoFolder = { id: string; webViewLink: string | null }

export type ListJobSitePhotosResponse = {
  photosByCategory: Record<JobSitePhotoCategory, JobSitePhotoRecord[]>
  jobFolder: JobSitePhotoFolder | null
  categoryFolders: Partial<Record<JobSitePhotoCategory, JobSitePhotoFolder>>
}

export type UploadJobSitePhotosResponse = {
  photos: JobSitePhotoRecord[]
  jobFolder: JobSitePhotoFolder | null
  categoryFolder: JobSitePhotoFolder | null
  failed: Array<{ clientLocalId: string; name: string; error: string }>
}

export function getJobPhotosFolderUrl(folderId: string | null | undefined) {
  return folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : null
}

export async function listJobSitePhotos(jobId: string) {
  const payload = await requestApi<ApiDataEnvelope<ListJobSitePhotosResponse>>(`/api/jobs/${jobId}/site-photos`, { cache: 'no-store' })
  return payload.data ?? null
}

export async function uploadJobSitePhotos(jobId: string, form: FormData) {
  return requestApi<ApiMutationEnvelope<UploadJobSitePhotosResponse>>(`/api/jobs/${jobId}/site-photos`, {
    method: 'POST',
    body: form,
  })
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add lib/jobs/client.ts
git commit -m "feat: add job site photo client helpers"
```

Expected: PASS before commit.

---

### Task 6: Upload Page Hook

**Files:**
- Create: `app/crm/job-photos/_hooks/useJobPhotosUploadPage.ts`

- [ ] **Step 1: Implement hook**

Create `app/crm/job-photos/_hooks/useJobPhotosUploadPage.ts` with state for:

```ts
jobs, jobsLoading, jobsError, jobQuery, selectedJobId, category, queue, uploading, error, notice, folderUrl
```

Implement these actions:

```ts
setJobQuery
setSelectedJobId
setCategory
addFiles(files: FileList | File[])
removeQueuedPhoto(id: string)
upload()
```

Use this client behavior:

```ts
const MAX_FILES = 20
const MAX_BYTES = 15 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
```

`addFiles` must reject unsupported types, reject files over 15 MB, reject queues over 20, and create object URLs. `removeQueuedPhoto` must revoke the removed object URL. The unmount cleanup must revoke all remaining object URLs. `upload` must build `FormData` with `category`, repeated `clientLocalId`, repeated `capturedAt`, and repeated `photos`; after partial failure it must remove successful files and keep failed files with their error text.

- [ ] **Step 2: Commit**

```bash
git add app/crm/job-photos/_hooks/useJobPhotosUploadPage.ts
git commit -m "feat: add job photos upload hook"
```

---

### Task 7: Job Photos Page

**Files:**
- Create: `app/crm/job-photos/page.tsx`
- Create: `app/crm/job-photos/__tests__/JobPhotosPage.test.tsx`

- [ ] **Step 1: Write page tests**

Create tests for:

```ts
it('queues files, removes mistakes, and uploads remaining files')
it('keeps failed files queued for retry after partial failure')
it('blocks upload when no job is selected')
it('blocks upload when no photos are queued')
```

- [ ] **Step 2: Implement page**

Create `app/crm/job-photos/page.tsx` using shared CRM primitives. Render:

```tsx
<CrmPageShell className="max-w-6xl pb-16">
  <CrmPageHeader eyebrow="Field photo workflow" title="Job Photos" description="Take or upload job photos and file them into Google Drive by job and category." />
  ...
</CrmPageShell>
```

The page must include:

- Job search with `CrmSearchBar`.
- Selectable job cards.
- Category buttons for `Before`, `Damage`, `After`.
- Two native file inputs: `Take Photos` with `capture="environment"` and `Upload Photos` without capture.
- Queue cards showing preview, filename, file size, per-file error, and remove button.
- Upload button text `Upload 1 photo` or `Upload N photos`.
- Success/error notices.
- `Open Photos` link after successful upload when `jobFolder.webViewLink` exists.

- [ ] **Step 3: Run page tests and commit**

```bash
npm run test:components -- app/crm/job-photos/__tests__/JobPhotosPage.test.tsx
git add app/crm/job-photos/page.tsx app/crm/job-photos/__tests__/JobPhotosPage.test.tsx
git commit -m "feat: add job photos upload page"
```

Expected: PASS before commit.

---

### Task 8: Job Detail Open Photos Link

**Files:**
- Modify: `app/crm/jobs/_hooks/useJobDetailPage.ts`
- Modify: `app/crm/jobs/[id]/page.tsx`
- Create: `app/crm/jobs/[id]/__tests__/JobDetailPhotosLink.test.tsx`

- [ ] **Step 1: Write detail link tests**

Test:

```ts
it('shows Open Photos when site photo GET returns a job folder')
it('does not show Open Photos when no job folder exists')
```

- [ ] **Step 2: Update hook**

In `app/crm/jobs/_hooks/useJobDetailPage.ts`, import:

```ts
import { listJobSitePhotos } from '@/lib/jobs/client'
```

Add state:

```ts
const [photosFolderUrl, setPhotosFolderUrl] = useState<string | null>(null)
const [photosLoading, setPhotosLoading] = useState(false)
```

Add effect:

```ts
useEffect(() => {
  if (typeof id !== 'string') {
    setPhotosFolderUrl(null)
    return
  }
  let active = true
  setPhotosLoading(true)
  listJobSitePhotos(id)
    .then((result) => {
      if (active) setPhotosFolderUrl(result?.jobFolder?.webViewLink ?? null)
    })
    .catch(() => {
      if (active) setPhotosFolderUrl(null)
    })
    .finally(() => {
      if (active) setPhotosLoading(false)
    })
  return () => {
    active = false
  }
}, [id])
```

Return:

```ts
photosFolderUrl,
photosLoading,
```

- [ ] **Step 3: Update detail page**

In `app/crm/jobs/[id]/page.tsx`, import `CrmButton` and render this above `JobActionRail` in the Actions card:

```tsx
{controller.photosFolderUrl ? (
  <CrmButton
    href={controller.photosFolderUrl}
    target="_blank"
    rel="noreferrer"
    tone="secondary"
    className="mb-3 justify-center no-underline"
  >
    Open Photos
  </CrmButton>
) : null}
```

- [ ] **Step 4: Run detail tests and commit**

```bash
npm run test:components -- app/crm/jobs/[id]/__tests__/JobDetailPhotosLink.test.tsx
git add app/crm/jobs/_hooks/useJobDetailPage.ts app/crm/jobs/[id]/page.tsx app/crm/jobs/[id]/__tests__/JobDetailPhotosLink.test.tsx
git commit -m "feat: show job photos folder link"
```

Expected: PASS before commit.

---

### Task 9: Final Verification

**Files:**
- All files from Tasks 1-8.

- [ ] **Step 1: Run focused service tests**

```bash
node --experimental-specifier-resolution=node --test lib/jobs/__tests__/sitePhotos.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused route tests**

```bash
npm run test:components -- app/api/__tests__/JobSitePhotosRoute.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run focused page tests**

```bash
npm run test:components -- app/crm/job-photos/__tests__/JobPhotosPage.test.tsx app/crm/jobs/[id]/__tests__/JobDetailPhotosLink.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Optional full check before PR**

```bash
npm run check:full
```

Expected: PASS. If too slow for the session, record focused tests and typecheck results and leave full coverage to CI.

- [ ] **Step 6: Manual smoke test**

Use a dev environment with `GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID` configured:

1. Navigate to `/crm/job-photos`.
2. Select a job with a customer address.
3. Choose `Before`.
4. Add two small JPEG files.
5. Remove one queued image.
6. Click `Upload 1 photo`.
7. Confirm success notice and `Open Photos`.
8. Confirm Drive path is `ACE Job Photos / [Job Address] / Before`.
9. Confirm `public.job_site_photos` has `category = 'before'`, `job_drive_folder_id = [Job Address folder]`, and `drive_folder_id = Before folder`.
10. Open job detail and confirm `Open Photos` appears.

## Validation Checklist

- [ ] Shared CRM UI reused; no duplicate UI primitives.
- [ ] Route handler uses `requireSessionUserOrg` before work.
- [ ] Route handler returns standard envelopes.
- [ ] Service queries include `org_id` and `job_id`.
- [ ] Components do not own Drive/database business rules.
- [ ] Upload limits are enforced client and server side.
- [ ] Partial failures preserve failed files for retry.
- [ ] Duplicate `client_local_id` skips duplicate Drive upload.
- [ ] Existing photos default to `after`.
- [ ] Job detail remains a link only; no gallery.
