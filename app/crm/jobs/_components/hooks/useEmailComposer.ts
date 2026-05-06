'use client'

import {
  fetchStageEmailComposerData,
  sendStageEmail,
} from '@/lib/jobs/actions'
import type { EstimateDriveFile, JobDetail } from '@/types/jobs/api'
import {
  applyTemplate,
  buildEstimateFileTemplateVars,
  buildJobEmailTemplateVars,
  formatJobTemplateDate,
  formatJobTemplateRange,
} from '@/lib/jobs/emailTemplate'
import { stageEmailActionLabel, type StageEmailStage } from '@/lib/jobs/types'
import { useEffect, useMemo, useState, type SetStateAction } from 'react'

function applyJobTemplate(
  value: string,
  job: JobDetail | null,
  scheduledBlocks: string,
  estimateFiles: EstimateDriveFile[],
  selectedEstimateFileIds: string[]
) {
  return applyTemplate(
    value,
    buildJobEmailTemplateVars(
      {
        customerName: job?.customer_name ?? '',
        customerEmail: job?.customer_email ?? '',
        customerPhone: job?.customer_phone ?? '',
        customerAddress: job?.customer_address ?? '',
        jobTitle: job?.title ?? '',
        estimateDate: formatJobTemplateDate(job?.estimate_date),
        scheduledDate: formatJobTemplateDate(job?.scheduled_date),
        scheduledBlocks:
          scheduledBlocks || formatJobTemplateRange(job?.scheduled_date, job?.scheduled_end_date),
        ...buildEstimateFileTemplateVars({
          estimateFiles,
          selectedEstimateFileIds,
        }),
      },
      {
        reviewLink: process.env.NEXT_PUBLIC_REVIEW_LINK,
      }
    )
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
  const [templateSubject, setTemplateSubject] = useState<string | null>(null)
  const [templateBody, setTemplateBody] = useState<string | null>(null)
  const [scheduledBlocks, setScheduledBlocks] = useState('')
  const [subjectDirty, setSubjectDirty] = useState(false)
  const [bodyDirty, setBodyDirty] = useState(false)
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

  const updateSubject = (value: SetStateAction<string>) => {
    setSubjectDirty(true)
    setSubject(value)
  }

  const updateBody = (value: SetStateAction<string>) => {
    setBodyDirty(true)
    setBody(value)
  }

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
      setTemplateSubject(null)
      setTemplateBody(null)
      setScheduledBlocks('')
      setSubjectDirty(false)
      setBodyDirty(false)
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
          setTemplateSubject(composer.template?.subject ?? null)
          setTemplateBody(composer.template?.body ?? null)
          setScheduledBlocks(composer.scheduledBlocks)
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

  useEffect(() => {
    if (!needsEstimateAttachment) return
    if (!job) return

    if (templateSubject && !subjectDirty) {
      setSubject(
        applyJobTemplate(
          templateSubject,
          job,
          scheduledBlocks,
          estimateFiles,
          selectedEstimateFileIds
        )
      )
    }

    if (templateBody && !bodyDirty) {
      setBody(
        applyJobTemplate(
          templateBody,
          job,
          scheduledBlocks,
          estimateFiles,
          selectedEstimateFileIds
        )
      )
    }
  }, [
    estimateFiles,
    job,
    needsEstimateAttachment,
    selectedEstimateFileIds,
    scheduledBlocks,
    subjectDirty,
    bodyDirty,
    templateSubject,
    templateBody,
  ])

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
    setSubject: updateSubject,
    body,
    setBody: updateBody,
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
