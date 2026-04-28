'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchJobList,
  getJobPhotosFolderUrl,
  uploadJobSitePhotos,
  type JobSitePhotoCategory,
  type JobSummary,
  type UploadJobSitePhotoFailure,
} from '@/lib/jobs/client'

const DEFAULT_CATEGORY: JobSitePhotoCategory = 'before'
const MAX_FILES = 20
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export type QueuedJobPhoto = {
  id: string
  file: File
  previewUrl: string
  capturedAt: string
  error?: string
}

function createQueueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getCapturedAt(file: File) {
  const timestamp = file.lastModified > 0 ? file.lastModified : Date.now()
  return new Date(timestamp).toISOString()
}

function getFileValidationError(file: File) {
  if (file.size === 0) return 'File is empty.'
  if (file.size > MAX_FILE_SIZE_BYTES) return 'File must be 15 MB or smaller.'
  if (!ACCEPTED_MIME_TYPES.has(file.type)) return 'File must be a JPEG, PNG, WebP, HEIC, or HEIF image.'
  return null
}

function getJobSearchText(job: JobSummary) {
  return [job.title, job.customer_name, job.customer_address].filter(Boolean).join(' ').toLowerCase()
}

function revokeQueuedPhoto(photo: QueuedJobPhoto) {
  URL.revokeObjectURL(photo.previewUrl)
}

export function useJobPhotosUploadPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [jobQuery, setJobQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [category, setCategory] = useState<JobSitePhotoCategory>(DEFAULT_CATEGORY)
  const [queue, setQueue] = useState<QueuedJobPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [folderUrl, setFolderUrl] = useState<string | null>(null)
  const queueRef = useRef<QueuedJobPhoto[]>([])
  const uploadInFlightRef = useRef(false)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    let active = true

    async function loadJobs() {
      setJobsLoading(true)
      setJobsError(null)

      try {
        const result = await fetchJobList()
        if (!active) return
        setJobs(result)
      } catch (loadError) {
        if (!active) return
        setJobsError(loadError instanceof Error ? loadError.message : 'Unable to load jobs.')
      } finally {
        if (active) setJobsLoading(false)
      }
    }

    void loadJobs()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      queueRef.current.forEach(revokeQueuedPhoto)
    }
  }, [])

  const filteredJobs = useMemo(() => {
    const query = jobQuery.trim().toLowerCase()
    if (!query) return jobs
    return jobs.filter((job) => getJobSearchText(job).includes(query))
  }, [jobQuery, jobs])

  const selectedJob = useMemo(() => {
    return jobs.find((job) => job.id === selectedJobId) ?? null
  }, [jobs, selectedJobId])

  const addFiles = useCallback((files: FileList | File[]) => {
    if (uploadInFlightRef.current) {
      setError('Wait for the current upload to finish before adding more photos.')
      return
    }

    const incomingFiles = Array.from(files)
    if (incomingFiles.length === 0) return

    const availableSlots = Math.max(MAX_FILES - queueRef.current.length, 0)
    const rejectedMessages: string[] = []
    const nextPhotos: QueuedJobPhoto[] = []

    for (const file of incomingFiles) {
      const validationError = getFileValidationError(file)
      if (validationError) {
        rejectedMessages.push(`${file.name}: ${validationError}`)
        continue
      }

      if (nextPhotos.length >= availableSlots) {
        rejectedMessages.push(`Only ${MAX_FILES} photos can be queued at once.`)
        break
      }

      nextPhotos.push({
        id: createQueueId(),
        file,
        previewUrl: URL.createObjectURL(file),
        capturedAt: getCapturedAt(file),
      })
    }

    setError(rejectedMessages.length > 0 ? rejectedMessages.join(' ') : null)
    setNotice(null)

    if (nextPhotos.length === 0) return

    const nextQueue = [...queueRef.current, ...nextPhotos]
    queueRef.current = nextQueue
    setQueue(nextQueue)
  }, [])

  const removeQueuedPhoto = useCallback((id: string) => {
    if (uploadInFlightRef.current) {
      setError('Wait for the current upload to finish before removing photos.')
      return
    }

    const removedPhoto = queueRef.current.find((photo) => photo.id === id)
    if (removedPhoto) revokeQueuedPhoto(removedPhoto)

    const nextQueue = queueRef.current.filter((photo) => photo.id !== id)
    queueRef.current = nextQueue
    setQueue(nextQueue)
  }, [])

  const upload = useCallback(async () => {
    if (uploadInFlightRef.current) return

    uploadInFlightRef.current = true
    setError(null)
    setNotice(null)

    if (!selectedJobId) {
      setError('Choose a job before uploading photos.')
      uploadInFlightRef.current = false
      return
    }

    if (!category) {
      setError('Choose a photo category before uploading photos.')
      uploadInFlightRef.current = false
      return
    }

    const queuedPhotos = queueRef.current

    if (queuedPhotos.length === 0) {
      setError('Add at least one photo before uploading.')
      uploadInFlightRef.current = false
      return
    }

    const form = new FormData()
    form.append('category', category)

    for (const photo of queuedPhotos) {
      form.append('clientLocalId', photo.id)
      form.append('capturedAt', photo.capturedAt)
      form.append('photos', photo.file)
    }

    setUploading(true)

    try {
      const response = await uploadJobSitePhotos(selectedJobId, form)
      const data = response.data

      if (!data) {
        throw new Error('Upload did not return photo results.')
      }

      const failuresById = new Map<string, UploadJobSitePhotoFailure>()
      for (const failure of data.failed) {
        failuresById.set(failure.clientLocalId, failure)
      }

      const queuedIds = new Set(queuedPhotos.map((photo) => photo.id))
      const successfulIds = new Set(
        data.photos
          .map((photo) => photo.clientLocalId)
          .filter((id): id is string => Boolean(id) && queuedIds.has(id))
      )



      const remainingPhotos: QueuedJobPhoto[] = []
      let uploadedCount = 0

      for (const photo of queuedPhotos) {
        const failure = failuresById.get(photo.id)

        if (failure) {
          remainingPhotos.push({ ...photo, error: failure.message })
          continue
        }

        if (successfulIds.has(photo.id)) {
          uploadedCount += 1
          revokeQueuedPhoto(photo)
          continue
        }

        remainingPhotos.push({ ...photo, error: 'Upload status was not confirmed. Try again.' })
      }

      queueRef.current = remainingPhotos
      setQueue(remainingPhotos)
      setFolderUrl(
        data.jobFolder.webViewLink ??
          (data.jobFolder.id ? getJobPhotosFolderUrl(data.jobFolder.id) : null)
      )

      if (failuresById.size > 0) {
        setError(`${failuresById.size} photo${failuresById.size === 1 ? '' : 's'} failed to upload.`)
      }

      if (uploadedCount > 0) {
        setNotice(
          response.notice ??
            `${uploadedCount} photo${uploadedCount === 1 ? '' : 's'} uploaded successfully.`
        )
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload photos.')
    } finally {
      uploadInFlightRef.current = false
      setUploading(false)
    }
  }, [category, selectedJobId])

  return {
    jobs,
    jobsLoading,
    jobsError,
    jobQuery,
    selectedJobId,
    category,
    queue,
    uploading,
    error,
    notice,
    folderUrl,
    filteredJobs,
    selectedJob,
    setJobQuery,
    setSelectedJobId,
    setCategory,
    addFiles,
    removeQueuedPhoto,
    upload,
  }
}



