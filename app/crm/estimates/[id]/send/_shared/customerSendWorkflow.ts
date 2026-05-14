'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { templatePresets } from '@/lib/customer-estimates/presets'
import {
  type CustomerSendMutationResponse,
  loadCustomerSendPage,
  saveCustomerSendDraft,
  submitCustomerSend,
} from '@/lib/customer-send/client'
import type {
  CustomerEstimateDocument,
  CustomerEstimateSectionKey,
} from '@/lib/customer-estimates/types'
import type {
  CustomerSendPageData,
  EstimateCustomerSendSettings,
} from '@/lib/server/customer-send/types'
import {
  estimateRouteFamily,
  type EstimateRouteFamily,
} from '../../estimateRouteFamily'

export type CustomerSendRouteCatalogSource = 'estimate' | 'v2'

export type CustomerSendVersionState = {
  status: string
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  declined_at: string | null
  public_token: string | null
}

export type CustomerSendLabels = {
  document: 'Quote' | 'Estimate'
  documentLower: 'quote' | 'estimate'
  shell: 'Customer Quote' | 'Customer Estimate'
  action: 'Send Quote' | 'Send Estimate'
}

export type CustomerSendFormBase = {
  to_email: string
  cc_email: string
  bcc_email: string
  template_key: string
  subject: string
  body: string
  title: string
  scope_text_edits: Record<CustomerEstimateSectionKey, string>
}

export type CustomerSendComposerDraft = CustomerSendFormBase & {
  quote_validity_days: string
}

export type CustomerSendReviewDraft = CustomerSendFormBase

type UseCustomerSendWorkflowOptions<TForm extends CustomerSendFormBase> = {
  estimateId: string
  catalogSource?: CustomerSendRouteCatalogSource
  routeFamily?: EstimateRouteFamily
  buildForm: (
    data: CustomerSendPageData,
    draft: Record<string, unknown>,
    keepScopeWordingDrafts: boolean
  ) => TForm
  draftPayload: (form: TForm) => Record<string, unknown>
  loadErrorMessage: string
}

const CUSTOMER_SEND_LINK_LIVE_MESSAGE =
  'Customer link is ready. Copy the link or try sending the email again.'
const CUSTOMER_SEND_DELIVERY_FAILED_MESSAGE = 'Email delivery did not complete.'

export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

const EMAIL_PATTERN = /^[^\s@<>,;:"]+@[^\s@<>,;:"]+\.[^\s@<>,;:"]+$/

export function isValidRecipientList(value: string) {
  const trimmed = asText(value)
  if (!trimmed) return true
  return trimmed
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .every((recipient) => EMAIL_PATTERN.test(recipient))
}

function defaultInternalBcc(data: Pick<CustomerSendPageData, 'company'>) {
  return asText(data.company.business_email)
}

function defaultCustomerRecipient(data: Pick<CustomerSendPageData, 'job' | 'document'>) {
  return asText(data.job.customer_email) || asText(data.document.customer.email)
}

function draftCustomerRecipient(
  data: Pick<CustomerSendPageData, 'job' | 'document' | 'company'>,
  draft: Record<string, unknown>
) {
  const draftTo = asText(draft.to_email)
  const customerTo = defaultCustomerRecipient(data)
  const internalBcc = defaultInternalBcc(data)

  if (
    draftTo &&
    customerTo &&
    internalBcc &&
    draftTo.toLowerCase() === internalBcc.toLowerCase()
  ) {
    return customerTo
  }

  return draftTo || customerTo
}

export function isPositiveInteger(value: string) {
  const normalized = asText(value)
  if (!normalized) return false
  return /^[1-9]\d*$/.test(normalized)
}

export function customerSendUrl(
  estimateId: string,
  catalogSource?: CustomerSendRouteCatalogSource,
  routeFamily: EstimateRouteFamily = estimateRouteFamily
) {
  return routeFamily.customerSendApiHref(estimateId, { catalogSource })
}

function customerSendReloadUrl(
  estimateId: string,
  catalogSource: CustomerSendRouteCatalogSource | undefined,
  routeFamily: EstimateRouteFamily,
  hard?: boolean
) {
  const url = customerSendUrl(estimateId, catalogSource, routeFamily)
  if (!hard) return url
  return `${url}${url.includes('?') ? '&' : '?'}refresh=1`
}

export function sectionDraftText(
  draft: Record<string, unknown> | null | undefined,
  key: CustomerEstimateSectionKey
) {
  const scope = (draft?.scope_text_edits as Record<string, unknown> | null | undefined) ?? {}
  return asText(scope[key])
}

export function sectionDocumentText(
  document: Pick<CustomerEstimateDocument, 'scopes'> | null | undefined,
  key: CustomerEstimateSectionKey
) {
  return asText(document?.scopes?.find((section) => section.key === key)?.text)
}

export function editableScopeText(params: {
  data: CustomerSendPageData
  draft: Record<string, unknown>
  key: CustomerEstimateSectionKey
  keepScopeWordingDrafts: boolean
}) {
  const draftText = params.keepScopeWordingDrafts
    ? sectionDraftText(params.draft, params.key)
    : ''
  return draftText || sectionDocumentText(params.data.document, params.key)
}

export function normalizeCustomerSendVersion(
  version: Record<string, unknown> | null | undefined,
  fallbackStatus = 'draft'
): CustomerSendVersionState {
  return {
    status: asText(version?.status) || fallbackStatus,
    sent_at: (version?.sent_at as string | null) ?? null,
    viewed_at: (version?.viewed_at as string | null) ?? null,
    accepted_at: (version?.accepted_at as string | null) ?? null,
    declined_at: (version?.declined_at as string | null) ?? null,
    public_token: (version?.public_token as string | null) ?? null,
  }
}

export function deriveCustomerSendLabels(
  data: Pick<CustomerSendPageData, 'document'> | null | undefined
): CustomerSendLabels {
  const isV2Quote =
    data?.document.meta.flow_version === 'v2' ||
    data?.document.meta.flow_version === 'manual_pdf'
  return isV2Quote
    ? {
        document: 'Quote',
        documentLower: 'quote',
        shell: 'Customer Quote',
        action: 'Send Quote',
      }
    : {
        document: 'Estimate',
        documentLower: 'estimate',
        shell: 'Customer Estimate',
        action: 'Send Estimate',
      }
}

export function resolveCustomerSendTemplatePresets(
  settings: EstimateCustomerSendSettings | null | undefined
) {
  return Array.isArray(settings?.template_presets) && settings.template_presets.length > 0
    ? settings.template_presets
    : templatePresets
}

export function buildCustomerSendComposerDraft(
  data: CustomerSendPageData,
  draft: Record<string, unknown>,
  keepScopeWordingDrafts: boolean
): CustomerSendComposerDraft {
  const settings = data.settings ?? {}
  const presets = resolveCustomerSendTemplatePresets(settings)
  const preset =
    presets.find(
      (item) =>
        item.key === asText(draft.template_key) ||
        item.key === asText(settings.default_template_key)
    ) ?? presets[0] ?? templatePresets[0]

  return {
    to_email: draftCustomerRecipient(data, draft),
    cc_email: asText(draft.cc_email),
    bcc_email: asText(draft.bcc_email) || defaultInternalBcc(data),
    subject:
      asText(draft.subject) ||
      preset.subject ||
      `${asText(data.document.meta.title) || 'Quote'} from ${asText(data.company.business_name) || 'ACE Painting'}`,
    body:
      asText(draft.body) ||
      preset.body ||
      `Hello ${asText(data.document.customer.name) || 'there'},\n\nYour quote is ready for review.\n\nThank you.`,
    template_key: asText(draft.template_key) || preset.key,
    title: asText(draft.title) || asText(data.document.meta.title),
    quote_validity_days:
      asText(draft.quote_validity_days) || String(data.document.quote_validity_days ?? 90),
    scope_text_edits: {
      walls: editableScopeText({ data, draft, key: 'walls', keepScopeWordingDrafts }),
      ceilings: editableScopeText({ data, draft, key: 'ceilings', keepScopeWordingDrafts }),
      trim: editableScopeText({ data, draft, key: 'trim', keepScopeWordingDrafts }),
      doors: editableScopeText({ data, draft, key: 'doors', keepScopeWordingDrafts }),
      drywall: editableScopeText({ data, draft, key: 'drywall', keepScopeWordingDrafts }),
      cabinets: editableScopeText({ data, draft, key: 'cabinets', keepScopeWordingDrafts }),
      other: editableScopeText({ data, draft, key: 'other', keepScopeWordingDrafts }),
    },
  }
}

export function buildCustomerSendReviewDraft(
  data: CustomerSendPageData,
  draft: Record<string, unknown>
): CustomerSendReviewDraft {
  const settings = data.settings ?? {}
  const presets = resolveCustomerSendTemplatePresets(settings)
  const preset =
    presets.find(
      (item) =>
        item.key === asText(draft.template_key) ||
        item.key === asText(settings.default_template_key)
    ) ?? presets[0] ?? templatePresets[0]

  return {
    to_email: draftCustomerRecipient(data, draft),
    cc_email: asText(draft.cc_email),
    bcc_email: asText(draft.bcc_email) || defaultInternalBcc(data),
    template_key: preset.key,
    subject: asText(draft.subject) || preset.subject,
    body: asText(draft.body) || preset.body,
    title: asText(draft.title) || asText(data.document.meta.title),
    scope_text_edits: {
      walls: editableScopeText({ data, draft, key: 'walls', keepScopeWordingDrafts: true }),
      ceilings: editableScopeText({ data, draft, key: 'ceilings', keepScopeWordingDrafts: true }),
      trim: editableScopeText({ data, draft, key: 'trim', keepScopeWordingDrafts: true }),
      doors: editableScopeText({ data, draft, key: 'doors', keepScopeWordingDrafts: true }),
      drywall: editableScopeText({ data, draft, key: 'drywall', keepScopeWordingDrafts: true }),
      cabinets: editableScopeText({ data, draft, key: 'cabinets', keepScopeWordingDrafts: true }),
      other: editableScopeText({ data, draft, key: 'other', keepScopeWordingDrafts: true }),
    },
  }
}

function serializeDraftSnapshot<TForm extends CustomerSendFormBase>(
  form: TForm,
  draftPayload: (form: TForm) => Record<string, unknown>
) {
  return JSON.stringify(draftPayload(form))
}

export function useCustomerSendWorkflow<TForm extends CustomerSendFormBase>({
  estimateId,
  catalogSource,
  routeFamily = estimateRouteFamily,
  buildForm,
  draftPayload,
  loadErrorMessage,
}: UseCustomerSendWorkflowOptions<TForm>) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [busyAction, setBusyAction] = useState<'save' | 'send' | 'test' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CustomerSendPageData | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [version, setVersion] = useState<CustomerSendVersionState | null>(null)
  const [form, setForm] = useState<TForm | null>(null)
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const buildFormRef = useRef(buildForm)
  const draftPayloadRef = useRef(draftPayload)

  useEffect(() => {
    buildFormRef.current = buildForm
  }, [buildForm])

  useEffect(() => {
    draftPayloadRef.current = draftPayload
  }, [draftPayload])

  const applyPersistedMutation = useCallback(
    (
      payload: CustomerSendMutationResponse,
      options?: {
        persistedForm?: TForm
      }
    ) => {
      const nextPublicUrl = (payload.public_url as string | null) ?? publicUrl
      const nextVersion = payload.version ?? null
      const nextDocument = payload.document ?? null
      const nextReadiness = payload.readiness ?? null

      setPublicUrl(nextPublicUrl)
      if (nextVersion) {
        setVersion(normalizeCustomerSendVersion(nextVersion))
      }

      setData((current) => {
        if (!current) return current
        return {
          ...current,
          draft: options?.persistedForm
            ? { ...current.draft, ...draftPayloadRef.current(options.persistedForm) }
            : current.draft,
          version: nextVersion
            ? { ...(current.version ?? { id: null }), ...nextVersion }
            : current.version,
          public_url: nextPublicUrl,
          document: nextDocument ?? current.document,
          readiness: nextReadiness ?? current.readiness,
        }
      })

      if (options?.persistedForm) {
        setSavedDraftSnapshot(serializeDraftSnapshot(options.persistedForm, draftPayloadRef.current))
      }
    },
    [publicUrl]
  )

  const reload = useCallback(
    async (options?: { hard?: boolean }) => {
      setLoading(true)
      if (options?.hard) {
        setMessage(null)
        setError(null)
      } else {
        setError(null)
      }

      let payload: CustomerSendPageData
      try {
        payload = await loadCustomerSendPage<CustomerSendPageData>(
          customerSendReloadUrl(estimateId, catalogSource, routeFamily, options?.hard)
        )
      } catch (loadError) {
        if (!mountedRef.current) return false
        setError(loadError instanceof Error ? loadError.message : loadErrorMessage)
        setLoading(false)
        return false
      }
      if (!mountedRef.current) return false

      setData(payload)
      setPublicUrl((payload.public_url as string | null) ?? null)
      setVersion(normalizeCustomerSendVersion(payload.version))
      const nextForm = buildFormRef.current(payload, payload.draft ?? {}, !options?.hard)
      setForm(nextForm)
      setSavedDraftSnapshot(serializeDraftSnapshot(nextForm, draftPayloadRef.current))
      setLoading(false)
      return true
    },
    [catalogSource, estimateId, loadErrorMessage, routeFamily]
  )

  useEffect(() => {
    mountedRef.current = true
    void reload()
    return () => {
      mountedRef.current = false
    }
  }, [reload])

  const labels = useMemo(() => deriveCustomerSendLabels(data), [data])

  const liveDocument = data?.document ?? null
  const readiness = data?.readiness ?? null

  const currentTemplate = useMemo(() => {
    const presets = resolveCustomerSendTemplatePresets(data?.settings)
    return presets.find((preset) => preset.key === form?.template_key) ?? presets[0] ?? templatePresets[0]
  }, [data?.settings, form?.template_key])

  const hasSendBlockers = (readiness?.blockers.length ?? 0) > 0
  const hasUnsavedChanges = useMemo(() => {
    if (!form || savedDraftSnapshot == null) return false
    return serializeDraftSnapshot(form, draftPayload) !== savedDraftSnapshot
  }, [draftPayload, form, savedDraftSnapshot])
  const isSavingDraft = busyAction === 'save'

  const isLive = asText(version?.status) !== 'draft'
  const hasLiveLink = Boolean(publicUrl)

  const persistDraft = useCallback(async () => {
    if (!form) return false
    setBusy(true)
    setBusyAction('save')
    setError(null)
    setMessage(null)

    let payload: CustomerSendMutationResponse
    try {
      payload = await saveCustomerSendDraft<CustomerSendMutationResponse>(
        customerSendUrl(estimateId, catalogSource, routeFamily),
        draftPayload(form)
      )
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save draft')
      setBusy(false)
      setBusyAction(null)
      return false
    }

    setMessage('Draft saved.')
    applyPersistedMutation(payload, { persistedForm: form })
    setBusy(false)
    setBusyAction(null)
    return true
  }, [applyPersistedMutation, catalogSource, draftPayload, estimateId, form, routeFamily])

  const submit = useCallback(
    async (mode: 'test' | 'send', options?: { testRecipient?: string }) => {
      if (!form) return false
      if (!isValidRecipientList(form.to_email)) {
        setError('Enter a valid To email address list.')
        return false
      }
      if (!isValidRecipientList(form.cc_email)) {
        setError('Enter a valid CC email address list.')
        return false
      }
      if (!isValidRecipientList(form.bcc_email)) {
        setError('Enter a valid BCC email address list.')
        return false
      }
      if (!asText(form.subject)) {
        setError('Subject is required.')
        return false
      }
      if ('quote_validity_days' in form) {
        const days = (form as unknown as { quote_validity_days?: string }).quote_validity_days
        if (typeof days === 'string' && !isPositiveInteger(days)) {
          setError('Validity days must be a whole number greater than 0.')
          return false
        }
      }
      const testRecipient = asText(options?.testRecipient)
      if (mode === 'test' && !testRecipient) {
        setError('Test recipient email is required.')
        return false
      }
      if (mode === 'test' && !isValidRecipientList(testRecipient)) {
        setError('Enter a valid test recipient email.')
        return false
      }
      if (mode === 'test' && testRecipient.toLowerCase() === form.to_email.trim().toLowerCase()) {
        setError('Use an internal test recipient, not the customer To address.')
        return false
      }
      if (mode === 'send' && hasUnsavedChanges) {
        setError(`Save the draft to refresh the server preview before sending this ${labels.documentLower}.`)
        return false
      }
      if (mode === 'send' && hasSendBlockers && readiness) {
        setError(readiness.blockers.map((issue) => issue.message).join(' '))
        return false
      }

      setBusy(true)
      setBusyAction(mode)
      setError(null)
      setMessage(null)
      const submitForm =
        mode === 'test'
          ? ({
              ...form,
              to_email: testRecipient,
              cc_email: '',
              bcc_email: '',
            } as TForm)
          : form

      let payload: CustomerSendMutationResponse
      try {
        payload = await submitCustomerSend<CustomerSendMutationResponse>(
          customerSendUrl(estimateId, catalogSource, routeFamily),
          {
            mode,
            draft: draftPayload(submitForm),
          }
        )
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : `Unable to send ${labels.documentLower}`
        )
        setBusy(false)
        setBusyAction(null)
        return false
      }

      setMessage(mode === 'test' ? 'Test message sent.' : `${labels.document} sent.`)
      applyPersistedMutation(payload, {
        persistedForm: mode === 'send' ? submitForm : undefined,
      })
      if (payload.version) {
        setVersion(
          normalizeCustomerSendVersion(payload.version, mode === 'send' ? 'sent' : 'draft')
        )
      }
      if (mode === 'send' && asText(payload.delivery_error)) {
        const deliveryError = asText(payload.delivery_error)
        console.error('Customer send delivery failed after public link creation', {
          estimateId,
          route: customerSendUrl(estimateId, catalogSource, routeFamily),
          documentType: labels.documentLower,
          deliveryError,
        })
        setError(`${CUSTOMER_SEND_DELIVERY_FAILED_MESSAGE} ${deliveryError}`)
        setMessage(CUSTOMER_SEND_LINK_LIVE_MESSAGE)
        setBusy(false)
        setBusyAction(null)
        return false
      }
      setBusy(false)
      setBusyAction(null)
      return true
    },
    [
      applyPersistedMutation,
      catalogSource,
      draftPayload,
      estimateId,
      form,
      hasUnsavedChanges,
      labels.document,
      labels.documentLower,
      hasSendBlockers,
      readiness,
      routeFamily,
    ]
  )

  return {
    loading,
    busy,
    message,
    setMessage,
    error,
    setError,
    data,
    publicUrl,
    setPublicUrl,
    version,
    form,
    setForm,
    reload,
    persistDraft,
    submit,
    labels,
    liveDocument,
    readiness,
    hasSendBlockers,
    hasUnsavedChanges,
    isSavingDraft,
    currentTemplate,
    isLive,
    hasLiveLink,
  }
}
