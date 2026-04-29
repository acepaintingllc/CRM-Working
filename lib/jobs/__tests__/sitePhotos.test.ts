import test from 'node:test'
import assert from 'node:assert/strict'
import {
  JOB_SITE_PHOTO_CATEGORIES,
  JOB_SITE_PHOTO_LIMITS,
  buildDriveFolderUrl,
  buildJobPhotoDriveFileName,
  deriveJobPhotoFolderName,
  getSafeJobPhotoExtension,
  isJobSitePhotoCategory,
  listJobSitePhotos,
  normalizeDriveFolderName,
  uploadJobSitePhotos,
} from '../sitePhotos.ts'

type MockQueryResult<T = unknown> = {
  data: T | null
  error: { code?: string | null; message?: string | null } | null
}

type MockCall = {
  table: string
  method: string
  column?: string
  value?: unknown
  options?: unknown
}

function createQueryBuilder(result: MockQueryResult, table: string, calls: MockCall[]) {
  const builder = {
    select(value: string) {
      calls.push({ table, method: 'select', value })
      return builder
    },
    eq(column: string, value: unknown) {
      calls.push({ table, method: 'eq', column, value })
      return builder
    },
    order(column: string, options?: unknown) {
      calls.push({ table, method: 'order', column, options })
      return builder
    },
    insert(value: unknown) {
      calls.push({ table, method: 'insert', value })
      return builder
    },
    maybeSingle<T = unknown>() {
      calls.push({ table, method: 'maybeSingle' })
      return Promise.resolve(result as MockQueryResult<T>)
    },
    single<T = unknown>() {
      calls.push({ table, method: 'single' })
      return Promise.resolve(result as MockQueryResult<T>)
    },
    then<TResult1 = MockQueryResult<unknown>, TResult2 = never>(
      onfulfilled?: ((value: MockQueryResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve(result).then(onfulfilled, onrejected)
    },
  }
  return builder
}

function createDbMock(responsesByTable: Record<string, MockQueryResult[]>) {
  const calls: MockCall[] = []
  const queues = new Map<string, MockQueryResult[]>(
    Object.entries(responsesByTable).map(([table, responses]) => [table, responses.slice()])
  )
  const db = {
    from(table: string) {
      const queue = queues.get(table)
      if (!queue || queue.length === 0) throw new Error(`No mock response queued for ${table}`)
      calls.push({ table, method: 'from' })
      return createQueryBuilder(queue.shift() as MockQueryResult, table, calls)
    },
  }
  return { db, calls }
}

const validUploadFile = {
  buffer: Buffer.from('image-bytes'),
  originalName: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  capturedAt: '2026-04-28T15:04:05.000Z',
  clientLocalId: 'local-1',
}

test('job site photo categories expose before damage and after', () => {
  assert.deepEqual(JOB_SITE_PHOTO_CATEGORIES, ['before', 'damage', 'after'])
})

test('isJobSitePhotoCategory accepts known categories and rejects unknown values', () => {
  assert.equal(isJobSitePhotoCategory('before'), true)
  assert.equal(isJobSitePhotoCategory('damage'), true)
  assert.equal(isJobSitePhotoCategory('after'), true)
  assert.equal(isJobSitePhotoCategory('during'), false)
  assert.equal(isJobSitePhotoCategory(null), false)
})

test('deriveJobPhotoFolderName prefers address then title then untitled fallback', () => {
  assert.equal(deriveJobPhotoFolderName({ customerAddress: '  123 Main St  ', title: 'Interior repaint' }), '123 Main St')
  assert.equal(deriveJobPhotoFolderName({ customerAddress: '   ', title: '  Interior repaint  ' }), 'Interior repaint')
  assert.equal(deriveJobPhotoFolderName({ customerAddress: '   ', title: '\t\n' }), 'Untitled job')
})

test('normalizeDriveFolderName replaces Drive-hostile characters and normalizes separators', () => {
  const normalized = normalizeDriveFolderName('  123 / Main: * Bad?? "Name" <A> | B  ')
  assert.equal(normalized.includes('/'), false)
  assert.equal(normalized.includes(':'), false)
  assert.equal(normalized.includes('*'), false)
  assert.equal(normalized.includes('?'), false)
  assert.equal(normalized.includes('"'), false)
  assert.equal(normalized.includes('<'), false)
  assert.equal(normalized.includes('>'), false)
  assert.equal(normalized.includes('|'), false)
  assert.equal(normalized.includes('  '), false)
  assert.equal(normalized.includes('--'), false)
  assert.equal(normalizeDriveFolderName('Alpha---Beta////Gamma'), 'Alpha-Beta-Gamma')
})

test('getSafeJobPhotoExtension normalizes image extensions and falls back from MIME type', () => {
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.JPG', mimeType: 'image/jpeg' }), 'jpg')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.jpeg', mimeType: 'image/jpeg' }), 'jpg')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.png', mimeType: 'image/jpeg' }), 'png')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.webp', mimeType: 'image/jpeg' }), 'webp')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.heic', mimeType: 'image/jpeg' }), 'heic')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo.heif', mimeType: 'image/jpeg' }), 'heif')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo', mimeType: 'image/png' }), 'png')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo', mimeType: 'image/webp' }), 'webp')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo', mimeType: 'image/heic' }), 'heic')
  assert.equal(getSafeJobPhotoExtension({ originalName: 'photo', mimeType: 'image/heif' }), 'heif')
})

test('buildJobPhotoDriveFileName creates a deterministic UTC file name', () => {
  assert.equal(
    buildJobPhotoDriveFileName({
      capturedAt: '2026-04-28T15:04:05.000Z',
      category: 'damage',
      clientLocalId: 'abc-12345-xyz',
      originalName: 'Photo One.JPG',
      mimeType: 'image/jpeg',
    }),
    '2026-04-28_15-04-05_damage_abc-12345.jpg'
  )
})

test('buildDriveFolderUrl returns a Drive folder URL only when a folder id exists', () => {
  assert.equal(buildDriveFolderUrl('folder-123'), 'https://drive.google.com/drive/folders/folder-123')
  assert.equal(buildDriveFolderUrl(null), null)
})

test('listJobSitePhotos verifies org-scoped job and groups rows by category', async () => {
  const { db, calls } = createDbMock({
    jobs: [{ data: { id: 'job-1', title: 'Interior repaint', customer_id: 'customer-1', customer: { address: '123 Main St' } }, error: null }],
    job_site_photos: [{
      data: [
        { id: 'photo-before', job_id: 'job-1', category: 'before', job_drive_folder_id: 'job-folder', drive_file_id: 'file-before', drive_folder_id: 'before-folder', url: 'https://drive/photo-before', caption: null, captured_at: '2026-04-28T15:00:00.000Z', uploaded_at: '2026-04-28T15:01:00.000Z', client_local_id: 'before-1', created_at: '2026-04-28T15:02:00.000Z' },
        { id: 'photo-damage', job_id: 'job-1', category: 'damage', job_drive_folder_id: 'job-folder', drive_file_id: 'file-damage', drive_folder_id: 'damage-folder', url: 'https://drive/photo-damage', caption: null, captured_at: '2026-04-28T14:00:00.000Z', uploaded_at: '2026-04-28T14:01:00.000Z', client_local_id: 'damage-1', created_at: '2026-04-28T14:02:00.000Z' },
      ],
      error: null,
    }],
  })

  const result = await listJobSitePhotos('org-1', 'job-1', { db })

  assert.equal(result.ok, true)
  assert.equal(result.data.photos.before.length, 1)
  assert.equal(result.data.photos.damage.length, 1)
  assert.equal(result.data.photos.after.length, 0)
  assert.equal(result.data.photos.before[0]?.created_at, '2026-04-28T15:02:00.000Z')
  assert.equal(result.data.jobFolder.webViewLink, 'https://drive.google.com/drive/folders/job-folder')
  assert.equal(result.data.categoryFolders.before.webViewLink, 'https://drive.google.com/drive/folders/before-folder')
  assert.equal(result.data.categoryFolders.damage.webViewLink, 'https://drive.google.com/drive/folders/damage-folder')
  assert.equal(result.data.categoryFolders.after.webViewLink, null)
  assert.ok(calls.some((call) => call.table === 'jobs' && call.method === 'select' && call.value === 'id, title, customer_id, customer:customers(address)'))
  assert.equal(calls.some((call) => call.table === 'jobs' && call.method === 'select' && String(call.value).includes('customer_address')), false)
  assert.ok(calls.some((call) => call.table === 'jobs' && call.method === 'eq' && call.column === 'org_id' && call.value === 'org-1'))
  assert.ok(calls.some((call) => call.table === 'jobs' && call.method === 'eq' && call.column === 'id' && call.value === 'job-1'))
  assert.ok(calls.some((call) => call.table === 'job_site_photos' && call.method === 'eq' && call.column === 'org_id' && call.value === 'org-1'))
  assert.ok(calls.some((call) => call.table === 'job_site_photos' && call.method === 'eq' && call.column === 'job_id' && call.value === 'job-1'))
})

test('listJobSitePhotos returns not_found when job is missing', async () => {
  const { db } = createDbMock({ jobs: [{ data: null, error: null }] })
  const result = await listJobSitePhotos('org-1', 'job-missing', { db })
  assert.deepEqual(result, { ok: false, kind: 'not_found', message: 'Job not found' })
})

test('uploadJobSitePhotos rejects invalid category, empty files, too many files, unsupported MIME, and oversize files', async () => {
  const baseInput = { orgId: 'org-1', jobId: 'job-1', userId: 'user-1', createdByUserId: 'user-1', origin: 'https://example.test', category: 'before', files: [validUploadFile] }
  const deps = { env: { GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID: 'root-folder' } }

  assert.deepEqual(await uploadJobSitePhotos({ ...baseInput, category: 'during' }, deps), { ok: false, kind: 'invalid_input', message: 'Choose a valid photo category.' })
  assert.deepEqual(await uploadJobSitePhotos({ ...baseInput, files: [] }, deps), { ok: false, kind: 'invalid_input', message: 'Add at least one photo before uploading.' })
  assert.deepEqual(
    await uploadJobSitePhotos({ ...baseInput, files: Array.from({ length: JOB_SITE_PHOTO_LIMITS.maxFiles + 1 }, (_, index) => ({ ...validUploadFile, clientLocalId: `local-${index}` })) }, deps),
    { ok: false, kind: 'invalid_input', message: 'Upload at most 20 photos at a time.' }
  )
  assert.deepEqual(await uploadJobSitePhotos({ ...baseInput, files: [{ ...validUploadFile, originalName: 'empty.jpg', sizeBytes: 0 }] }, deps), { ok: false, kind: 'invalid_input', message: 'empty.jpg is empty.' })
  assert.deepEqual(await uploadJobSitePhotos({ ...baseInput, files: [{ ...validUploadFile, originalName: 'photo.gif', mimeType: 'image/gif' }] }, deps), { ok: false, kind: 'invalid_input', message: 'photo.gif is not a supported image type.' })
  assert.deepEqual(await uploadJobSitePhotos({ ...baseInput, files: [{ ...validUploadFile, originalName: 'huge.jpg', sizeBytes: JOB_SITE_PHOTO_LIMITS.maxBytesPerFile + 1 }] }, deps), { ok: false, kind: 'invalid_input', message: 'huge.jpg is larger than the 15 MB limit.' })
})

test('uploadJobSitePhotos ensures job folder, ensures category folder, uploads images, inserts rows, and returns partial failures', async () => {
  const fallbackUrl = 'https://drive.google.com/file/d/drive-file-1/view'
  const insertedRow = { id: 'photo-1', job_id: 'job-1', category: 'before', job_drive_folder_id: 'job-folder', drive_file_id: 'drive-file-1', drive_folder_id: 'before-folder', url: fallbackUrl, caption: null, captured_at: '2026-04-28T15:04:05.000Z', uploaded_at: '2026-04-28T15:04:06.000Z', client_local_id: 'local-1', created_at: '2026-04-28T15:04:07.000Z' }
  const { db, calls } = createDbMock({
    jobs: [{ data: { id: 'job-1', title: 'Interior repaint', customer: { address: '123 Main St' } }, error: null }],
    job_site_photos: [{ data: null, error: null }, { data: insertedRow, error: null }, { data: null, error: null }],
  })
  const ensureCalls: unknown[] = []
  const uploadCalls: unknown[] = []
  const deps = {
    db,
    env: { GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID: 'root-folder' },
    randomUUID: () => 'generated-id',
    now: () => new Date('2026-04-28T15:04:06.000Z'),
    ensureDriveFolder: async (params: unknown) => {
      ensureCalls.push(params)
      const parentFolderId = (params as { parentFolderId: string }).parentFolderId
      return { folder: parentFolderId === 'root-folder' ? { id: 'job-folder', name: '123 Main St', webViewLink: 'https://drive/job-folder' } : { id: 'before-folder', name: 'Before', webViewLink: 'https://drive/before-folder' } }
    },
    uploadDriveFile: async (params: unknown) => {
      uploadCalls.push(params)
      const name = (params as { name: string }).name
      if (name.includes('local-2')) return { error: 'Drive upload failed' }
      return { file: { id: 'drive-file-1', name, webViewLink: null } }
    },
  }

  const result = await uploadJobSitePhotos(
    { orgId: 'org-1', jobId: 'job-1', userId: 'user-1', createdByUserId: 'user-1', origin: 'https://example.test', category: 'before', files: [validUploadFile, { ...validUploadFile, originalName: 'failed.jpg', clientLocalId: 'local-2' }] },
    deps
  )

  assert.equal(result.ok, true)
  assert.equal(result.data.photos.length, 1)
  assert.equal(result.data.failed.length, 1)
  assert.equal(result.data.failed[0]?.message, 'Drive upload failed')
  assert.equal(result.data.photos[0]?.job_drive_folder_id, 'job-folder')
  assert.equal(result.data.photos[0]?.drive_folder_id, 'before-folder')
  assert.equal(result.data.photos[0]?.url, fallbackUrl)
  assert.equal(result.data.photos[0]?.created_at, '2026-04-28T15:04:07.000Z')
  assert.equal((ensureCalls[0] as { parentFolderId: string }).parentFolderId, 'root-folder')
  assert.equal((ensureCalls[1] as { parentFolderId: string }).parentFolderId, 'job-folder')
  assert.equal((ensureCalls[1] as { name: string }).name, 'Before')
  assert.equal(uploadCalls.length, 2)
  assert.equal((uploadCalls[0] as { folderId: string }).folderId, 'before-folder')
  const insertCall = calls.find((call) => call.table === 'job_site_photos' && call.method === 'insert')
  assert.ok(insertCall)
  assert.equal((insertCall.value as { url: string }).url, fallbackUrl)
})

test('uploadJobSitePhotos recovers existing row when insert hits client_local_id unique conflict', async () => {
  const existingRow = { id: 'photo-race', job_id: 'job-1', category: 'before', job_drive_folder_id: 'job-folder', drive_file_id: 'drive-existing', drive_folder_id: 'before-folder', url: 'https://drive/photo-race', caption: null, captured_at: '2026-04-28T15:04:05.000Z', uploaded_at: '2026-04-28T15:04:06.000Z', client_local_id: 'local-1', created_at: '2026-04-28T15:04:07.000Z' }
  const { db, calls } = createDbMock({
    jobs: [{ data: { id: 'job-1', title: 'Interior repaint', customer_id: 'customer-1', customer: { address: '123 Main St' } }, error: null }],
    job_site_photos: [
      { data: null, error: null },
      { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "job_site_photos_org_id_job_id_client_local_id_key"' } },
      { data: existingRow, error: null },
    ],
  })
  const uploadCalls: unknown[] = []

  const result = await uploadJobSitePhotos(
    { orgId: 'org-1', jobId: 'job-1', userId: 'user-1', createdByUserId: 'user-1', origin: 'https://example.test', category: 'before', files: [validUploadFile] },
    {
      db,
      env: { GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID: 'root-folder' },
      now: () => new Date('2026-04-28T15:04:06.000Z'),
      ensureDriveFolder: async (params: unknown) => {
        const parentFolderId = (params as { parentFolderId: string }).parentFolderId
        return { folder: parentFolderId === 'root-folder' ? { id: 'job-folder', name: '123 Main St', webViewLink: null } : { id: 'before-folder', name: 'Before', webViewLink: null } }
      },
      uploadDriveFile: async (params: unknown) => {
        uploadCalls.push(params)
        return { file: { id: 'drive-new-race', name: (params as { name: string }).name, webViewLink: 'https://drive/new-race' } }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.equal(result.data.failed.length, 0)
  assert.equal(result.data.photos.length, 1)
  assert.equal(result.data.photos[0]?.id, 'photo-race')
  assert.equal(result.data.photos[0]?.drive_file_id, 'drive-existing')
  assert.equal(result.data.photos[0]?.created_at, '2026-04-28T15:04:07.000Z')
  assert.equal(uploadCalls.length, 1)
  assert.equal(calls.filter((call) => call.table === 'job_site_photos' && call.method === 'maybeSingle').length, 2)
})

test('uploadJobSitePhotos generates a client local id only when one is missing', async () => {
  const insertedRow = { id: 'photo-generated', job_id: 'job-1', category: 'after', job_drive_folder_id: 'job-folder', drive_file_id: 'drive-generated', drive_folder_id: 'after-folder', url: 'https://drive/generated', caption: null, captured_at: '2026-04-28T15:04:05.000Z', uploaded_at: '2026-04-28T15:04:06.000Z', client_local_id: 'generated-local-id', created_at: '2026-04-28T15:04:07.000Z' }
  const { db, calls } = createDbMock({
    jobs: [{ data: { id: 'job-1', title: 'Interior repaint', customer_id: 'customer-1', customer: { address: '123 Main St' } }, error: null }],
    job_site_photos: [{ data: null, error: null }, { data: insertedRow, error: null }],
  })

  const result = await uploadJobSitePhotos(
    { orgId: 'org-1', jobId: 'job-1', userId: 'user-1', createdByUserId: 'user-1', origin: 'https://example.test', category: 'after', files: [{ ...validUploadFile, clientLocalId: null }] },
    {
      db,
      env: { GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID: 'root-folder' },
      randomUUID: () => 'generated-local-id',
      now: () => new Date('2026-04-28T15:04:06.000Z'),
      ensureDriveFolder: async (params: unknown) => {
        const parentFolderId = (params as { parentFolderId: string }).parentFolderId
        return { folder: parentFolderId === 'root-folder' ? { id: 'job-folder', name: '123 Main St', webViewLink: null } : { id: 'after-folder', name: 'After', webViewLink: null } }
      },
      uploadDriveFile: async (params: unknown) => ({ file: { id: 'drive-generated', name: (params as { name: string }).name, webViewLink: 'https://drive/generated' } }),
    }
  )

  assert.equal(result.ok, true)
  assert.equal(result.data.photos[0]?.client_local_id, 'generated-local-id')
  assert.ok(calls.some((call) => call.table === 'job_site_photos' && call.method === 'eq' && call.column === 'client_local_id' && call.value === 'generated-local-id'))
  const insertCall = calls.find((call) => call.table === 'job_site_photos' && call.method === 'insert')
  assert.ok(insertCall)
  assert.equal((insertCall.value as { client_local_id: string }).client_local_id, 'generated-local-id')
})

test('uploadJobSitePhotos does not reuse a duplicate photo folder from another requested category', async () => {
  const duplicateRow = { id: 'photo-before', job_id: 'job-1', category: 'before', job_drive_folder_id: 'job-folder', drive_file_id: 'drive-before', drive_folder_id: 'before-folder', url: 'https://drive/photo-before', caption: null, captured_at: '2026-04-28T15:04:05.000Z', uploaded_at: '2026-04-28T15:04:06.000Z', client_local_id: 'local-1' }
  const insertedRow = { id: 'photo-damage', job_id: 'job-1', category: 'damage', job_drive_folder_id: 'job-folder', drive_file_id: 'drive-damage', drive_folder_id: 'damage-folder', url: 'https://drive/photo-damage', caption: null, captured_at: '2026-04-28T15:04:05.000Z', uploaded_at: '2026-04-28T15:04:06.000Z', client_local_id: 'local-2' }
  const { db } = createDbMock({
    jobs: [{ data: { id: 'job-1', title: 'Interior repaint', customer_id: 'customer-1', customer: { address: '123 Main St' } }, error: null }],
    job_site_photos: [{ data: duplicateRow, error: null }, { data: null, error: null }, { data: insertedRow, error: null }],
  })
  const ensureCalls: unknown[] = []
  const uploadCalls: unknown[] = []

  const result = await uploadJobSitePhotos(
    { orgId: 'org-1', jobId: 'job-1', userId: 'user-1', createdByUserId: 'user-1', origin: 'https://example.test', category: 'damage', files: [validUploadFile, { ...validUploadFile, originalName: 'new-damage.jpg', clientLocalId: 'local-2' }] },
    {
      db,
      env: { GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID: 'root-folder' },
      now: () => new Date('2026-04-28T15:04:06.000Z'),
      ensureDriveFolder: async (params: unknown) => {
        ensureCalls.push(params)
        return { folder: { id: 'damage-folder', name: 'Damage', webViewLink: 'https://drive/damage-folder' } }
      },
      uploadDriveFile: async (params: unknown) => {
        uploadCalls.push(params)
        return { file: { id: 'drive-damage', name: (params as { name: string }).name, webViewLink: 'https://drive/photo-damage' } }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.equal(result.data.photos.length, 2)
  assert.equal(result.data.categoryFolder.webViewLink, 'https://drive.google.com/drive/folders/damage-folder')
  assert.equal(ensureCalls.length, 1)
  assert.equal((ensureCalls[0] as { parentFolderId: string }).parentFolderId, 'job-folder')
  assert.equal((ensureCalls[0] as { name: string }).name, 'Damage')
  assert.equal((uploadCalls[0] as { folderId: string }).folderId, 'damage-folder')
})

test('uploadJobSitePhotos does not reuse same-category legacy duplicate folder without a job folder id', async () => {
  const legacyDuplicateRow = { id: 'photo-legacy', job_id: 'job-1', category: 'damage', job_drive_folder_id: null, drive_file_id: 'drive-legacy', drive_folder_id: 'legacy-damage-folder', url: 'https://drive/photo-legacy', caption: null, captured_at: '2026-04-28T15:04:05.000Z', uploaded_at: '2026-04-28T15:04:06.000Z', client_local_id: 'local-1', created_at: '2026-04-28T15:04:07.000Z' }
  const insertedRow = { id: 'photo-new', job_id: 'job-1', category: 'damage', job_drive_folder_id: 'new-job-folder', drive_file_id: 'drive-new', drive_folder_id: 'new-damage-folder', url: 'https://drive/photo-new', caption: null, captured_at: '2026-04-28T15:04:05.000Z', uploaded_at: '2026-04-28T15:04:06.000Z', client_local_id: 'local-2', created_at: '2026-04-28T15:04:08.000Z' }
  const { db } = createDbMock({
    jobs: [{ data: { id: 'job-1', title: 'Interior repaint', customer_id: 'customer-1', customer: { address: '123 Main St' } }, error: null }],
    job_site_photos: [{ data: legacyDuplicateRow, error: null }, { data: null, error: null }, { data: insertedRow, error: null }],
  })
  const ensureCalls: unknown[] = []
  const uploadCalls: unknown[] = []

  const result = await uploadJobSitePhotos(
    { orgId: 'org-1', jobId: 'job-1', userId: 'user-1', createdByUserId: 'user-1', origin: 'https://example.test', category: 'damage', files: [validUploadFile, { ...validUploadFile, originalName: 'new-damage.jpg', clientLocalId: 'local-2' }] },
    {
      db,
      env: { GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID: 'root-folder' },
      now: () => new Date('2026-04-28T15:04:06.000Z'),
      ensureDriveFolder: async (params: unknown) => {
        ensureCalls.push(params)
        const parentFolderId = (params as { parentFolderId: string }).parentFolderId
        return { folder: parentFolderId === 'root-folder' ? { id: 'new-job-folder', name: '123 Main St', webViewLink: null } : { id: 'new-damage-folder', name: 'Damage', webViewLink: null } }
      },
      uploadDriveFile: async (params: unknown) => {
        uploadCalls.push(params)
        return { file: { id: 'drive-new', name: (params as { name: string }).name, webViewLink: 'https://drive/photo-new' } }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.equal(result.data.photos.length, 2)
  assert.equal(result.data.jobFolder.webViewLink, 'https://drive.google.com/drive/folders/new-job-folder')
  assert.equal(result.data.categoryFolder.webViewLink, 'https://drive.google.com/drive/folders/new-damage-folder')
  assert.equal(ensureCalls.length, 2)
  assert.equal((ensureCalls[0] as { parentFolderId: string }).parentFolderId, 'root-folder')
  assert.equal((ensureCalls[1] as { parentFolderId: string }).parentFolderId, 'new-job-folder')
  assert.equal((uploadCalls[0] as { folderId: string }).folderId, 'new-damage-folder')
})

test('uploadJobSitePhotos treats duplicate client_local_id as already uploaded', async () => {
  const existingRow = { id: 'photo-existing', job_id: 'job-1', category: 'damage', job_drive_folder_id: 'job-folder', drive_file_id: 'drive-existing', drive_folder_id: 'damage-folder', url: 'https://drive/photo-existing', caption: null, captured_at: '2026-04-28T15:04:05.000Z', uploaded_at: '2026-04-28T15:04:06.000Z', client_local_id: 'local-1' }
  const { db, calls } = createDbMock({
    jobs: [{ data: { id: 'job-1', title: 'Interior repaint', customer: { address: '123 Main St' } }, error: null }],
    job_site_photos: [{ data: existingRow, error: null }],
  })
  const ensureCalls: unknown[] = []
  const uploadCalls: unknown[] = []

  const result = await uploadJobSitePhotos(
    { orgId: 'org-1', jobId: 'job-1', userId: 'user-1', createdByUserId: 'user-1', origin: 'https://example.test', category: 'damage', files: [validUploadFile] },
    {
      db,
      env: { GOOGLE_DRIVE_JOB_PHOTOS_FOLDER_ID: 'root-folder' },
      ensureDriveFolder: async (params: unknown) => {
        ensureCalls.push(params)
        return { folder: { id: 'unused', name: 'Unused', webViewLink: null } }
      },
      uploadDriveFile: async (params: unknown) => {
        uploadCalls.push(params)
        return { file: { id: 'unused', name: 'Unused', webViewLink: null } }
      },
    }
  )

  assert.equal(result.ok, true)
  assert.equal(result.data.photos.length, 1)
  assert.equal(result.data.photos[0]?.id, 'photo-existing')
  assert.equal(result.data.photos[0]?.drive_file_id, 'drive-existing')
  assert.equal(result.data.jobFolder.webViewLink, 'https://drive.google.com/drive/folders/job-folder')
  assert.equal(result.data.categoryFolder.webViewLink, 'https://drive.google.com/drive/folders/damage-folder')
  assert.equal(ensureCalls.length, 0)
  assert.equal(uploadCalls.length, 0)
  assert.equal(calls.some((call) => call.table === 'job_site_photos' && call.method === 'insert'), false)
})
