'use client'

import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { useRef } from 'react'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { useJobPhotosUploadPage } from '@/app/crm/job-photos/_hooks/useJobPhotosUploadPage'
import type { JobSitePhotoCategory } from '@/lib/jobs/client'

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

function getJobMeta(job: { customer_name: string | null; customer_address: string | null }) {
  return [job.customer_name, job.customer_address].filter(Boolean).join(' - ') || 'No customer details'
}

export default function JobPhotosPage() {
  const controller = useJobPhotosUploadPage()
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const uploadLabel =
    controller.queue.length === 1 ? 'Upload 1 photo' : `Upload ${controller.queue.length} photos`

  function handleFiles(input: HTMLInputElement) {
    controller.addFiles(input.files ?? [])
    input.value = ''
  }

  return (
    <CrmPageShell className="max-w-6xl pb-16">
      <CrmPageHeader
        eyebrow="Field photo workflow"
        title="Job Photos"
        description="Take or upload job photos, organize them by job and category, and send them to the matching Google Drive folders."
      />

      <CrmSearchBar
        value={controller.jobQuery}
        onChange={controller.setJobQuery}
        placeholder="Search jobs by title, customer, or address..."
        actions={<CrmChip tone="default">{controller.filteredJobs.length} jobs</CrmChip>}
      />

      {controller.jobsError ? <CrmNotice tone="error">{controller.jobsError}</CrmNotice> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <CrmSectionCard
            title="Choose a job"
            description="Select the job that should receive these site photos."
            actions={controller.selectedJob ? <CrmChip tone="accent">Selected</CrmChip> : null}
          >
            {controller.jobsLoading ? (
              <p className="text-sm text-[color:var(--crm-ui-muted)]">Loading jobs...</p>
            ) : null}

            {!controller.jobsLoading && controller.filteredJobs.length === 0 ? (
              <CrmEmptyState
                compact
                title="No matching jobs"
                description="Try a broader job, customer, or address search."
              />
            ) : null}

            <div className="grid gap-3">
              {controller.filteredJobs.map((job) => {
                const selected = controller.selectedJobId === job.id

                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => controller.setSelectedJobId(job.id)}
                    aria-pressed={selected}
                    className={`ace-crm-surface-muted w-full border p-4 text-left transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[color:var(--crm-ui-accent-border)] ${
                      selected
                        ? 'border-[color:var(--crm-ui-accent-border)] bg-[color:var(--crm-ui-accent-soft)] shadow-[0_18px_42px_rgba(17,24,39,0.10)]'
                        : 'border-[color:var(--crm-ui-border)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-black text-[color:var(--crm-ui-text)]">{job.title}</div>
                        <p className="mt-1 text-sm leading-6 text-[color:var(--crm-ui-muted)]">{getJobMeta(job)}</p>
                      </div>
                      <CrmChip tone={selected ? 'accent' : 'default'}>{selected ? 'Selected' : job.status}</CrmChip>
                    </div>
                  </button>
                )
              })}
            </div>
          </CrmSectionCard>

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
                  ref={cameraInputRef}
                  type="file"
                  aria-label="Take Photos"
                  accept={PHOTO_ACCEPT}
                  capture="environment"
                  multiple
                  className="sr-only"
                  onChange={(event) => handleFiles(event.currentTarget)}
                />
                <CrmButton type="button" tone="primary" onClick={() => cameraInputRef.current?.click()}>
                  <Camera size={16} aria-hidden="true" />
                  <span>Take Photos</span>
                </CrmButton>

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
        </div>

        <CrmSectionCard
          title="Upload photos"
          description="Send the queued photos to the selected job's Google Drive folders."
          className="h-fit lg:sticky lg:top-4"
          actions={<CrmChip tone={controller.queue.length > 0 ? 'accent' : 'default'}>{controller.queue.length} queued</CrmChip>}
        >
          <section aria-label="Upload photos" className="grid gap-4">
            <div className="ace-crm-surface-muted p-4">
              <div className="ace-crm-mono text-[11px] font-bold text-[color:var(--crm-ui-muted)]">SELECTED JOB</div>
              <div className="mt-2 text-sm font-black text-[color:var(--crm-ui-text)]">
                {controller.selectedJob?.title ?? 'No job selected'}
              </div>
              {controller.selectedJob ? (
                <p className="mt-1 text-sm leading-6 text-[color:var(--crm-ui-muted)]">
                  {getJobMeta(controller.selectedJob)}
                </p>
              ) : (
                <p className="mt-1 text-sm leading-6 text-[color:var(--crm-ui-muted)]">
                  Choose a job before uploading photos.
                </p>
              )}
            </div>

            {controller.error ? <CrmNotice tone="error" compact>{controller.error}</CrmNotice> : null}
            {controller.notice ? <CrmNotice tone="success" compact>{controller.notice}</CrmNotice> : null}

            <div className="flex flex-col gap-2">
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
          </section>
        </CrmSectionCard>
      </div>
    </CrmPageShell>
  )
}
