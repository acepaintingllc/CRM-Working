'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

export type SitePhotoApiRow = {
  id: string
  client_local_id: string
  drive_file_id: string
  url: string
  caption: string | null
  captured_at: string | null
  uploaded_at: string | null
  created_at: string | null
}

export type LocalSitePhotoStatus = 'queued' | 'uploading' | 'uploaded' | 'failed'

export type LocalSitePhotoRecord = {
  localId: string
  jobId: string
  jobTitle: string
  caption: string
  capturedAt: string
  createdAt: string
  status: LocalSitePhotoStatus
  mimeType: string
  blob: Blob | null
  remoteId: string | null
  remoteUrl: string | null
  uploadedAt: string | null
  error: string | null
}

const dbName = 'ace-field-camera-v1'
const storeName = 'captures'
const changeEventName = 'ace-field-local-photos-changed'
const allJobsSyncScope = '__all_jobs__'

let syncInFlight: Promise<{ synced: number; failed: number }> | null = null
let rerunRequested = false
let rerunScope: string = allJobsSyncScope

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function emitChange() {
  if (!isBrowser()) return
  window.dispatchEvent(new CustomEvent(changeEventName))
}

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error('IndexedDB unavailable'))
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: 'localId' })
        store.createIndex('by_job', 'jobId', { unique: false })
        store.createIndex('by_status', 'status', { unique: false })
        store.createIndex('by_captured_at', 'capturedAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: Error) => void) => void
) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        runner(store, resolve, reject)
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
        tx.oncomplete = () => db.close()
      })
  )
}

export function subscribeToLocalSitePhotoChanges(listener: () => void) {
  if (!isBrowser()) return () => undefined
  window.addEventListener(changeEventName, listener)
  return () => window.removeEventListener(changeEventName, listener)
}

export async function getLocalSitePhoto(localId: string) {
  return runTransaction<LocalSitePhotoRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(localId)
    request.onerror = () => reject(request.error ?? new Error('Failed to read local photo'))
    request.onsuccess = () => resolve((request.result as LocalSitePhotoRecord | null) ?? null)
  })
}

export async function putLocalSitePhoto(record: LocalSitePhotoRecord) {
  await runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record)
    request.onerror = () => reject(request.error ?? new Error('Failed to save local photo'))
    request.onsuccess = () => resolve()
  })
  emitChange()
}

export async function updateLocalSitePhoto(
  localId: string,
  patch: Partial<LocalSitePhotoRecord>
) {
  const current = await getLocalSitePhoto(localId)
  if (!current) return null
  const next = { ...current, ...patch }
  await putLocalSitePhoto(next)
  return next
}

export async function deleteLocalSitePhoto(localId: string) {
  await runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(localId)
    request.onerror = () => reject(request.error ?? new Error('Failed to delete local photo'))
    request.onsuccess = () => resolve()
  })
  emitChange()
}

export async function listLocalSitePhotosForJob(jobId: string) {
  const rows = await runTransaction<LocalSitePhotoRecord[]>('readonly', (store, resolve, reject) => {
    const index = store.index('by_job')
    const request = index.getAll(IDBKeyRange.only(jobId))
    request.onerror = () => reject(request.error ?? new Error('Failed to read job photos'))
    request.onsuccess = () => resolve((request.result as LocalSitePhotoRecord[]) ?? [])
  })
  return rows.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
}

export async function listRecentLocalSitePhotos(limit = 60) {
  const rows = await runTransaction<LocalSitePhotoRecord[]>('readonly', (store, resolve, reject) => {
    const request = store.getAll()
    request.onerror = () => reject(request.error ?? new Error('Failed to read recent photos'))
    request.onsuccess = () => resolve((request.result as LocalSitePhotoRecord[]) ?? [])
  })
  return rows
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .slice(0, limit)
}

export async function listPendingLocalSitePhotos(jobId?: string) {
  const readByStatus = (status: LocalSitePhotoStatus) =>
    runTransaction<LocalSitePhotoRecord[]>('readonly', (store, resolve, reject) => {
      const index = store.index('by_status')
      const request = index.getAll(IDBKeyRange.only(status))
      request.onerror = () => reject(request.error ?? new Error(`Failed to read ${status} photos`))
      request.onsuccess = () => resolve((request.result as LocalSitePhotoRecord[]) ?? [])
    })

  const [queued, failed, uploading] = await Promise.all([
    readByStatus('queued'),
    readByStatus('failed'),
    readByStatus('uploading'),
  ])
  const rows = [...queued, ...failed, ...uploading]

  return rows
    .filter((row) => (jobId ? row.jobId === jobId : true))
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
}

export async function clearUploadedLocalSitePhotos() {
  const rows = await runTransaction<LocalSitePhotoRecord[]>('readonly', (store, resolve, reject) => {
    const index = store.index('by_status')
    const request = index.getAll(IDBKeyRange.only('uploaded'))
    request.onerror = () => reject(request.error ?? new Error('Failed to read uploaded photos'))
    request.onsuccess = () => resolve((request.result as LocalSitePhotoRecord[]) ?? [])
  })
  await Promise.all(
    rows.map((row) =>
      runTransaction<void>('readwrite', (store, resolve, reject) => {
        const request = store.delete(row.localId)
        request.onerror = () => reject(request.error ?? new Error('Failed to clear uploaded photo'))
        request.onsuccess = () => resolve()
      })
    )
  )
  emitChange()
}

function mergeSyncScope(current: string, incomingJobId: string | undefined) {
  if (current === allJobsSyncScope || !incomingJobId) return allJobsSyncScope
  return current === incomingJobId ? current : allJobsSyncScope
}

async function syncQueuedSitePhotosPass(options?: {
  jobId?: string
  onItem?: (record: LocalSitePhotoRecord) => void
}) {
  const pending = await listPendingLocalSitePhotos(options?.jobId)
  let synced = 0
  let failed = 0

  for (const item of pending) {
    if (!item.blob) continue

    const uploading = await updateLocalSitePhoto(item.localId, {
      status: 'uploading',
      error: null,
    })
    if (uploading && options?.onItem) options.onItem(uploading)

    const form = new FormData()
    form.append('file', item.blob, `${item.localId}.jpg`)
    form.append('caption', item.caption)
    form.append('client_local_id', item.localId)
    form.append('captured_at', item.capturedAt)

    try {
      const res = await authedFetch(`/api/jobs/${item.jobId}/site-photos`, {
        method: 'POST',
        body: form,
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        failed += 1
        const errored = await updateLocalSitePhoto(item.localId, {
          status: 'failed',
          error: payload?.error ?? res.statusText,
        })
        if (errored && options?.onItem) options.onItem(errored)
        continue
      }

      const photo = (payload?.photo ?? null) as SitePhotoApiRow | null
      synced += 1
      const uploaded = await updateLocalSitePhoto(item.localId, {
        status: 'uploaded',
        error: null,
        blob: null,
        remoteId: photo?.id ?? item.remoteId,
        remoteUrl: photo?.url ?? item.remoteUrl,
        uploadedAt: photo?.uploaded_at ?? new Date().toISOString(),
        caption: photo?.caption ?? item.caption,
      })
      if (uploaded && options?.onItem) options.onItem(uploaded)
    } catch (error) {
      failed += 1
      const errored = await updateLocalSitePhoto(item.localId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Upload failed',
      })
      if (errored && options?.onItem) options.onItem(errored)
    }
  }

  return { synced, failed }
}

export async function syncQueuedSitePhotos(options?: {
  jobId?: string
  onItem?: (record: LocalSitePhotoRecord) => void
}) {
  if (!isBrowser()) return { synced: 0, failed: 0 }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, failed: 0 }

  if (syncInFlight) {
    rerunRequested = true
    rerunScope = mergeSyncScope(rerunScope, options?.jobId)
    return syncInFlight
  }

  rerunRequested = false
  rerunScope = options?.jobId ?? allJobsSyncScope

  syncInFlight = (async () => {
    let totals = { synced: 0, failed: 0 }
    let passScope = rerunScope

    while (true) {
      const passResult = await syncQueuedSitePhotosPass({
        jobId: passScope === allJobsSyncScope ? undefined : passScope,
        onItem: options?.onItem,
      })
      totals = {
        synced: totals.synced + passResult.synced,
        failed: totals.failed + passResult.failed,
      }
      if (!rerunRequested) {
        return totals
      }
      rerunRequested = false
      passScope = rerunScope
    }
  })().finally(() => {
    syncInFlight = null
    rerunRequested = false
    rerunScope = allJobsSyncScope
  })

  return syncInFlight
}

export function createLocalSitePhotoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createPreviewUrl(record: LocalSitePhotoRecord) {
  if (record.blob) return URL.createObjectURL(record.blob)
  return record.remoteUrl
}

export async function queueCapturedSitePhoto(params: {
  jobId: string
  jobTitle: string
  blob: Blob
  mimeType: string
  capturedAt?: string
}) {
  const localId = createLocalSitePhotoId()
  const record: LocalSitePhotoRecord = {
    localId,
    jobId: params.jobId,
    jobTitle: params.jobTitle,
    caption: '',
    capturedAt: params.capturedAt ?? new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status: 'queued',
    mimeType: params.mimeType,
    blob: params.blob,
    remoteId: null,
    remoteUrl: null,
    uploadedAt: null,
    error: null,
  }
  await putLocalSitePhoto(record)
  return record
}
