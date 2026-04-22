'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import {
  loadEmailTemplates,
  saveEmailTemplate as saveEmailTemplateRequest,
} from '@/lib/emailTemplates/api'
import type { EmailTemplateRecord } from '@/lib/emailTemplates/types'

export type EmailTemplateStage =
  | 'estimate_scheduled'
  | 'estimate_sent'
  | 'follow_up'
  | 'scheduled'
  | 'completed'

type EmailTemplatesState = Record<string, { subject: string; body: string }>

const emptyTemplatesState: EmailTemplatesState = {}

export const emailTemplateStages: Array<{ key: EmailTemplateStage; label: string }> = [
  { key: 'estimate_scheduled', label: 'Quote scheduled' },
  { key: 'estimate_sent', label: 'Quote sent' },
  { key: 'follow_up', label: 'Follow up' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed / review request' },
]

function toTemplatesState(rows: EmailTemplateRecord[]) {
  return rows.reduce<EmailTemplatesState>((acc, row) => {
    acc[row.stage] = {
      subject: row.subject ?? '',
      body: row.body ?? '',
    }
    return acc
  }, {})
}

function defaultTemplateState() {
  return { subject: '', body: '' }
}

export function useEmailTemplatesController() {
  const [active, setActive] = useState<EmailTemplateStage>('estimate_scheduled')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const resource = useEditableResource<EmailTemplatesState>({
    initialData: emptyTemplatesState,
    load: async () => toTemplatesState(await loadEmailTemplates()),
    save: async (templates) => {
      const current = templates[active] ?? defaultTemplateState()
      const result = await saveEmailTemplateRequest({
        stage: active,
        subject: current.subject,
        body: current.body,
      })

      return {
        data: {
          ...templates,
          [active]: {
            subject: result.data.subject,
            body: result.data.body,
          },
        },
        notice: result.notice ?? 'Email template saved.',
      }
    },
  })

  useEffect(() => {
    const current = resource.data[active] ?? defaultTemplateState()
    setSubject(current.subject)
    setBody(current.body)
  }, [active, resource.data])

  const activeLabel = useMemo(
    () => emailTemplateStages.find((stage) => stage.key === active)?.label ?? active,
    [active]
  )

  const updateSubject = useCallback(
    (value: string) => {
      setSubject(value)
      resource.setData((current) => ({
        ...current,
        [active]: {
          ...(current[active] ?? defaultTemplateState()),
          subject: value,
        },
      }))
    },
    [active, resource]
  )

  const updateBody = useCallback(
    (value: string) => {
      setBody(value)
      resource.setData((current) => ({
        ...current,
        [active]: {
          ...(current[active] ?? defaultTemplateState()),
          body: value,
        },
      }))
    },
    [active, resource]
  )

  const insertVariable = useCallback(
    (value: string) => {
      const nextBody = body ? `${body}\n${value}` : value
      updateBody(nextBody)
    },
    [body, updateBody]
  )

  return {
    hasLoaded: resource.hasLoaded,
    active,
    setActive,
    activeLabel,
    subject,
    setSubject: updateSubject,
    body,
    setBody: updateBody,
    insertVariable,
    loading: resource.loading,
    saving: resource.saving,
    error: resource.error,
    notice: resource.notice,
    dirty: resource.dirty,
    reload: resource.reload,
    saveChanges: resource.saveChanges,
  }
}
