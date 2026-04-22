import { supabaseAdmin } from '@/lib/server/org'
import {
  emailTemplateError,
  emailTemplateOk,
  type EmailTemplateRecord,
  type EmailTemplateServiceResult,
  type SaveEmailTemplateInput,
} from './types'

function mapEmailTemplateRow(row: {
  stage?: string | null
  subject?: string | null
  body?: string | null
}): EmailTemplateRecord {
  return {
    stage: row.stage ?? '',
    subject: row.subject ?? '',
    body: row.body ?? '',
  }
}

function isMissingStageColumn(message: string) {
  return message.includes("Could not find the 'stage' column of 'email_templates'")
}

function getMissingTableMessage() {
  return 'Email templates table is missing. Run supabase/sql/004_email_templates.sql and reload the schema cache.'
}

export async function listEmailTemplates(
  orgId: string
): Promise<EmailTemplateServiceResult<EmailTemplateRecord[]>> {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('stage, subject, body')
    .eq('org_id', orgId)

  if (error) {
    const message = error.message ?? ''
    return emailTemplateError(
      'server_error',
      isMissingStageColumn(message) ? getMissingTableMessage() : message
    )
  }

  return emailTemplateOk(((data ?? []) as EmailTemplateRecord[]).map(mapEmailTemplateRow))
}

export function normalizeSaveEmailTemplateInput(
  body: Record<string, unknown>
): EmailTemplateServiceResult<SaveEmailTemplateInput> {
  const stage = typeof body.stage === 'string' ? body.stage.trim() : ''
  if (!stage) {
    return emailTemplateError('invalid_input', 'Missing stage')
  }

  return emailTemplateOk({
    stage,
    subject: typeof body.subject === 'string' ? body.subject : String(body.subject ?? ''),
    body: typeof body.body === 'string' ? body.body : String(body.body ?? ''),
  })
}

export async function saveEmailTemplate(
  orgId: string,
  input: SaveEmailTemplateInput
): Promise<EmailTemplateServiceResult<EmailTemplateRecord>> {
  const { error } = await supabaseAdmin.from('email_templates').upsert(
    {
      org_id: orgId,
      stage: input.stage,
      name: input.stage,
      subject: input.subject,
      body: input.body,
    },
    { onConflict: 'org_id,stage' }
  )

  if (error) {
    const message = error.message ?? ''
    return emailTemplateError(
      'server_error',
      isMissingStageColumn(message) ? getMissingTableMessage() : message
    )
  }

  return emailTemplateOk(input)
}
