'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { loadCustomerList } from '@/lib/customers/client'
import { loadEmailTemplates } from '@/lib/emailTemplates/api'
import {
  createGoogleCalendarEvent,
  createJob,
} from '@/lib/jobs/client'
import { sendStageEmail } from '@/lib/jobs/actions'
import {
  next8amLocalDateTimeValue,
  toIsoFromLocalDateTimeValue,
} from '@/lib/jobs/dateHelpers'
import { applyTemplate, buildJobEmailTemplateVars } from '@/lib/jobs/emailTemplate'
import type { JobStatus, StageEmailStage } from '@/lib/jobs/types'

export type CustomerOption = {
  id: string
  name: string
  address: string | null
  email: string | null
  phone: string | null
}

type EmailTemplate = {
  stage: string
  subject: string | null
  body: string | null
}

function addHours(startIso: string, hours: number) {
  const date = new Date(startIso)
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString()
}

export function useNewJobPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')

  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<JobStatus>('estimate_scheduled')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [estimateDateLocal, setEstimateDateLocal] = useState('')
  const [scheduledDateLocal, setScheduledDateLocal] = useState('')
  const [addEstimateToCalendar, setAddEstimateToCalendar] = useState(true)
  const [estimateSummary, setEstimateSummary] = useState('')
  const [estimateLocation, setEstimateLocation] = useState('')
  const [estimateHours, setEstimateHours] = useState(1)
  const [addScheduledToCalendar, setAddScheduledToCalendar] = useState(true)
  const [scheduledSummary, setScheduledSummary] = useState('')
  const [scheduledLocation, setScheduledLocation] = useState('')
  const [scheduledHours, setScheduledHours] = useState(8)
  const [composeStage, setComposeStage] = useState<StageEmailStage | null>(null)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeLoading, setComposeLoading] = useState(false)
  const [sendingStage, setSendingStage] = useState<string | null>(null)

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customers, customerId]
  )

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase()
    if (!query) return customers.slice(0, 2)
    return customers
      .filter((customer) => {
        const haystack =
          `${customer.name} ${customer.email ?? ''} ${customer.phone ?? ''} ${customer.address ?? ''}`.toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 20)
  }, [customers, customerQuery])

  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await loadCustomerList()
        setCustomers(
          rows.map((customer) => ({
            id: customer.id,
            name: customer.name ?? 'Unknown customer',
            address: customer.address ?? null,
            email: customer.email ?? null,
            phone: customer.phone ?? null,
          }))
        )
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load customers.')
        setCustomers([])
      } finally {
        setLoading(false)
      }
    }

    void loadCustomers()
  }, [])

  useEffect(() => {
    if (!preselectedCustomerId || customerId) return
    const match = customers.find((customer) => customer.id === preselectedCustomerId)
    if (match) {
      setCustomerId(match.id)
      setCustomerQuery('')
    }
  }, [customerId, customers, preselectedCustomerId])

  useEffect(() => {
    const customerName = selectedCustomer?.name ?? 'Customer'
    const location = selectedCustomer?.address ?? ''
    setEstimateSummary(`Estimate: ${customerName}`)
    setScheduledSummary(`Job - ${customerName}`)
    setEstimateLocation(location)
    setScheduledLocation(location)
  }, [selectedCustomer?.id, selectedCustomer?.name, selectedCustomer?.address])

  useEffect(() => {
    if (status === 'estimate_scheduled' && !estimateDateLocal) {
      setEstimateDateLocal(next8amLocalDateTimeValue())
    }
    if (status === 'scheduled' && !scheduledDateLocal) {
      setScheduledDateLocal(next8amLocalDateTimeValue())
    }
  }, [status, estimateDateLocal, scheduledDateLocal])

  useEffect(() => {
    if (status !== 'estimate_scheduled' && composeStage === 'estimate_scheduled') {
      setComposeStage(null)
    }
  }, [composeStage, status])

  const createCalendarInvite = async (args: {
    summary: string
    location?: string | null
    description?: string | null
    startIso: string
    endIso: string
  }) => {
    return createGoogleCalendarEvent(args)
  }

  const openComposer = async (stage: StageEmailStage) => {
    setComposeStage(stage)
    setComposeLoading(true)
    setError(null)

    const templates = await loadEmailTemplates().catch((loadError) => loadError)
    setComposeLoading(false)
    if (templates instanceof Error) {
      setError(templates.message)
      return
    }

    const row = (templates as EmailTemplate[]).find((template) => template.stage === stage)
    const estimateIso = estimateDateLocal ? toIsoFromLocalDateTimeValue(estimateDateLocal) : null
    const scheduledIso = scheduledDateLocal ? toIsoFromLocalDateTimeValue(scheduledDateLocal) : null
    const vars = buildJobEmailTemplateVars({
      customerName: selectedCustomer?.name ?? '',
      customerEmail: selectedCustomer?.email ?? '',
      customerPhone: selectedCustomer?.phone ?? '',
      customerAddress: selectedCustomer?.address ?? '',
      jobTitle: title.trim(),
      estimateDate: estimateIso ? new Date(estimateIso).toLocaleString() : '',
      scheduledDate: scheduledIso ? new Date(scheduledIso).toLocaleString() : '',
      scheduledBlocks: scheduledIso ? new Date(scheduledIso).toLocaleString() : '',
      estimateFileName: '',
      estimateFileLink: '',
    })
    setComposeSubject(applyTemplate(row?.subject ?? '', vars))
    setComposeBody(applyTemplate(row?.body ?? '', vars))
  }

  const save = async (options?: { sendEstimateScheduled?: boolean }) => {
    setError(null)
    setCreatedJobId(null)

    if (!customerId) {
      setError('Select a customer')
      return
    }
    if (!title.trim()) {
      setError('Job title is required')
      return
    }
    if (options?.sendEstimateScheduled && status !== 'estimate_scheduled') {
      setError('Quote scheduled email requires the "Quote scheduled" stage.')
      return
    }

    const estimateIso = estimateDateLocal ? toIsoFromLocalDateTimeValue(estimateDateLocal) : null
    if (estimateDateLocal && !estimateIso) {
      setError('Quote date/time is invalid')
      return
    }
    if (options?.sendEstimateScheduled && !estimateIso) {
      setError('Add a quote date/time before sending the email.')
      return
    }

    const scheduledIso = scheduledDateLocal ? toIsoFromLocalDateTimeValue(scheduledDateLocal) : null
    if (scheduledDateLocal && !scheduledIso) {
      setError('Scheduled date/time is invalid')
      return
    }

    setSaving(true)
    try {
      const createdJob = await createJob({
        customer_id: customerId,
        title: title.trim(),
        description: description.trim() || null,
        status,
        estimate_date: status === 'estimate_scheduled' ? estimateIso : null,
        scheduled_date: status === 'scheduled' ? scheduledIso : null,
      })
      const createdId = createdJob?.id ?? null
      setCreatedJobId(createdId)

      if (options?.sendEstimateScheduled) {
        if (!createdId) throw new Error('Job created without an id; unable to send email.')
        if (!selectedCustomer?.email) throw new Error('Customer email is missing.')
        setSendingStage('estimate_scheduled')
        await sendStageEmail(createdId, {
          stage: 'estimate_scheduled',
          subject: composeSubject,
          body: composeBody,
        })
        setSendingStage(null)
      }

      if (status === 'estimate_scheduled' && addEstimateToCalendar && estimateIso) {
        await createCalendarInvite({
          summary: estimateSummary || `Estimate: ${selectedCustomer?.name ?? 'Customer'}`,
          location: estimateLocation || selectedCustomer?.address,
          description: description.trim() || selectedCustomer?.address || null,
          startIso: estimateIso,
          endIso: addHours(estimateIso, Math.max(0.25, estimateHours)),
        })
      }

      if (status === 'scheduled' && addScheduledToCalendar && scheduledIso) {
        await createCalendarInvite({
          summary: scheduledSummary || `Job - ${selectedCustomer?.name ?? 'Customer'}`,
          location: scheduledLocation || selectedCustomer?.address,
          description: description.trim() || selectedCustomer?.address || null,
          startIso: scheduledIso,
          endIso: addHours(scheduledIso, Math.max(0.25, scheduledHours)),
        })
      }

      router.push('/crm/jobs')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to create job')
      setSaving(false)
      setSendingStage(null)
      return
    }

    setSaving(false)
  }

  return {
    customers,
    customerQuery,
    setCustomerQuery,
    customerId,
    setCustomerId,
    loading,
    error,
    saving,
    createdJobId,
    status,
    setStatus,
    title,
    setTitle,
    description,
    setDescription,
    estimateDateLocal,
    setEstimateDateLocal,
    scheduledDateLocal,
    setScheduledDateLocal,
    addEstimateToCalendar,
    setAddEstimateToCalendar,
    estimateSummary,
    setEstimateSummary,
    estimateLocation,
    setEstimateLocation,
    estimateHours,
    setEstimateHours,
    addScheduledToCalendar,
    setAddScheduledToCalendar,
    scheduledSummary,
    setScheduledSummary,
    scheduledLocation,
    setScheduledLocation,
    scheduledHours,
    setScheduledHours,
    composeStage,
    setComposeStage,
    composeSubject,
    setComposeSubject,
    composeBody,
    setComposeBody,
    composeLoading,
    sendingStage,
    selectedCustomer,
    filteredCustomers,
    openComposer,
    save,
  }
}
