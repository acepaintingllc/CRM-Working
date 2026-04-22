'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildCustomerEstimateDocument } from '@/lib/customer-estimates/build'
import { templatePresets } from '@/lib/customer-estimates/presets'
import {
  type CustomerSendMutationResponse,
  loadCustomerSendPage,
  saveCustomerSendDraft,
  submitCustomerSend,
} from '@/lib/customer-send/client'
import type {
  CompanyProfile,
  CustomerEstimateDocument,
  CustomerEstimateSectionKey,
  Unsafe,
} from '@/lib/customer-estimates/types'
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

export type CustomerSendPageData = {
  estimate: Unsafe
  job: {
    customer_name?: string | null
    customer_address?: string | null
    customer_email?: string | null
    customer_phone?: string | null
    title?: string | null
    estimate_date?: string | null
  }
  customer?: {
    name?: string | null
    company_name?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
  } | null
  company: CompanyProfile
  inputs: {
    rooms?: Unsafe[]
    room_wall_scopes?: Unsafe[]
    room_ceiling_scopes?: Unsafe[]
    room_trim_scopes?: Unsafe[]
    trim_items?: Unsafe[]
    other?: Unsafe[]
    jobsettings?: Unsafe | null
  }
  catalogs?: Unsafe | null
  pricing_summary?: { finalTotal: number | null } | null
  settings?: {
    default_template_key?: string | null
    quote_validity_days?: number | null
    terms_text?: string | null
    updated_at?: string | null
  } | null
  draft: Record<string, unknown>
  version: Record<string, unknown> | null
  public_url: string | null
  document: CustomerEstimateDocument
  versions: Record<string, unknown>[]
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
  buildDocument: (
    data: CustomerSendPageData,
    form: TForm,
    version: CustomerSendVersionState | null
  ) => CustomerEstimateDocument
  draftPayload: (form: TForm) => Record<string, unknown>
  loadErrorMessage: string
}

export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function customerSendUrl(
  estimateId: string,
  catalogSource?: CustomerSendRouteCatalogSource,
  routeFamily: EstimateRouteFamily = estimateRouteFamily
) {
  return routeFamily.customerSendApiHref(estimateId, { catalogSource })
}

export function sectionDraftText(
  draft: Record<string, unknown> | null | undefined,
  key: CustomerEstimateSectionKey
) {
  const scope = (draft?.scope_text_edits as Record<string, unknown> | null | undefined) ?? {}
  return asText(scope[key])
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
  const isV2Quote = data?.document.meta.flow_version === 'v2'
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

export function buildCustomerSendComposerDraft(
  data: CustomerSendPageData,
  draft: Record<string, unknown>,
  keepScopeWordingDrafts: boolean
): CustomerSendComposerDraft {
  return {
    to_email:
      asText(draft.to_email) ||
      asText(data.job.customer_email) ||
      asText(data.document.customer.email),
    cc_email: asText(draft.cc_email),
    bcc_email: asText(draft.bcc_email),
    subject:
      asText(draft.subject) ||
      `${asText(data.document.meta.title) || 'Quote'} from ${
        asText(data.company.business_name) || 'ACE Painting'
      }`,
    body:
      asText(draft.body) ||
      `Hello ${asText(data.document.customer.name) || 'there'},\n\nYour quote is ready for review.\n\nThank you.`,
    template_key: asText(draft.template_key) || 'default',
    title: asText(draft.title) || asText(data.document.meta.title),
    quote_validity_days:
      asText(draft.quote_validity_days) || String(data.document.quote_validity_days ?? 90),
    scope_text_edits: {
      walls: keepScopeWordingDrafts ? sectionDraftText(draft, 'walls') : '',
      ceilings: keepScopeWordingDrafts ? sectionDraftText(draft, 'ceilings') : '',
      trim: keepScopeWordingDrafts ? sectionDraftText(draft, 'trim') : '',
      doors: keepScopeWordingDrafts ? sectionDraftText(draft, 'doors') : '',
      cabinets: keepScopeWordingDrafts ? sectionDraftText(draft, 'cabinets') : '',
      other: keepScopeWordingDrafts ? sectionDraftText(draft, 'other') : '',
    },
  }
}

export function buildCustomerSendReviewDraft(
  data: CustomerSendPageData,
  draft: Record<string, unknown>
): CustomerSendReviewDraft {
  const settings = data.settings ?? {}
  const preset =
    templatePresets.find(
      (item) =>
        item.key === asText(draft.template_key) ||
        item.key === asText(settings.default_template_key)
    ) ?? templatePresets[0]

  return {
    to_email:
      asText(draft.to_email) ||
      asText(data.job.customer_email) ||
      asText(data.document.customer.email),
    cc_email: asText(draft.cc_email),
    bcc_email: asText(draft.bcc_email),
    template_key: preset.key,
    subject: asText(draft.subject) || preset.subject,
    body: asText(draft.body) || preset.body,
    title: asText(draft.title) || asText(data.document.meta.title),
    scope_text_edits: {
      walls: sectionDraftText(draft, 'walls'),
      ceilings: sectionDraftText(draft, 'ceilings'),
      trim: sectionDraftText(draft, 'trim'),
      doors: sectionDraftText(draft, 'doors'),
      cabinets: sectionDraftText(draft, 'cabinets'),
      other: sectionDraftText(draft, 'other'),
    },
  }
}

export function buildCustomerSendComposerPreview(
  data: CustomerSendPageData,
  form: CustomerSendComposerDraft,
  version: CustomerSendVersionState | null
) {
  return buildCustomerEstimateDocument({
    estimate: data.estimate,
    job: data.job,
    customer: data.customer ?? null,
    company: data.company,
    inputs: data.inputs,
    catalogs: data.catalogs ?? null,
    pricingSummary: data.pricing_summary
      ? { finalTotal: data.pricing_summary.finalTotal ?? null }
      : null,
    overrides: {
      title: form.title,
      scope_text_edits: form.scope_text_edits,
      quote_validity_days: form.quote_validity_days,
    },
    publicMeta: {
      status: version?.status ?? 'draft',
      sent_at: version?.sent_at ?? null,
      viewed_at: version?.viewed_at ?? null,
      accepted_at: version?.accepted_at ?? null,
      declined_at: version?.declined_at ?? null,
      public_token: version?.public_token ?? null,
    },
  })
}

export function buildCustomerSendReviewPreview(
  data: CustomerSendPageData,
  form: CustomerSendReviewDraft,
  version: CustomerSendVersionState | null
) {
  return buildCustomerEstimateDocument({
    estimate: data.estimate,
    job: data.job,
    customer: data.customer ?? null,
    company: data.company,
    inputs: data.inputs,
    catalogs: data.catalogs ?? null,
    pricingSummary: data.pricing_summary
      ? { finalTotal: data.pricing_summary.finalTotal ?? null }
      : null,
    settings: data.settings ?? undefined,
    overrides: {
      title: form.title,
      scope_text_edits: form.scope_text_edits,
    },
    publicMeta: {
      status: version?.status ?? 'draft',
      sent_at: version?.sent_at ?? null,
      viewed_at: version?.viewed_at ?? null,
      accepted_at: version?.accepted_at ?? null,
      declined_at: version?.declined_at ?? null,
      public_token: version?.public_token ?? null,
    },
  })
}

export function useCustomerSendWorkflow<TForm extends CustomerSendFormBase>({
  estimateId,
  catalogSource,
  routeFamily = estimateRouteFamily,
  buildForm,
  buildDocument,
  draftPayload,
  loadErrorMessage,
}: UseCustomerSendWorkflowOptions<TForm>) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CustomerSendPageData | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [version, setVersion] = useState<CustomerSendVersionState | null>(null)
  const [form, setForm] = useState<TForm | null>(null)
  const mountedRef = useRef(true)

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
          customerSendUrl(estimateId, catalogSource, routeFamily)
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
      setForm(buildForm(payload, payload.draft ?? {}, !options?.hard))
      setLoading(false)
      return true
    },
    [buildForm, catalogSource, estimateId, loadErrorMessage, routeFamily]
  )

  useEffect(() => {
    mountedRef.current = true
    void reload()
    return () => {
      mountedRef.current = false
    }
  }, [reload])

  const labels = useMemo(() => deriveCustomerSendLabels(data), [data])

  const liveDocument = useMemo(() => {
    if (!data || !form) return null
    return buildDocument(data, form, version)
  }, [buildDocument, data, form, version])

  const currentTemplate = useMemo(() => {
    return templatePresets.find((preset) => preset.key === form?.template_key) ?? templatePresets[0]
  }, [form?.template_key])

  const isLive = asText(version?.status) !== 'draft'
  const hasLiveLink = Boolean(publicUrl)

  const persistDraft = useCallback(async () => {
    if (!form) return false
    setBusy(true)
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
      return false
    }

    setMessage('Draft saved.')
    setPublicUrl((payload.public_url as string | null) ?? publicUrl)
    if (payload.version) {
      setVersion(normalizeCustomerSendVersion(payload.version))
    }
    setBusy(false)
    return true
  }, [catalogSource, draftPayload, estimateId, form, publicUrl, routeFamily])

  const submit = useCallback(
    async (mode: 'test' | 'send') => {
      if (!form) return false
      if (mode === 'test' && !form.to_email.trim()) {
        setError('To email is required for a test send.')
        return false
      }

      setBusy(true)
      setError(null)
      setMessage(null)

      let payload: CustomerSendMutationResponse
      try {
        payload = await submitCustomerSend<CustomerSendMutationResponse>(
          customerSendUrl(estimateId, catalogSource, routeFamily),
          {
            mode,
            draft: draftPayload(form),
          }
        )
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : `Unable to send ${labels.documentLower}`
        )
        setBusy(false)
        return false
      }

      setMessage(mode === 'test' ? 'Test message sent.' : `${labels.document} sent.`)
      setPublicUrl((payload.public_url as string | null) ?? publicUrl)
      if (payload.version) {
        setVersion(
          normalizeCustomerSendVersion(payload.version, mode === 'send' ? 'sent' : 'draft')
        )
      }
      setBusy(false)
      return true
    },
    [
      catalogSource,
      draftPayload,
      estimateId,
      form,
      labels.document,
      labels.documentLower,
      publicUrl,
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
    currentTemplate,
    isLive,
    hasLiveLink,
  }
}
