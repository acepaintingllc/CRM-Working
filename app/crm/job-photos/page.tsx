'use client'

import { Camera, ImagePlus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useJobPhotosUploadPage } from '@/app/crm/job-photos/_hooks/useJobPhotosUploadPage'
import type { JobSitePhotoCategory, JobSummary } from '@/lib/jobs/client'

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

const categories: Array<{ value: JobSitePhotoCategory; label: string }> = [
  { value: 'before', label: 'Before' },
  { value: 'damage', label: 'Damage' },
  { value: 'after', label: 'After' },
]

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No date set'
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function getJobMeta(job: { customer_name: string | null; customer_address: string | null }) {
  return [job.customer_name, job.customer_address].filter(Boolean).join(' - ') || 'No customer details'
}

function getJobDateLabel(job: JobSummary) {
  if (job.status === 'estimate_scheduled') return `Quote: ${formatDate(job.estimate_date)}`
  return `Job: ${formatDate(job.scheduled_date)}`
}

function JobCard({
  job,
  onSelect,
}: {
  job: JobSummary
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(job.id)}
      className="ace-crm-surface-muted w-full border border-[color:var(--crm-ui-border)] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--crm-ui-accent-border)] hover:bg-[color:var(--crm-ui-accent-soft)] focus:outline-none focus:ring-2 focus:ring-[color:var(--crm-ui-accent-border)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-black text-[color:var(--crm-ui-text)]">{job.title}</div>
          <p className="mt-1 text-sm leading-6 text-[color:var(--crm-ui-muted)]">{getJobMeta(job)}</p>
        </div>
        <CrmChip tone={job.status === 'scheduled' ? 'accent' : 'default'}>
          {job.status === 'scheduled' ? 'Job scheduled' : 'Quote scheduled'}
        </CrmChip>
      </div>
      <div className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[color:var(--crm-ui-muted)]">
        {getJobDateLabel(job)}
      </div>
    </button>
  )
}

type PendingCameraPhoto = {
  id: string
  file: File
  previewUrl: string
}

function createCameraPhotoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function CameraCapturePanel({
  onAccept,
}: {
  onAccept: (files: File[]) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pendingPhotosRef = useRef<PendingCameraPhoto[]>([])
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingPhotos, setPendingPhotos] = useState<PendingCameraPhoto[]>([])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const closeCamera = useCallback(() => {
    stopCamera()
    setOpen(false)
    setStarting(false)
    setError(null)
  }, [stopCamera])

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos
  }, [pendingPhotos])

  useEffect(() => {
    return () => {
      stopCamera()
      pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
    }
  }, [stopCamera])

  const openCamera = async () => {
    setOpen(true)
    setStarting(true)
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setError('Camera access was blocked or unavailable. Use Upload Photos instead.')
    } finally {
      setStarting(false)
    }
  }

  const capturePhoto = async () => {
    const video = videoRef.current
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setError('Camera is not ready yet.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setError('Unable to capture photo from camera.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) {
      setError('Unable to save captured photo.')
      return
    }

    const timestamp = new Date()
    const file = new File([blob], `job-photo-${timestamp.toISOString().replace(/[:.]/g, '-')}.jpg`, {
      type: 'image/jpeg',
      lastModified: timestamp.getTime(),
    })
    const previewUrl = URL.createObjectURL(file)
    setPendingPhotos((current) => [...current, { id: createCameraPhotoId(), file, previewUrl }])
    setError(null)
  }

  const removePendingPhoto = (id: string) => {
    setPendingPhotos((current) => {
      const removed = current.find((photo) => photo.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return current.filter((photo) => photo.id !== id)
    })
  }

  const acceptAll = () => {
    if (pendingPhotos.length === 0) return
    onAccept(pendingPhotos.map((photo) => photo.file))
    pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
    setPendingPhotos([])
    closeCamera()
  }

  if (!open) {
    return (
      <CrmButton type="button" tone="primary" onClick={() => void openCamera()}>
        <Camera size={16} aria-hidden="true" />
        <span>Open Camera</span>
      </CrmButton>
    )
  }

  return (
    <div className="grid gap-3 rounded-[22px] border border-[color:var(--crm-ui-border)] bg-black/20 p-3">
      <div className="overflow-hidden rounded-[18px] bg-black">
        <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
      </div>

      {error ? <CrmNotice tone="error" compact>{error}</CrmNotice> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <CrmButton type="button" tone="primary" disabled={starting} onClick={() => void capturePhoto()}>
            {starting ? 'Opening...' : 'Capture'}
          </CrmButton>
          <CrmButton type="button" disabled={pendingPhotos.length === 0} onClick={acceptAll}>
            Accept All ({pendingPhotos.length})
          </CrmButton>
        </div>
        <CrmButton type="button" tone="secondary" onClick={closeCamera}>
          Close Camera
        </CrmButton>
      </div>

      {pendingPhotos.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-4">
          {pendingPhotos.map((photo, index) => (
            <article key={photo.id} className="ace-crm-surface-muted overflow-hidden border p-2">
              <img src={photo.previewUrl} alt={`Captured photo ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" />
              <CrmButton
                type="button"
                tone="danger"
                className="mt-2 min-h-8 w-full px-2 text-xs"
                onClick={() => removePendingPhoto(photo.id)}
              >
                Remove
              </CrmButton>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function JobPhotosPage() {
  const controller = useJobPhotosUploadPage()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const uploadLabel =
    controller.queue.length === 1 ? 'Upload 1 photo' : `Upload ${controller.queue.length} photos`

  const groupedJobs = useMemo(
    () => ({
      quoteScheduled: controller.filteredJobs.filter((job) => job.status === 'estimate_scheduled'),
      jobScheduled: controller.filteredJobs.filter((job) => job.status === 'scheduled'),
    }),
    [controller.filteredJobs]
  )

  function handleFiles(input: HTMLInputElement) {
    controller.addFiles(input.files ?? [])
    input.value = ''
  }

  return (
    <CrmPageShell className="max-w-6xl pb-16">
      <CrmPageHeader
        eyebrow="Field photo workflow"
        title="Job Photos"
        description="Pick an active scheduled job, then take photos or upload files into the right Drive category."
      />

      <CrmSearchBar
        value={controller.jobQuery}
        onChange={controller.setJobQuery}
        placeholder="Search scheduled jobs by title, customer, or address..."
        actions={<CrmChip tone="default">{controller.filteredJobs.length} jobs</CrmChip>}
      />

      {controller.jobsError ? <CrmNotice tone="error">{controller.jobsError}</CrmNotice> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <CrmSectionCard
          title="Quote scheduled"
          description="Jobs still in the quote scheduled stage."
          actions={<CrmChip tone="default">{groupedJobs.quoteScheduled.length}</CrmChip>}
        >
          {controller.jobsLoading ? (
            <p className="text-sm text-[color:var(--crm-ui-muted)]">Loading jobs...</p>
          ) : groupedJobs.quoteScheduled.length === 0 ? (
            <CrmEmptyState compact title="No quote scheduled jobs" description="No matching quote scheduled jobs found." />
          ) : (
            <div className="grid gap-3">
              {groupedJobs.quoteScheduled.map((job) => (
                <JobCard key={job.id} job={job} onSelect={controller.setSelectedJobId} />
              ))}
            </div>
          )}
        </CrmSectionCard>

        <CrmSectionCard
          title="Job scheduled"
          description="Jobs with scheduled work ready for field photos."
          actions={<CrmChip tone="accent">{groupedJobs.jobScheduled.length}</CrmChip>}
        >
          {controller.jobsLoading ? (
            <p className="text-sm text-[color:var(--crm-ui-muted)]">Loading jobs...</p>
          ) : groupedJobs.jobScheduled.length === 0 ? (
            <CrmEmptyState compact title="No job scheduled jobs" description="No matching job scheduled jobs found." />
          ) : (
            <div className="grid gap-3">
              {groupedJobs.jobScheduled.map((job) => (
                <JobCard key={job.id} job={job} onSelect={controller.setSelectedJobId} />
              ))}
            </div>
          )}
        </CrmSectionCard>
      </div>

      {controller.selectedJob ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Upload photos for ${controller.selectedJob.title}`}
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[28px] border border-[color:var(--crm-ui-border)] bg-[color:var(--crm-ui-surface)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">SELECTED JOB</div>
                <h2 className="mt-1 text-2xl font-black text-[color:var(--crm-ui-text)]">{controller.selectedJob.title}</h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--crm-ui-muted)]">
                  {getJobMeta(controller.selectedJob)}
                </p>
              </div>
              <CrmButton type="button" tone="secondary" aria-label="Close photo upload" onClick={controller.closeJobPicker}>
                <X size={16} aria-hidden="true" />
              </CrmButton>
            </div>

            <div className="mt-5 grid gap-4">
              <CrmSectionCard
                title="Photo category"
                description="Choose where these photos should be filed in Drive."
              >
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const selected = controller.category === category.value

                    return (
                      <CrmButton
                        key={category.value}
                        type="button"
                        tone={selected ? 'primary' : 'secondary'}
                        aria-pressed={selected}
                        onClick={() => controller.setCategory(category.value)}
                      >
                        {category.label}
                      </CrmButton>
                    )
                  })}
                </div>
              </CrmSectionCard>

              <CrmSectionCard
                title="Photo queue"
                description="Take new photos in the field or upload existing files from this device."
                actions={
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={uploadInputRef}
                      type="file"
                      aria-label="Upload Photos"
                      accept={PHOTO_ACCEPT}
                      multiple
                      className="sr-only"
                      onChange={(event) => handleFiles(event.currentTarget)}
                    />
                    <CrmButton type="button" onClick={() => uploadInputRef.current?.click()}>
                      <ImagePlus size={16} aria-hidden="true" />
                      <span>Upload Photos</span>
                    </CrmButton>
                  </div>
                }
              >
                <div className="mb-4">
                  <CameraCapturePanel onAccept={(files) => void controller.addFilesAndUpload(files)} />
                </div>

                {controller.queue.length === 0 ? (
                  <CrmEmptyState
                    title="No queued photos"
                    description="Take photos with the camera or choose image files to prepare a job photo upload."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {controller.queue.map((photo) => (
                      <article key={photo.id} className="ace-crm-surface-muted overflow-hidden border p-3">
                        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[color:var(--crm-ui-surface)]">
                          <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="mt-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-[color:var(--crm-ui-text)]">{photo.file.name}</div>
                            <div className="mt-1 text-xs font-semibold text-[color:var(--crm-ui-muted)]">
                              {formatFileSize(photo.file.size)}
                            </div>
                            {photo.error ? (
                              <div className="mt-2 text-sm font-semibold text-[color:var(--crm-ui-danger-text)]">
                                {photo.error}
                              </div>
                            ) : null}
                          </div>
                          <CrmButton
                            type="button"
                            tone="danger"
                            aria-label={`Remove ${photo.file.name}`}
                            onClick={() => controller.removeQueuedPhoto(photo.id)}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </CrmButton>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </CrmSectionCard>

              {controller.error ? <CrmNotice tone="error" compact>{controller.error}</CrmNotice> : null}
              {controller.notice ? <CrmNotice tone="success" compact>{controller.notice}</CrmNotice> : null}

              <div className="flex flex-wrap justify-end gap-2">
                {controller.folderUrl ? (
                  <CrmButton href={controller.folderUrl} tone="secondary" target="_blank" rel="noreferrer">
                    Open Photos
                  </CrmButton>
                ) : null}
                <CrmButton
                  type="button"
                  tone="primary"
                  disabled={controller.uploading || controller.queue.length === 0}
                  onClick={() => void controller.upload()}
                >
                  {controller.uploading ? 'Uploading...' : uploadLabel}
                </CrmButton>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </CrmPageShell>
  )
}
