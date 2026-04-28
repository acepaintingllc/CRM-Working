# Job Photos Camera Design

Date: 2026-04-28

## Purpose

Add a simple CompanyCam-style job photo workflow to the CRM. Users need a fast way to select a job, take new photos or upload existing photos, and have those photos organized automatically in Google Drive.

The first version should stay intentionally small:

- Pick a job.
- Choose one photo category: `Before`, `Damage`, or `After`.
- Queue one or more photos from camera capture or file selection.
- Review thumbnails and remove mistakes before upload.
- Upload the batch to Google Drive.
- Save CRM metadata so uploaded photos remain connected to the job.

The job detail page should not become a photo gallery in this version. It may show an `Open Photos` link when the job has uploaded photos.

## Existing System Fit

This feature belongs to the jobs area of the CRM.

Relevant existing pieces:

- `public.job_site_photos` already stores canonical job photo metadata.
- `lib/server/googleDrive.ts` already provides `ensureDriveFolder` and `uploadDriveFile`.
- Job route handlers already follow the project route pattern: session/org auth, service delegation, and stable response envelopes.
- Jobs UI already has client helpers in `lib/jobs/client.ts` and page-level orchestration hooks under `app/crm/jobs/_hooks`.
- Shared CRM UI is the right UI family for this feature because it is an operational workflow, not an estimator workspace.

The implementation should extend these paths instead of creating a separate photo storage subsystem.

## User Flow

1. User opens the new CRM `Job Photos` section.
2. User searches for and selects a job.
3. User chooses a category:
   - `Before`
   - `Damage`
   - `After`
4. User adds photos by either:
   - taking new photos with the device camera, or
   - selecting existing photos from the device.
5. Page shows queued thumbnails.
6. User can remove mistaken photos from the queue.
7. User taps `Upload`.
8. The server uploads each photo to Google Drive under the selected job and category.
9. The app records uploaded photo metadata in `job_site_photos`.
10. The page shows a success state with a link to the Drive folder.

## Drive Folder Structure

Use a configured root Drive folder for all job photos:

```text
ACE Job Photos
  [Job Address]
    Before
    Damage
    After
```

The root folder should be configured with an environment variable such as:

```text
GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID
```

The job folder name should use the job address. If the address is missing, fall back to the job title. The implementation should normalize whitespace and avoid Drive-hostile filename characters, but it should keep the folder recognizable to users.

Category folder names should be title case in Drive:

- `Before`
- `Damage`
- `After`

## Data Model

Use the existing `public.job_site_photos` table as the canonical photo metadata table.

Add a category column:

```sql
alter table public.job_site_photos
  add column if not exists category text not null default 'after';
```

Add a check constraint for:

```text
before, damage, after
```

Existing rows should remain valid through the default value. This means prior uploaded site photos become `after` unless a later manual/backfill decision is made.

No new table is required for version one.

## API Design

Add a jobs-scoped route:

```text
GET  /api/jobs/[id]/site-photos
POST /api/jobs/[id]/site-photos
```

Both methods are part of version one. `GET` supports the job detail `Open Photos` link and simple future reuse without building a gallery.

The route should:

- authenticate with the project-standard org/session guard,
- parse route params and form data with shared helpers where available,
- delegate job verification, Drive folder creation, upload, and database writes to a service/domain module,
- return project-standard envelopes.

Suggested response shapes:

```ts
type JobSitePhotoCategory = 'before' | 'damage' | 'after'

type JobSitePhotoRecord = {
  id: string
  job_id: string
  category: JobSitePhotoCategory
  drive_file_id: string
  drive_folder_id: string | null
  url: string
  caption: string | null
  captured_at: string
  uploaded_at: string
}

type UploadJobSitePhotosResponse = {
  photos: JobSitePhotoRecord[]
  folder: {
    id: string
    webViewLink: string | null
  } | null
  failed: Array<{
    clientLocalId: string
    name: string
    error: string
  }>
}
```

`POST` should accept multipart form data:

- `category`: `before | damage | after`
- `photos`: one or more image files
- optional `clientLocalId` values, or server-generated ids if the client does not provide them
- optional `capturedAt` values, falling back to upload time

## Service Ownership

Create a focused service/domain module, likely:

```text
lib/jobs/sitePhotos.ts
```

Responsibilities:

- validate category values,
- verify the job exists and belongs to the org,
- derive the job folder name from address/title,
- ensure the job folder exists under the configured root folder,
- ensure the category folder exists under the job folder,
- upload files using `uploadDriveFile`,
- insert rows into `job_site_photos`,
- handle idempotency through `client_local_id`,
- return uploaded rows and per-file failures.

The route handler should not contain Drive or database business logic.

## Client/UI Design

Add a new page:

```text
app/crm/job-photos/page.tsx
```

Use `Job Photos` as the nav and page label. Use `/crm/job-photos` as the route so the section clearly supports both camera capture and uploading existing photos.

Use shared CRM UI primitives:

- `CrmPageShell`
- `CrmPageHeader`
- `CrmSectionCard`
- `CrmButton`
- `CrmNotice`
- `CrmEmptyState`
- `CrmSearchBar` or the existing job-search pattern if one is already available

Add a page orchestration hook:

```text
app/crm/job-photos/_hooks/useJobPhotosUploadPage.ts
```

The hook should own:

- job list loading,
- selected job state,
- category state,
- queued file state,
- object URL cleanup for previews,
- upload state,
- success/error notices,
- failed-file retry state.

The page component should mostly render the view model and call hook actions.

The file input should support both camera and existing photo upload. On mobile, this can use native browser behavior with image file inputs instead of a custom camera implementation.

## Job Detail Link

Do not add a photo gallery to the job detail page in version one.

Add only a lightweight `Open Photos` link when the job has a known photo folder or at least one uploaded photo. The link should open the Drive folder, not a CRM gallery.

Derive the folder link from existing `job_site_photos.drive_folder_id` rows through `GET /api/jobs/[id]/site-photos`. If no uploaded photo row exists yet, do not show the link.

## Error Handling

Client-side blocking errors:

- no job selected,
- no category selected,
- no photos queued,
- unsupported file type if the browser provides one.

Server-side errors:

- unauthenticated or org mismatch,
- job not found,
- missing `GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID`,
- Google Drive token/connection failure,
- Drive folder creation failure,
- individual file upload failure,
- database insert failure.

For partial failures, return successful uploads and failed file details. The client should remove successful files from the queue and leave failed files available for retry.

## Permissions And Security

All reads and writes must be org-scoped.

Route handlers must use the project-standard org/session guard. Service queries must include `org_id` and `job_id` when verifying jobs and writing photo metadata.

The upload route should reject non-image files. It should also enforce conservative upload limits so requests are bounded.

Version one limits should be:

- maximum 20 files per upload request,
- maximum 15 MB per file,
- image MIME types only.

## Observability

Version one does not need a new telemetry system.

Server errors should produce clear user-facing messages and enough server-side context for debugging. Do not log file contents.

## Testing

Add focused tests for:

- category validation,
- job folder naming fallback behavior,
- service behavior with mocked Drive helpers,
- idempotent insert behavior using `client_local_id`,
- upload response shape with all-success and partial-failure cases,
- client queue add/remove/upload behavior.

Run targeted tests for the touched area plus typecheck before implementation is considered complete.

## Out Of Scope

Version one should not include:

- embedded job detail photo gallery,
- room-level tagging,
- comments or annotations on photos,
- offline-first upload queue,
- background sync,
- AI categorization,
- photo markup,
- custom in-browser camera controls,
- deleting Drive files from the CRM,
- moving photos between jobs or categories after upload.

## Fixed Version One Decisions

- User-facing nav/page label: `Job Photos`.
- Upload limits: 20 files per request, 15 MB per file, image MIME types only.
- Implement both `GET` and `POST /api/jobs/[id]/site-photos`.
- Do not add a separate job-level Drive folder id in version one. Derive folder links from uploaded `job_site_photos.drive_folder_id` rows.
- Existing backfilled rows remain categorized as `after`.
