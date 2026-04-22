'use client'

import { loadData, requestApi } from '@/lib/client/api'
import type { EmailTemplateRecord } from './types'

export async function loadEmailTemplates() {
  return loadData<EmailTemplateRecord[]>('/api/email-templates', { cache: 'no-store' })
}

export async function saveEmailTemplate(input: EmailTemplateRecord) {
  return requestApi<{ data: EmailTemplateRecord; notice?: string | null }>('/api/email-templates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
