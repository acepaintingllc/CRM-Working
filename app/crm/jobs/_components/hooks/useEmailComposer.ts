'use client'

import {
  fetchStageEmailComposerData,
  sendStageEmail,
} from '@/lib/jobs/actions'
import {
  type EstimateDriveFile,
  type JobDetail,
} from '@/lib/jobs/client'
import { applyTemplate, buildJobEmailTemplateVars } from '@/lib/jobs/emailTemplate'
import { stageEmailActionLabel, type StageEmailStage } from '@/lib/jobs/types'
import { useEffect, useMemo, useState } from 'react'

function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatRange(start: string | null | undefined, end: string | null | undefined) {
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`
  if (start) return formatDate(start)
  if (end) return formatDate(end)
  return ''
}

function applyJobTemplate(
  value: string,
  job: JobDetail | null,
  scheduledBlocks: string,
  estimateFiles: EstimateDriveFile[],
  selectedEstimateFileIds: string[]
) {
  const selectedEstimateFiles = selectedEstimateFileIds
    .map((id) => estimateFiles.find((file) => file.id === id) ?? null)
    .filter((file): file is EstimateDriveFile => Boolean(file))
  const primaryEstimateFile = selectedEstimateFiles[0] ?? null
  const estimateFileNames = selectedEstimateFiles.map((file) => file.name).join(', ')
  const estimateFileLinks = selectedEstimateFiles
    .map((file) => file.webViewLink ?? '')
    .filter(Boolean)
    .join('\n')

  return applyTemplate(
    value,
    buildJobEmailTemplateVars({
      customerName: job?.customer_name ?? '',
      customerEmail: job?.customer_email ?? '',
      customerPhone: job?.customer_phone ?? '',
      customerAddress: job?.customer_address ?? '',
      jobTitle: job?.title ?? '',
      estimateDate: formatDate(job?.estimate_date),
      scheduledDate: formatDate(job?.scheduled_date),
      scheduledBlocks: scheduledBlocks || formatRange(job?.scheduled_date, job?.scheduled_end_date),
      estimateFileName: primaryEstimateFile?.name ?? '',
      estimateFileLink: primaryEstimateFile?.webViewLink ?? '',
      estimateFileNames,
      estimateFileLinks,
    })
  )
}

type UseEmailComposerArgs = {
  jobId: string | null
  stage: StageEmailStage | null
  open: boolean
}

export function useEmailComposer({ jobId, stage, open }: UseEmailComposerArgs) {
  const [job, setJob] = useState<JobDetail | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockingIssues, setBlockingIssues] = useState<string[]>([])
  const [estimateFiles, setEstimateFiles] = useState<EstimateDriveFile[]>([])
  const [selectedEstimateFileIds, setSelectedEstimateFileIds] = useState<string[]>([])
  const [showEstimatePicker, setShowEstimatePicker] = useState(false)

  const needsEstimateAttachment = stage === 'estimate_sent' || stage === 'follow_up'
  const selectedEstimateFiles = useMemo(() => {
    if (!estimateFiles.length || !selectedEstimateFileIds.length) return []
    const byId = new Map(estimateFiles.map((file) => [file.id, file]))
    return selectedEstimateFileIds
      .map((id) => byId.get(id) ?? null)
      .filter((file): file is EstimateDriveFile => Boolean(file))
  }, [estimateFiles, selectedEstimateFileIds])

  const alreadySent = useMemo(() => {
    if (!job || !stage) return false
    if (stage === 'scheduled') return Boolean(job.scheduled_email_sent_at)
    if (stage === 'completed') return Boolean(job.completed_email_sent_at)
    return false
  }, [job, stage])

  useEffect(() => {
    if (!open || !jobId || !stage) return

    let cancelled = false

    const loadComposer = async () => {
      setLoading(true)
      setSending(false)
      setError(null)
      setBlockingIssues([])
      setJob(null)
      setSubject('')
      setBody('')
      setEstimateFiles([])
      setSelectedEstimateFileIds([])
      setShowEstimatePicker(false)

      try {
        const composer = await fetchStageEmailComposerData(jobId, stage)

        if (!cancelled) {
          setJob(composer.job)
          setEstimateFiles(composer.estimateFiles)
          setSelectedEstimateFileIds(composer.selectedEstimateFileIds)
          setBlockingIssues(composer.blockingIssues)
          setSubject(
            composer.template
              ? applyJobTemplate(
                  composer.template.subject ?? '',
                  composer.job,
                  composer.scheduledBlocks,
                  composer.estimateFiles,
                  composer.selectedEstimateFileIds
                )
              : ''
          )
          setBody(
            composer.template
              ? applyJobTemplate(
                  composer.template.body ?? '',
                  composer.job,
                  composer.scheduledBlocks,
                  composer.estimateFiles,
                  composer.selectedEstimateFileIds
                )
              : ''
          )
          setLoading(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load email composer.'
          )
          setLoading(false)
        }
      }
    }

    void loadComposer()

    return () => {
      cancelled = true
    }
  }, [jobId, open, stage])

  const missingEstimateSelection = needsEstimateAttachment && selectedEstimateFiles.length === 0
  const canSend =
    !loading && !sending && !error && blockingIssues.length === 0 && !missingEstimateSelection
  const closeLabel = stage === 'completed' ? 'Skip for now' : 'Cancel'
  const actionLabel =
    stage != null ? stageEmailActionLabel(stage, alreadySent) : 'Send email'

  const send = async () => {
    if (!jobId || !stage || !canSend || sending) return null

    setSending(true)
    setError(null)

    try {
      const result = await sendStageEmail(jobId, {
        stage,
        subject,
        body,
        estimateFileIds: needsEstimateAttachment ? selectedEstimateFileIds : undefined,
      })
      if (result.job) {
        setJob((prev) => (prev ? { ...prev, ...result.job } : prev))
      }
      setSending(false)
      return result
    } catch (sendError) {
      setSending(false)
      setError(sendError instanceof Error ? sendError.message : 'Failed to send email.')
      return null
    }
  }

  return {
    job,
    subject,
    setSubject,
    body,
    setBody,
    loading,
    sending,
    error,
    blockingIssues,
    estimateFiles,
    selectedEstimateFiles,
    selectedEstimateFileIds,
    setSelectedEstimateFileIds,
    showEstimatePicker,
    setShowEstimatePicker,
    needsEstimateAttachment,
    missingEstimateSelection,
    canSend,
    closeLabel,
    actionLabel,
    alreadySent,
    send,
  }
}
