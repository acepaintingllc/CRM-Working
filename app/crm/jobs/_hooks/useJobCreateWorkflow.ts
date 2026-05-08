'use client'

import { useCallback, useState } from 'react'
import { loadEmailTemplates } from '@/lib/emailTemplates/api'
import { sendStageEmail } from '@/lib/jobs/actions'
import { createGoogleCalendarEvent } from '@/lib/jobs/client'
import {
  applyTemplate,
  buildJobEmailTemplateVars,
  formatJobTemplateDate,
} from '@/lib/jobs/emailTemplate'
import { validateJobCreateValues, type JobCreateValues } from '@/lib/jobs/forms'
import type { StageEmailStage } from '@/lib/jobs/types'

type EmailTemplate = {
  stage: string
  subject: string | null
  body: string | null
}

type SelectedCustomer = {
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
}

function addHours(startIso: string, hours: number) {
  const date = new Date(startIso)
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString()
}

export function useJobCreateWorkflow(params: {
  value: JobCreateValues
  selectedCustomer: SelectedCustomer | null
  setValue: React.Dispatch<React.SetStateAction<JobCreateValues>>
  setError: (value: string | null) => void
  setNotice: (value: string | null) => void
}) {
  const { value, selectedCustomer, setValue, setError, setNotice } = params
  const [composeLoading, setComposeLoading] = useState(false)
  const [sendingStage, setSendingStage] = useState<string | null>(null)

  const openComposer = useCallback(async (stage: StageEmailStage) => {
    setValue((current) => ({ ...current, composeStage: stage }))
    setComposeLoading(true)
    setError(null)
    setNotice(null)

    const templates = await loadEmailTemplates().catch((loadError) => loadError)
    setComposeLoading(false)
    if (templates instanceof Error) {
      setError(templates.message)
      return
    }

    const row = (templates as EmailTemplate[]).find((template) => template.stage === stage)
    const validated = validateJobCreateValues(value)
    const vars = buildJobEmailTemplateVars(
      {
        customerName: selectedCustomer?.name ?? '',
        customerEmail: selectedCustomer?.email ?? '',
        customerPhone: selectedCustomer?.phone ?? '',
        customerAddress: selectedCustomer?.address ?? '',
        jobTitle: validated.ok ? validated.value.title : value.title.trim(),
        estimateDate:
          validated.ok && validated.value.estimateIso
            ? formatJobTemplateDate(validated.value.estimateIso)
            : '',
        scheduledDate:
          validated.ok && validated.value.scheduledIso
            ? formatJobTemplateDate(validated.value.scheduledIso)
            : '',
        scheduledBlocks:
          validated.ok && validated.value.scheduledIso
            ? formatJobTemplateDate(validated.value.scheduledIso)
            : '',
        estimateFileName: '',
        estimateFileLink: '',
      },
      {
        reviewLink: process.env.NEXT_PUBLIC_REVIEW_LINK,
      }
    )

    setValue((current) => ({
      ...current,
      composeSubject: applyTemplate(row?.subject ?? '', vars),
      composeBody: applyTemplate(row?.body ?? '', vars),
    }))
  }, [selectedCustomer, setError, setNotice, setValue, value])

  const runPostCreateSideEffects = useCallback(async (args: {
    createdId: string | null
    sendEstimateScheduled?: boolean
    validated: Extract<ReturnType<typeof validateJobCreateValues>, { ok: true }>['value']
  }) => {
    if (args.sendEstimateScheduled) {
      if (!args.createdId) throw new Error('Job created without an id; unable to send email.')
      setSendingStage('estimate_scheduled')
      await sendStageEmail(args.createdId, {
        stage: 'estimate_scheduled',
        subject: args.validated.composeSubject,
        body: args.validated.composeBody,
      })
      setSendingStage(null)
    }

    if (
      args.validated.status === 'estimate_scheduled' &&
      value.addEstimateToCalendar &&
      args.validated.estimateIso
    ) {
      await createGoogleCalendarEvent({
        summary: value.estimateSummary || `Estimate: ${selectedCustomer?.name ?? 'Customer'}`,
        location: value.estimateLocation || selectedCustomer?.address,
        description: args.validated.description || selectedCustomer?.address || null,
        startIso: args.validated.estimateIso,
        endIso: addHours(args.validated.estimateIso, Math.max(0.25, value.estimateHours)),
      })
    }

    if (
      args.validated.status === 'scheduled' &&
      value.addScheduledToCalendar &&
      args.validated.scheduledIso
    ) {
      await createGoogleCalendarEvent({
        summary: value.scheduledSummary || `Job - ${selectedCustomer?.name ?? 'Customer'}`,
        location: value.scheduledLocation || selectedCustomer?.address,
        description: args.validated.description || selectedCustomer?.address || null,
        startIso: args.validated.scheduledIso,
        endIso: addHours(args.validated.scheduledIso, Math.max(0.25, value.scheduledHours)),
      })
    }
  }, [selectedCustomer, value])

  return {
    composeLoading,
    sendingStage,
    setSendingStage,
    openComposer,
    runPostCreateSideEffects,
  }
}
