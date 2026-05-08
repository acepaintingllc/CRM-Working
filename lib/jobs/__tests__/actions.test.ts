import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

type ClientCall =
  | { helper: 'loadJobRecord'; jobId: string }
  | { helper: 'loadStageEmailSchedules'; jobId: string }
  | { helper: 'loadMatchingJobEstimateFiles'; jobId: string }
  | { helper: 'sendJobStageEmail'; jobId: string; payload: Record<string, unknown> }
  | { helper: 'saveCloseoutPaintLogs'; jobId: string; payload: Record<string, unknown> }
  | { helper: 'patchJobCloseoutNotes'; jobId: string; closeoutNotes: string | null }
  | { helper: 'listPaintLogs'; jobId: string }
  | { helper: 'loadLatestJobEstimateFile'; jobId: string }

type JobsActionsModule = {
  fetchStageEmailComposerData: (jobId: string, stage: string) => Promise<unknown>
  sendStageEmail: (
    jobId: string,
    payload: {
      stage: string
      subject: string
      body: string
      estimateFileIds?: string[]
      idempotencyKey?: string
    }
  ) => Promise<unknown>
  fetchCloseoutData: (jobId: string) => Promise<unknown>
  saveCloseout: (
    jobId: string,
    payload: {
      rows: Array<Record<string, unknown>>
      closeout_notes: string | null
    }
  ) => Promise<unknown>
}

function loadJobsActions(options?: {
  templates?: Array<{ stage: string; subject: string | null; body: string | null }>
  estimateFileState?: {
    latestEstimateFile: Record<string, unknown> | null
    estimateFiles: Array<Record<string, unknown>>
    estimateFileError: string | null
  }
}) {
  const calls: ClientCall[] = []
  const actionsSource = readFileSync(new URL('../actions.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(actionsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const exports: Partial<JobsActionsModule> = {}

  const clientModule = {
    loadJobRecord: async (jobId: string) => {
      calls.push({ helper: 'loadJobRecord', jobId })
      return {
        id: jobId,
        title: 'Kitchen repaint',
        customer_email: 'customer@example.com',
        customer_name: 'Jordan Customer',
        customer_phone: '812-555-0100',
        customer_address: '123 Main St',
        scheduled_date: '2026-05-01T14:00:00.000Z',
        scheduled_end_date: '2026-05-01T18:00:00.000Z',
        closeout_notes: 'Existing closeout note',
      }
    },
    loadStageEmailSchedules: async (jobId: string) => {
      calls.push({ helper: 'loadStageEmailSchedules', jobId })
      return [
        {
          start_at: '2026-05-01T14:00:00.000Z',
          end_at: '2026-05-01T18:00:00.000Z',
        },
      ]
    },
    loadMatchingJobEstimateFiles: async (jobId: string) => {
      calls.push({ helper: 'loadMatchingJobEstimateFiles', jobId })
      return options?.estimateFileState ?? {
        latestEstimateFile: { id: 'drive-2', name: 'Estimate-v2.pdf' },
        estimateFiles: [
          { id: 'drive-2', name: 'Estimate-v2.pdf' },
          { id: 'drive-1', name: 'Estimate-v1.pdf' },
        ],
        estimateFileError: null,
      }
    },
    sendJobStageEmail: async (
      jobId: string,
      payload: {
        stage: string
        subject: string
        body: string
        estimateFileIds?: string[]
        idempotencyKey?: string
      }
    ) => {
      calls.push({ helper: 'sendJobStageEmail', jobId, payload })
      return {
        status: 'replayed',
        replayed: true,
        job: { completed_email_sent_at: '2026-05-02T10:00:00.000Z' },
        notice: 'This send request was already processed. No duplicate email was sent.',
        warning: null,
      }
    },
    listPaintLogs: async (jobId: string) => {
      calls.push({ helper: 'listPaintLogs', jobId })
      return [{ where_used: 'Trim', paint_product: 'Emerald', sheen: 'Satin', color: 'Extra White', notes: '' }]
    },
    loadLatestJobEstimateFile: async (jobId: string) => {
      calls.push({ helper: 'loadLatestJobEstimateFile', jobId })
      return { estimateFile: null, estimateFileError: null }
    },
    saveCloseoutPaintLogs: async (jobId: string, payload: { rows: Array<Record<string, unknown>> }) => {
      calls.push({ helper: 'saveCloseoutPaintLogs', jobId, payload })
      return payload.rows
    },
    patchJobCloseoutNotes: async (jobId: string, closeoutNotes: string | null) => {
      calls.push({ helper: 'patchJobCloseoutNotes', jobId, closeoutNotes })
      return { closeout_notes: closeoutNotes }
    },
  }

  vm.runInNewContext(compiled, {
    exports,
    require: (specifier: string) => {
      if (specifier === '@/lib/emailTemplates/api') {
        return {
          loadEmailTemplates: async () =>
            options?.templates ?? [
              { stage: 'scheduled', subject: 'Scheduled', body: 'See you soon.' },
              { stage: 'completed', subject: 'Review request', body: 'Please review us.' },
            ],
        }
      }
      if (specifier === '@/lib/jobs/client') return clientModule
      throw new Error(`Unexpected import in jobs actions test: ${specifier}`)
    },
    URLSearchParams,
    JSON,
    Date,
  })

  return { actions: exports as JobsActionsModule, calls }
}

function assertJsonLike(actual: unknown, expected: unknown) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected)
}

test('jobs actions do not own raw jobs transport strings or direct API helper calls', () => {
  const actionsSource = readFileSync(new URL('../actions.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(actionsSource, /\/api\/jobs\//)
  assert.doesNotMatch(actionsSource, /from ['"]@\/lib\/client\/api['"]/)
  for (const helper of ['loadData', 'mutateData', 'requestApi']) {
    assert.doesNotMatch(actionsSource, new RegExp(`\\b${helper}\\(`))
  }
})

test('stage email composer data loads schedules and estimate files through jobs client helpers', async () => {
  const { actions, calls } = loadJobsActions()

  const result = await actions.fetchStageEmailComposerData('job-1', 'scheduled')

  assertJsonLike(result, {
    job: {
      id: 'job-1',
      title: 'Kitchen repaint',
      customer_email: 'customer@example.com',
      customer_name: 'Jordan Customer',
      customer_phone: '812-555-0100',
      customer_address: '123 Main St',
      scheduled_date: '2026-05-01T14:00:00.000Z',
      scheduled_end_date: '2026-05-01T18:00:00.000Z',
      closeout_notes: 'Existing closeout note',
    },
    template: { stage: 'scheduled', subject: 'Scheduled', body: 'See you soon.' },
    scheduledBlocks: new Date('2026-05-01T14:00:00.000Z').toLocaleString() + ' - ' + new Date('2026-05-01T18:00:00.000Z').toLocaleString(),
    estimateFiles: [],
    selectedEstimateFileIds: [],
    blockingIssues: [],
  })
  assert.deepEqual(
    calls.map((call) => call.helper),
    ['loadJobRecord', 'loadStageEmailSchedules']
  )
})

test('stage email composer uses quote-file wording for missing quote attachments', async () => {
  const { actions } = loadJobsActions({
    templates: [{ stage: 'estimate_sent', subject: 'Estimate sent', body: 'Attached.' }],
    estimateFileState: {
      latestEstimateFile: null,
      estimateFiles: [],
      estimateFileError: 'No matching quote file found in Drive folder.',
    },
  })

  const result = await actions.fetchStageEmailComposerData('job-1', 'estimate_sent')

  assertJsonLike(result, {
    job: {
      id: 'job-1',
      title: 'Kitchen repaint',
      customer_email: 'customer@example.com',
      customer_name: 'Jordan Customer',
      customer_phone: '812-555-0100',
      customer_address: '123 Main St',
      scheduled_date: '2026-05-01T14:00:00.000Z',
      scheduled_end_date: '2026-05-01T18:00:00.000Z',
      closeout_notes: 'Existing closeout note',
    },
    template: { stage: 'estimate_sent', subject: 'Estimate sent', body: 'Attached.' },
    scheduledBlocks: new Date('2026-05-01T14:00:00.000Z').toLocaleString() + ' - ' + new Date('2026-05-01T18:00:00.000Z').toLocaleString(),
    estimateFiles: [],
    selectedEstimateFileIds: [],
    blockingIssues: [
      'No matching quote file found in Drive folder.',
    ],
  })
})

test('stage email send keeps current replay warning behavior while delegating transport to jobs client', async () => {
  const { actions, calls } = loadJobsActions()

  const result = await actions.sendStageEmail('job-1', {
    stage: 'completed',
    subject: 'Review request',
    body: 'Please review us.',
  })

  assertJsonLike(result, {
    stage: 'completed',
    status: 'replayed',
    replayed: true,
    job: { completed_email_sent_at: '2026-05-02T10:00:00.000Z' },
    notice: 'This send request was already processed. No duplicate email was sent.',
    warning: null,
  })
  assert.deepEqual(calls, [
    {
      helper: 'sendJobStageEmail',
      jobId: 'job-1',
      payload: {
        stage: 'completed',
        subject: 'Review request',
        body: 'Please review us.',
      },
    },
  ])
})

test('stage email composer and send path share latest-file selection semantics', async () => {
  const { actions } = loadJobsActions({
    templates: [{ stage: 'estimate_sent', subject: 'Estimate sent', body: 'Attached.' }],
    estimateFileState: {
      latestEstimateFile: { id: 'drive-2', name: 'Estimate-v2.pdf' },
      estimateFiles: [
        { id: 'drive-2', name: 'Estimate-v2.pdf' },
        { id: 'drive-1', name: 'Estimate-v1.pdf' },
      ],
      estimateFileError: null,
    },
  })

  const composer = await actions.fetchStageEmailComposerData('job-1', 'estimate_sent')

  assertJsonLike(composer, {
    job: {
      id: 'job-1',
      title: 'Kitchen repaint',
      customer_email: 'customer@example.com',
      customer_name: 'Jordan Customer',
      customer_phone: '812-555-0100',
      customer_address: '123 Main St',
      scheduled_date: '2026-05-01T14:00:00.000Z',
      scheduled_end_date: '2026-05-01T18:00:00.000Z',
      closeout_notes: 'Existing closeout note',
    },
    template: { stage: 'estimate_sent', subject: 'Estimate sent', body: 'Attached.' },
    scheduledBlocks: new Date('2026-05-01T14:00:00.000Z').toLocaleString() + ' - ' + new Date('2026-05-01T18:00:00.000Z').toLocaleString(),
    estimateFiles: [
      { id: 'drive-2', name: 'Estimate-v2.pdf' },
      { id: 'drive-1', name: 'Estimate-v1.pdf' },
    ],
    selectedEstimateFileIds: ['drive-2'],
    blockingIssues: [],
  })
})

test('closeout flows still aggregate template, paint logs, and save orchestration through jobs client helpers', async () => {
  const { actions, calls } = loadJobsActions()

  const closeoutData = await actions.fetchCloseoutData('job-1')
  const saved = await actions.saveCloseout('job-1', {
    rows: [
      {
        where_used: 'Walls',
        paint_product: 'Duration',
        sheen: 'Eggshell',
        color: 'SW 7008',
        notes: 'Accent wall',
      },
    ],
    closeout_notes: 'Left extra paint in garage.',
  })

  assertJsonLike(closeoutData, {
    job: {
      id: 'job-1',
      title: 'Kitchen repaint',
      customer_email: 'customer@example.com',
      customer_name: 'Jordan Customer',
      customer_phone: '812-555-0100',
      customer_address: '123 Main St',
      scheduled_date: '2026-05-01T14:00:00.000Z',
      scheduled_end_date: '2026-05-01T18:00:00.000Z',
      closeout_notes: 'Existing closeout note',
    },
    template: { stage: 'completed', subject: 'Review request', body: 'Please review us.' },
    paintLogs: [
      {
        where_used: 'Trim',
        paint_product: 'Emerald',
        sheen: 'Satin',
        color: 'Extra White',
        notes: '',
      },
    ],
  })
  assertJsonLike(saved, {
    job: { closeout_notes: 'Left extra paint in garage.' },
    paintLogs: [
      {
        where_used: 'Walls',
        paint_product: 'Duration',
        sheen: 'Eggshell',
        color: 'SW 7008',
        notes: 'Accent wall',
      },
    ],
  })
  assert.deepEqual(
    calls.map((call) => call.helper),
    [
      'loadJobRecord',
      'listPaintLogs',
      'saveCloseoutPaintLogs',
      'patchJobCloseoutNotes',
    ]
  )
})
