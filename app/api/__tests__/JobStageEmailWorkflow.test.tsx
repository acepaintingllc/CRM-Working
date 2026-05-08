import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSupabaseAdmin,
  mockSendGmailMessage,
  mockDownloadDriveFile,
  mockApplyJobStageSideEffect,
  mockAssertSchema,
  mockResolveJobEstimateFiles,
} = vi.hoisted(() => ({
  mockSupabaseAdmin: { from: vi.fn() },
  mockSendGmailMessage: vi.fn(),
  mockDownloadDriveFile: vi.fn(),
  mockApplyJobStageSideEffect: vi.fn(),
  mockAssertSchema: vi.fn(),
  mockResolveJobEstimateFiles: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({ supabaseAdmin: mockSupabaseAdmin }))
vi.mock('@/lib/server/googleMail', () => ({ sendGmailMessage: mockSendGmailMessage }))
vi.mock('@/lib/server/googleDrive', () => ({ downloadDriveFile: mockDownloadDriveFile }))
vi.mock('@/lib/jobs/estimateFiles', () => ({ resolveJobEstimateFiles: mockResolveJobEstimateFiles }))
vi.mock('@/lib/server/jobScheduleSync', () => ({
  applyJobStageSideEffect: mockApplyJobStageSideEffect,
}))
vi.mock('@/lib/server/schema', () => ({
  assertSchema: mockAssertSchema,
  isMissingSchemaErrorMessage: (message: string) => message.includes('missing'),
}))
vi.mock('@/lib/server/jobSchema', () => ({
  buildJobSelect: (columns: string[]) => columns.join(', '),
  getAvailableOptionalJobColumns: vi.fn(async () => new Set<string>()),
  withOptionalJobColumns: (row: Record<string, unknown> | null) => row,
}))

import {
  normalizeSendJobStageEmailInput,
  sendJobStageEmail,
  type SendJobStageEmailInput,
} from '@/lib/server/jobStageEmailWorkflow'
import {
  applyTemplate,
  buildEstimateFileTemplateVars,
  buildJobEmailTemplateVars,
  formatJobTemplateDate,
} from '@/lib/jobs/emailTemplate'
import type { StageEmailStage } from '@/lib/jobs/types'

type TableName = 'orgs' | 'jobs' | 'customers' | 'email_templates' | 'job_schedules' | 'email_log'

const state = {
  orgs: [] as Array<Record<string, unknown>>,
  jobs: [] as Array<Record<string, unknown>>,
  customers: [] as Array<Record<string, unknown>>,
  templates: [] as Array<Record<string, unknown>>,
  schedules: [] as Array<Record<string, unknown>>,
  emailLog: [] as Array<Record<string, unknown>>,
  insertedLogs: [] as Array<Record<string, unknown>>,
  updatedLogs: [] as Array<{ filters: Record<string, unknown>; payload: Record<string, unknown> }>,
}

function tableRows(table: TableName) {
  switch (table) {
    case 'orgs':
      return state.orgs
    case 'jobs':
      return state.jobs
    case 'customers':
      return state.customers
    case 'email_templates':
      return state.templates
    case 'job_schedules':
      return state.schedules
    case 'email_log':
      return state.emailLog
  }
}

class QueryBuilder {
  private filters = new Map<string, unknown>()
  private inFilters = new Map<string, unknown[]>()
  private gteFilters = new Map<string, string>()
  private payload: Record<string, unknown> | null = null
  private countHead = false
  private operation: 'select' | 'insert' | 'update' | null = null

  constructor(private table: TableName) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (!this.operation) {
      this.operation = 'select'
    }
    this.countHead = Boolean(options?.head && options?.count)
    return this
  }

  insert(payload: Record<string, unknown>) {
    this.operation = 'insert'
    this.payload = payload
    return this
  }

  update(payload: Record<string, unknown>) {
    this.operation = 'update'
    this.payload = payload
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value)
    return this
  }

  gte(column: string, value: string) {
    this.gteFilters.set(column, value)
    return this
  }

  in(column: string, value: unknown[]) {
    this.inFilters.set(column, value)
    return this
  }

  order() {
    return this
  }

  async maybeSingle() {
    if (this.operation === 'insert') {
      return this.insertResult(false)
    }
    return { data: this.rows()[0] ?? null, error: null }
  }

  async single() {
    if (this.operation === 'insert') {
      return this.insertResult(true)
    }
    return { data: this.rows()[0] ?? null, error: null }
  }

  then(resolve: (value: { data?: unknown[]; error: null; count?: number }) => void) {
    if (this.operation === 'update' && this.table === 'email_log') {
      state.updatedLogs.push({
        filters: Object.fromEntries(this.filters),
        payload: this.payload ?? {},
      })
      resolve({ error: null })
      return
    }
    if (this.countHead) {
      resolve({ error: null, count: this.rows().length })
      return
    }
    resolve({ data: this.rows(), error: null })
  }

  private insertResult(includeSelectedRow: boolean) {
    if (this.table === 'email_log') {
      const idempotencyKey = this.payload?.idempotency_key
      if (
        idempotencyKey &&
        state.emailLog.some((row) => row.org_id === this.payload?.org_id && row.idempotency_key === idempotencyKey)
      ) {
        return {
          data: null,
          error: { code: '23505', message: 'duplicate key value violates idempotency constraint' },
        }
      }
      const row = {
        id: `log-${state.emailLog.length + 1}`,
        gmail_message_id: null,
        error_message: null,
        ...this.payload,
      }
      state.emailLog.push(row)
      state.insertedLogs.push(row)
      return { data: includeSelectedRow ? row : { id: row.id }, error: null }
    }
    return { data: this.payload, error: null }
  }

  private rows() {
    return tableRows(this.table).filter((row) => {
      for (const [column, value] of this.filters.entries()) {
        if (row[column] !== value) return false
      }
      for (const [column, values] of this.inFilters.entries()) {
        if (!values.includes(row[column])) return false
      }
      for (const [column, value] of this.gteFilters.entries()) {
        if (typeof row[column] === 'string' && (row[column] as string) < value) return false
      }
      return true
    })
  }
}

function baseInput(overrides: Partial<SendJobStageEmailInput> = {}) {
  const input = normalizeSendJobStageEmailInput({
    stage: 'scheduled',
    idempotency_key: 'key-1',
  })
  if (!input.ok) throw new Error(input.message)
  return { ...input.data, ...overrides }
}

function scheduleBlocksPreview() {
  return state.schedules
    .map((row) => `${formatJobTemplateDate(row.start_at as string)} - ${formatJobTemplateDate(row.end_at as string)}`)
    .join('\n')
}

function renderClientPreview(args: {
  stage: StageEmailStage
  selectedEstimateFileIds?: readonly string[]
}) {
  const job = state.jobs[0]
  const customer = state.customers[0]
  const template = state.templates.find((row) => row.stage === args.stage)
  const estimateFiles = [
    { id: 'file-1', name: 'Quote.pdf', webViewLink: 'https://drive/file-1' },
  ]
  const vars = buildJobEmailTemplateVars(
    {
      customerName: customer.name as string,
      customerEmail: customer.email as string,
      customerPhone: customer.phone as string | null,
      customerAddress: customer.address as string,
      jobTitle: job.title as string,
      estimateDate: formatJobTemplateDate(job.estimate_date as string | null),
      scheduledDate: formatJobTemplateDate(job.scheduled_date as string | null),
      scheduledBlocks: scheduleBlocksPreview(),
      ...buildEstimateFileTemplateVars({
        estimateFiles,
        selectedEstimateFileIds: [...(args.selectedEstimateFileIds ?? [])],
      }),
    },
    {
      reviewLink: process.env.NEXT_PUBLIC_REVIEW_LINK,
    }
  )

  return {
    subject: applyTemplate((template?.subject as string | null) ?? '', vars),
    body: applyTemplate((template?.body as string | null) ?? '', vars),
  }
}

describe('job stage email workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.REVIEW_LINK = 'https://reviews.example.com/ace'
    process.env.NEXT_PUBLIC_REVIEW_LINK = 'https://reviews.example.com/ace'
    state.orgs = [{ id: 'org-1', business_email: 'office@example.com' }]
    state.jobs = [
      {
        id: 'job-1',
        org_id: 'org-1',
        customer_id: 'customer-1',
        title: 'Kitchen',
        status: 'estimate_sent',
        completed_at: null,
        estimate_date: '2026-05-01T10:00:00Z',
        scheduled_date: '2026-05-02T10:00:00Z',
        scheduled_end_date: '2026-05-02T12:00:00Z',
      },
    ]
    state.customers = [
      {
        id: 'customer-1',
        org_id: 'org-1',
        name: 'Alice',
        email: 'alice@example.com',
        phone: null,
        address: '123 Main St',
      },
    ]
    state.templates = [
      { org_id: 'org-1', stage: 'scheduled', subject: 'Scheduled {{jobTitle}}', body: 'Body' },
      { org_id: 'org-1', stage: 'estimate_sent', subject: 'Quote', body: 'See {{estimateFileName}}' },
      { org_id: 'org-1', stage: 'follow_up', subject: 'Follow up', body: 'See {{estimateFileName}}' },
      { org_id: 'org-1', stage: 'completed', subject: 'Review', body: 'Review {{reviewLink}}' },
    ]
    state.schedules = [
      {
        org_id: 'org-1',
        job_id: 'job-1',
        start_at: '2026-05-02T10:00:00Z',
        end_at: '2026-05-02T12:00:00Z',
      },
    ]
    state.emailLog = []
    state.insertedLogs = []
    state.updatedLogs = []

    mockSupabaseAdmin.from.mockImplementation((table: TableName) => new QueryBuilder(table))
    mockAssertSchema.mockResolvedValue({ ok: true })
    mockSendGmailMessage.mockResolvedValue({ messageId: 'gmail-1' })
    mockApplyJobStageSideEffect.mockResolvedValue({
      error: null,
      job: { id: 'job-1', status: 'scheduled', scheduled_email_sent_at: 'sent-at' },
      range: null,
    })
    mockResolveJobEstimateFiles.mockResolvedValue({
      ok: true,
      data: {
        latest: { id: 'file-1', name: 'Quote.pdf', webViewLink: 'https://drive/file-1' },
        files: [{ id: 'file-1', name: 'Quote.pdf', webViewLink: 'https://drive/file-1' }],
      },
    })
    mockDownloadDriveFile.mockResolvedValue({ buffer: Buffer.from('pdf') })
  })

  it('replays an existing idempotency key without sending another Gmail message', async () => {
    state.emailLog = [
      {
        id: 'log-existing',
        org_id: 'org-1',
        job_id: 'job-1',
        stage: 'scheduled',
        idempotency_key: 'key-1',
        status: 'sent',
        error_message: null,
        gmail_message_id: 'gmail-existing',
      },
    ]

    const result = await sendJobStageEmail({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      input: baseInput(),
    })

    expect(result).toMatchObject({
      ok: true,
      data: { status: 'replayed', replayed: true, result_status: 'sent' },
    })
    expect(mockSendGmailMessage).not.toHaveBeenCalled()
  })

  it('logs blocked prerequisite failures before returning the error', async () => {
    state.schedules = []

    const result = await sendJobStageEmail({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      input: baseInput(),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Add at least one scheduled block before sending the scheduled email.',
      status: 400,
    })
    expect(state.insertedLogs[0]).toMatchObject({
      org_id: 'org-1',
      job_id: 'job-1',
      stage: 'scheduled',
      status: 'blocked',
      error_message: 'Add at least one scheduled block before sending the scheduled email.',
      created_by: 'user-1',
    })
  })

  it('does not treat malformed persisted schedule blocks as valid scheduled email content', async () => {
    state.schedules = [
      {
        org_id: 'org-1',
        job_id: 'job-1',
        start_at: '   ',
        end_at: 'not a date',
      },
    ]

    const result = await sendJobStageEmail({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      input: baseInput({
        idempotencyKey: 'key-malformed-schedule',
      }),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'invalid_input',
      message: 'Add at least one scheduled block before sending the scheduled email.',
      status: 400,
    })
    expect(mockSendGmailMessage).not.toHaveBeenCalled()
    expect(state.insertedLogs.at(-1)).toMatchObject({
      stage: 'scheduled',
      status: 'blocked',
      error_message: 'Add at least one scheduled block before sending the scheduled email.',
    })
  })

  it('blocks stale selected quote attachments', async () => {
    mockResolveJobEstimateFiles.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'One or more selected quote attachments are no longer available.',
    })

    const result = await sendJobStageEmail({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      input: baseInput({
        stage: 'estimate_sent',
        idempotencyKey: 'key-2',
        estimateFileIds: ['missing-file'],
      }),
    })

    expect(result).toMatchObject({
      ok: false,
      message: 'One or more selected quote attachments are no longer available.',
      status: 400,
    })
    expect(mockDownloadDriveFile).not.toHaveBeenCalled()
    expect(state.insertedLogs[0]).toMatchObject({
      stage: 'estimate_sent',
      status: 'blocked',
      error_message: 'One or more selected quote attachments are no longer available.',
    })
  })

  it('sends Gmail, persists the sent log, and applies stage side effects', async () => {
    const result = await sendJobStageEmail({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      input: baseInput(),
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        status: 'sent',
        replayed: false,
        notice: 'Scheduled email sent.',
        job: { id: 'job-1', status: 'scheduled' },
      },
    })
    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'http://localhost',
        orgId: 'org-1',
        userId: 'user-1',
        to: 'alice@example.com',
        subject: 'Scheduled Kitchen',
      })
    )
    expect(state.updatedLogs[0]).toMatchObject({
      filters: { org_id: 'org-1', id: 'log-1' },
      payload: { status: 'sent', gmail_message_id: 'gmail-1', error_message: null },
    })
    expect(mockApplyJobStageSideEffect).toHaveBeenCalledWith('org-1', 'job-1', {
      stage: 'scheduled',
      sentAt: expect.any(String),
    })
  })

  it('uses the canonical estimate-file resolver instead of duplicated address matching', async () => {
    await sendJobStageEmail({
      orgId: 'org-1',
      userId: 'user-1',
      origin: 'http://localhost',
      jobId: 'job-1',
      input: baseInput({
        stage: 'estimate_sent',
        idempotencyKey: 'key-estimate',
        estimateFileIds: ['file-1'],
      }),
    })

    expect(mockResolveJobEstimateFiles).toHaveBeenCalledWith({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      jobId: 'job-1',
      estimateFileIds: ['file-1'],
    })
  })

  it.each([
    ['scheduled', undefined],
    ['estimate_sent', ['file-1']],
    ['follow_up', ['file-1']],
    ['completed', undefined],
  ] as const)(
    'renders the same subject and body for client preview and server send vars for %s',
    async (stage, selectedEstimateFileIds) => {
      state.templates = state.templates.map((template) =>
        template.stage === stage
          ? {
              ...template,
              subject:
                '{{customerName}}/{{customer_name}} {{jobTitle}}/{{job_title}} {{scheduledDate}}/{{scheduled_date}} {{estimateFileName}}/{{estimate_file_name}} {{reviewLink}}/{{review_link}}',
              body:
                '{{customerEmail}}/{{customer_email}}\n{{customerPhone}}/{{customer_phone}}\n{{customerAddress}}/{{customer_address}}\n{{estimateDate}}/{{estimate_date}}\n{{scheduledBlocks}}/{{scheduled_blocks}}\n{{estimateFileLink}}/{{estimate_file_link}}\n{{estimateFileNames}}/{{estimate_file_names}}\n{{estimateFileLinks}}/{{estimate_file_links}}',
            }
          : template
      )
      if (stage === 'completed') {
        state.jobs[0] = {
          ...state.jobs[0],
          status: 'completed',
          completed_at: '2026-05-03T18:00:00Z',
        }
      }

      const expected = renderClientPreview({
        stage,
        selectedEstimateFileIds,
      })
      const result = await sendJobStageEmail({
        orgId: 'org-1',
        userId: 'user-1',
        origin: 'http://localhost',
        jobId: 'job-1',
        input: baseInput({
          stage,
          idempotencyKey: `key-${stage}`,
          estimateFileIds: selectedEstimateFileIds ? [...selectedEstimateFileIds] : [],
        }),
      })

      expect(result).toMatchObject({ ok: true, data: { status: 'sent' } })
      expect(mockSendGmailMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expected.subject,
          bodyText: expected.body,
        })
      )
      expect(state.insertedLogs.at(-1)).toMatchObject({
        stage,
        subject: expected.subject,
        body: expected.body,
      })
    }
  )
})
