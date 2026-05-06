import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

type ApiCall = {
  helper: 'loadData' | 'mutateData' | 'requestApi' | 'requestRawApi'
  path: string
  init?: RequestInit
}

type RequestRawApiMockResult = {
  response: { ok: boolean }
  payload: unknown
  errorMessage: string | null
}

type JobsClientModule = {
  resolveJobCloseoutCatalogEstimateId: (job: {
    accepted_estimate?: { estimate_id?: string | null } | null
    linked_estimate_id?: string | null
  } | null) => string | null
  loadJobEstimateFile: (jobId: string) => Promise<unknown>
  loadLatestJobEstimateFile: (jobId: string) => Promise<unknown>
  loadMatchingJobEstimateFiles: (jobId: string) => Promise<unknown>
  normalizeLatestJobEstimateFile: (data: unknown) => unknown
  normalizeMatchingJobEstimateFiles: (data: unknown) => unknown
  loadJobActuals: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  saveDraftJobActuals: (jobId: string, payload: Record<string, unknown>) => Promise<unknown>
  submitJobActuals: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  lockJobActuals: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  loadJobReview: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  saveJobReview: (jobId: string, payload: Record<string, unknown>) => Promise<unknown>
  lockJobReview: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  repairAcceptedEstimateSnapshot: (jobId: string) => Promise<unknown>
  loadStageEmailSchedules: (jobId: string) => Promise<unknown>
  sendJobStageEmail: (
    jobId: string,
    payload: {
      stage: string
      subject: string
      body: string
      estimateFileIds?: string[]
      idempotencyKey?: string
    }
  ) => Promise<unknown>
  saveCloseoutPaintLogs: (
    jobId: string,
    payload: { rows: Array<Record<string, unknown>> }
  ) => Promise<unknown>
  patchJobCloseoutNotes: (jobId: string, closeoutNotes: string | null) => Promise<unknown>
}

type JobsRoutesModule = {
  buildJobEstimateFilePath: (
    jobId: string,
    options?: { all?: boolean; redirect?: boolean }
  ) => string
}

function loadJobsClientWithApiMocks(options?: {
  requestRawApiResult?: RequestRawApiMockResult
}) {
  const calls: ApiCall[] = []
  const clientSource = readFileSync(new URL('../client.ts', import.meta.url), 'utf8')
  const jobsRoutesSource = readFileSync(new URL('../routes.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(clientSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const compiledRoutes = ts.transpileModule(jobsRoutesSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const exports: Partial<JobsClientModule> = {}
  const routeExports: Partial<JobsRoutesModule> = {}
  const apiClient = {
    loadData: async (path: string, init?: RequestInit) => {
      calls.push({ helper: 'loadData', path, init })
      if (path.endsWith('/schedules')) {
        return [{ start_at: null, end_at: null, notes: null }]
      }
      return { loaded: true }
    },
    mutateData: async (path: string, init?: RequestInit) => {
      calls.push({ helper: 'mutateData', path, init })
      if (path.endsWith('/paint-logs')) {
        return { data: [{ saved: true }], notice: 'Saved.' }
      }
      if (path.endsWith('/send-stage')) {
        return {
          data: { status: 'sent', replayed: false, job: { mutated: true }, warning: null },
          notice: 'Scheduled email sent.',
        }
      }
      return { data: { mutated: true }, notice: 'Saved.' }
    },
    requestApi: async (path: string, init?: RequestInit) => {
      calls.push({ helper: 'requestApi', path, init })
      return { data: { requested: true }, notice: 'Done.' }
    },
    requestRawApi: async (path: string, init?: RequestInit) => {
      calls.push({ helper: 'requestRawApi', path, init })
      return options?.requestRawApiResult ?? {
        response: { ok: true },
        payload: { id: 'drive-1', name: 'Estimate.pdf' },
        errorMessage: null,
      }
    },
  }

  vm.runInNewContext(compiledRoutes, {
    exports: routeExports,
    URLSearchParams,
  })

  vm.runInNewContext(compiled, {
    exports,
    require: (specifier: string) => {
      if (specifier === '@/lib/client/api') return apiClient
      if (specifier === '@/lib/jobs/routes') return routeExports
      if (specifier === '@/lib/jobs/paintLog') return { mapPaintLogRow: (row: unknown) => row }
      if (specifier === '@/lib/jobs/idempotency') {
        return { makeIdempotencyKey: (stage: string, jobId: string) => `${stage}:${jobId}` }
      }
      throw new Error(`Unexpected import in jobs client test: ${specifier}`)
    },
    URLSearchParams,
    FormData,
    JSON,
  })

  return { client: exports as JobsClientModule, calls }
}

function assertJsonBody(init: RequestInit | undefined, expected: unknown) {
  assert.equal(init?.body, JSON.stringify(expected))
}

function assertJsonLike(actual: unknown, expected: unknown) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected)
}

test('jobs client owns direct job actuals, review, and snapshot repair helpers', () => {
  const jobsClient = readFileSync(new URL('../client.ts', import.meta.url), 'utf8')
  const estimateFeedbackClient = readFileSync(
    new URL('../../estimate-feedback/client.ts', import.meta.url),
    'utf8'
  )

  for (const exportedName of [
    'loadJobActuals',
    'saveDraftJobActuals',
    'submitJobActuals',
    'lockJobActuals',
    'loadJobReview',
    'saveJobReview',
    'lockJobReview',
    'repairAcceptedEstimateSnapshot',
  ]) {
    assert.match(jobsClient, new RegExp(`export async function ${exportedName}\\b`))
    assert.doesNotMatch(estimateFeedbackClient, new RegExp(`export async function ${exportedName}\\b`))
  }
})

test('estimate feedback client does not own direct jobs API paths', () => {
  const estimateFeedbackClient = readFileSync(
    new URL('../../estimate-feedback/client.ts', import.meta.url),
    'utf8'
  )
  const estimateFeedbackTrendFilters = readFileSync(
    new URL('../../estimate-feedback/trendFilters.ts', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(estimateFeedbackClient, /\/api\/jobs\//)
  assert.doesNotMatch(estimateFeedbackClient, /@\/types\/jobs\/feedback/)
  assert.match(estimateFeedbackTrendFilters, /\/api\/insights\/trends/)
  assert.match(estimateFeedbackClient, /\/api\/insights\/recommendations/)
})

test('job actuals client helpers call the canonical jobs endpoints through shared API helpers', async () => {
  const { client, calls } = loadJobsClientWithApiMocks()

  await client.loadJobActuals('job-1', 'snapshot-1')
  await client.saveDraftJobActuals('job-1', {
    estimate_snapshot_id: 'snapshot-1',
    actual_labor_hours: 12,
  })
  await client.submitJobActuals('job-1', 'snapshot-1')
  await client.lockJobActuals('job-1', 'snapshot-1')

  assert.deepEqual(
    calls.map((call) => ({ helper: call.helper, path: call.path })),
    [
      {
        helper: 'loadData',
        path: '/api/jobs/job-1/actuals?estimateSnapshotId=snapshot-1',
      },
      { helper: 'mutateData', path: '/api/jobs/job-1/actuals' },
      { helper: 'requestApi', path: '/api/jobs/job-1/actuals/submit' },
      { helper: 'requestApi', path: '/api/jobs/job-1/actuals/lock' },
    ]
  )
  assert.equal(calls[0].init?.cache, 'no-store')
  assert.equal(calls[1].init?.method, 'PUT')
  assertJsonLike(calls[1].init?.headers, { 'Content-Type': 'application/json' })
  assertJsonBody(calls[1].init, {
    estimate_snapshot_id: 'snapshot-1',
    actual_labor_hours: 12,
  })
  for (const call of [calls[2], calls[3]]) {
    assert.equal(call.init?.method, 'POST')
    assertJsonLike(call.init?.headers, { 'Content-Type': 'application/json' })
    assertJsonBody(call.init, { estimate_snapshot_id: 'snapshot-1' })
  }
})

test('job review client helpers call the canonical jobs endpoints through shared API helpers', async () => {
  const { client, calls } = loadJobsClientWithApiMocks()

  await client.loadJobReview('job-1', 'snapshot-1')
  await client.saveJobReview('job-1', {
    estimate_snapshot_id: 'snapshot-1',
    status: 'reviewed',
  })
  await client.lockJobReview('job-1', 'snapshot-1')

  assert.deepEqual(
    calls.map((call) => ({ helper: call.helper, path: call.path })),
    [
      {
        helper: 'loadData',
        path: '/api/jobs/job-1/review?estimateSnapshotId=snapshot-1',
      },
      { helper: 'mutateData', path: '/api/jobs/job-1/review' },
      { helper: 'requestApi', path: '/api/jobs/job-1/review/lock' },
    ]
  )
  assert.equal(calls[0].init?.cache, 'no-store')
  assert.equal(calls[1].init?.method, 'PUT')
  assertJsonLike(calls[1].init?.headers, { 'Content-Type': 'application/json' })
  assertJsonBody(calls[1].init, {
    estimate_snapshot_id: 'snapshot-1',
    status: 'reviewed',
  })
  assert.equal(calls[2].init?.method, 'POST')
  assertJsonLike(calls[2].init?.headers, { 'Content-Type': 'application/json' })
  assertJsonBody(calls[2].init, { estimate_snapshot_id: 'snapshot-1' })
})

test('accepted estimate snapshot repair posts through the shared request API helper', async () => {
  const { client, calls } = loadJobsClientWithApiMocks()

  await client.repairAcceptedEstimateSnapshot('job-1')

  assert.equal(calls.length, 1)
  assert.equal(calls[0].helper, 'requestApi')
  assert.equal(calls[0].path, '/api/jobs/job-1/accepted-estimate/snapshot')
  assert.equal(calls[0].init?.method, 'POST')
})

test('closeout catalog source prefers accepted estimate over the canonical accepted job link', () => {
  const { client } = loadJobsClientWithApiMocks()

  assert.equal(
    client.resolveJobCloseoutCatalogEstimateId({
      accepted_estimate: { estimate_id: 'accepted-estimate' },
      linked_estimate_id: 'linked-estimate',
    }),
    'accepted-estimate'
  )
})

test('closeout catalog source uses linked estimate when accepted estimate details are absent', () => {
  const { client } = loadJobsClientWithApiMocks()

  assert.equal(
    client.resolveJobCloseoutCatalogEstimateId({
      accepted_estimate: null,
      linked_estimate_id: 'linked-estimate',
    }),
    'linked-estimate'
  )
})

test('closeout catalog source returns null without an operational accepted-estimate source', () => {
  const { client } = loadJobsClientWithApiMocks()

  assert.equal(
    client.resolveJobCloseoutCatalogEstimateId({
      accepted_estimate: null,
      linked_estimate_id: null,
    }),
    null
  )
  assert.equal(client.resolveJobCloseoutCatalogEstimateId(null), null)
})

test('job estimate file helper calls the canonical jobs endpoint through the shared API client', async () => {
  const { client, calls } = loadJobsClientWithApiMocks()

  const result = await client.loadJobEstimateFile('job-1')

  assertJsonLike(result, {
    estimateFile: { id: 'drive-1', name: 'Estimate.pdf' },
    estimateFileError: null,
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].helper, 'requestRawApi')
  assert.equal(calls[0].path, '/api/jobs/job-1/estimate-file')
  assert.equal(calls[0].init?.cache, 'no-store')
})

test('job estimate files helper calls the all-files endpoint through the shared API client', async () => {
  const { client, calls } = loadJobsClientWithApiMocks()

  const result = await client.loadMatchingJobEstimateFiles('job-1')

  assertJsonLike(result, {
    latestEstimateFile: { id: 'drive-1', name: 'Estimate.pdf' },
    estimateFiles: [{ id: 'drive-1', name: 'Estimate.pdf' }],
    estimateFileError: null,
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].helper, 'requestRawApi')
  assert.equal(calls[0].path, '/api/jobs/job-1/estimate-file?all=1')
  assert.equal(calls[0].init?.cache, 'no-store')
})

test('job estimate files helper keeps an empty all-files success response nullable and non-erroring', async () => {
  const { client, calls } = loadJobsClientWithApiMocks({
    requestRawApiResult: {
      response: { ok: true },
      payload: { latest: null, files: [] },
      errorMessage: null,
    },
  })

  const result = await client.loadMatchingJobEstimateFiles('job-1')

  assertJsonLike(result, {
    latestEstimateFile: null,
    estimateFiles: [],
    estimateFileError: null,
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].helper, 'requestRawApi')
  assert.equal(calls[0].path, '/api/jobs/job-1/estimate-file?all=1')
})

test('latest estimate file helper returns quote-facing not-found wording', async () => {
  const { client } = loadJobsClientWithApiMocks({
    requestRawApiResult: {
      response: { ok: false },
      payload: null,
      errorMessage: 'No matching quote PDF found in Drive folder.',
    },
  })

  const result = await client.loadLatestJobEstimateFile('job-1')

  assertJsonLike(result, {
    estimateFile: null,
    estimateFileError: 'No matching quote PDF found in Drive folder.',
  })
})

test('estimate-file redirect paths stay isolated to the shared helper, route, tests, and docs', () => {
  const jobsClient = readFileSync(new URL('../client.ts', import.meta.url), 'utf8')
  const customersService = readFileSync(new URL('../../customers/service.ts', import.meta.url), 'utf8')
  const jobsRoutes = readFileSync(new URL('../routes.ts', import.meta.url), 'utf8')
  const jobEstimateFileRoute = readFileSync(
    new URL('../../../app/api/jobs/[id]/estimate-file/route.ts', import.meta.url),
    'utf8'
  )
  const jobsArchitectureDoc = readFileSync(
    new URL('../../../docs/jobs-architecture.md', import.meta.url),
    'utf8'
  )
  const jobEstimateFileRouteTest = readFileSync(
    new URL('../../../app/api/__tests__/JobEstimateFileRoute.test.tsx', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(jobsClient, /estimate-file\?redirect=1/)
  assert.doesNotMatch(customersService, /estimate-file\?redirect=1/)
  assert.match(jobsRoutes, /estimate-file/)
  assert.match(jobEstimateFileRoute, /searchParams\.get\('redirect'\)/)
  assert.match(jobsArchitectureDoc, /redirect=1/)
  assert.match(jobEstimateFileRouteTest, /redirect=1/)
})

test('job estimate file normalizers accept latest, all-files, and legacy file envelopes', () => {
  const { client } = loadJobsClientWithApiMocks()
  const latest = { id: 'drive-2', name: 'Estimate-v2.pdf' }
  const older = { id: 'drive-1', name: 'Estimate-v1.pdf' }

  assertJsonLike(client.normalizeLatestJobEstimateFile({ latest, files: [latest, older] }), latest)
  assertJsonLike(client.normalizeLatestJobEstimateFile({ file: older }), older)
  assert.equal(client.normalizeLatestJobEstimateFile(null), null)

  assertJsonLike(client.normalizeMatchingJobEstimateFiles({ latest, files: [latest, older] }), {
    latest,
    files: [latest, older],
  })
  assertJsonLike(client.normalizeMatchingJobEstimateFiles({ file: older }), {
    latest: older,
    files: [older],
  })
})

test('stage email schedule helper trims schedule rows to composition fields through shared loadData', async () => {
  const { client, calls } = loadJobsClientWithApiMocks()

  const result = await client.loadStageEmailSchedules('job-1')

  assertJsonLike(result, [{ start_at: null, end_at: null }])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].helper, 'loadData')
  assert.equal(calls[0].path, '/api/jobs/job-1/schedules')
  assert.equal(calls[0].init?.cache, 'no-store')
})

test('stage email send helper posts through the canonical jobs client transport', async () => {
  const { client, calls } = loadJobsClientWithApiMocks()

  const result = await client.sendJobStageEmail('job-1', {
    stage: 'scheduled',
    subject: 'Scheduled',
    body: 'See you soon.',
    estimateFileIds: ['drive-1'],
  })

  assertJsonLike(result, {
    status: 'sent',
    replayed: false,
    job: { mutated: true },
    warning: null,
    notice: 'Scheduled email sent.',
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].helper, 'mutateData')
  assert.equal(calls[0].path, '/api/jobs/job-1/send-stage')
  assert.equal(calls[0].init?.method, 'POST')
  assertJsonLike(calls[0].init?.headers, { 'Content-Type': 'application/json' })
  assertJsonBody(calls[0].init, {
    stage: 'scheduled',
    subject: 'Scheduled',
    body: 'See you soon.',
    idempotency_key: 'scheduled:job-1',
    estimate_file_ids: ['drive-1'],
  })
})

test('closeout transport helpers own paint-log save and closeout note patch endpoints', async () => {
  const { client, calls } = loadJobsClientWithApiMocks()

  const paintLogs = await client.saveCloseoutPaintLogs('job-1', {
    rows: [
      {
        where_used: 'Walls',
        paint_product: 'Duration',
        sheen: 'Eggshell',
        color: 'SW 7008',
        notes: 'Accent wall',
      },
    ],
  })
  const patchedJob = await client.patchJobCloseoutNotes('job-1', 'Left extra paint in garage.')

  assertJsonLike(paintLogs, [{ saved: true }])
  assertJsonLike(patchedJob, { requested: true })
  assert.deepEqual(
    calls.map((call) => ({ helper: call.helper, path: call.path })),
    [
      { helper: 'mutateData', path: '/api/jobs/job-1/paint-logs' },
      { helper: 'requestApi', path: '/api/jobs/job-1' },
    ]
  )
  assert.equal(calls[0].init?.method, 'PUT')
  assertJsonLike(calls[0].init?.headers, { 'Content-Type': 'application/json' })
  assertJsonBody(calls[0].init, {
    rows: [
      {
        where_used: 'Walls',
        paint_product: 'Duration',
        sheen: 'Eggshell',
        color: 'SW 7008',
        notes: 'Accent wall',
      },
    ],
  })
  assert.equal(calls[1].init?.method, 'PATCH')
  assertJsonLike(calls[1].init?.headers, { 'Content-Type': 'application/json' })
  assertJsonBody(calls[1].init, { closeout_notes: 'Left extra paint in garage.' })
})

test('shared job feedback workflow types live outside service client bypass modules', () => {
  const jobsClient = readFileSync(new URL('../client.ts', import.meta.url), 'utf8')
  const estimateFeedbackClient = readFileSync(
    new URL('../../estimate-feedback/client.ts', import.meta.url),
    'utf8'
  )
  const jobsService = readFileSync(new URL('../service.ts', import.meta.url), 'utf8')
  const jobsServiceCore = readFileSync(new URL('../serviceCore.ts', import.meta.url), 'utf8')

  assert.match(jobsClient, /from ['"]@\/types\/jobs\/feedback['"]/)
  assert.doesNotMatch(estimateFeedbackClient, /from ['"]@\/types\/jobs\/feedback['"]/)
  assert.match(jobsService, /from ['"]@\/types\/jobs\/feedback['"]/)
  assert.match(jobsServiceCore, /from ['"]\.\.\/\.\.\/types\/jobs\/feedback\.ts['"]/)

  for (const serverModule of [jobsService, jobsServiceCore]) {
    assert.doesNotMatch(serverModule, /jobs\/client/)
    assert.doesNotMatch(serverModule, /jobs\/feedbackTypes/)
  }
})

test('job API contract types live outside the client transport module', () => {
  const jobsClient = readFileSync(new URL('../client.ts', import.meta.url), 'utf8')
  const jobsServiceCore = readFileSync(new URL('../serviceCore.ts', import.meta.url), 'utf8')
  const jobsApiTypes = readFileSync(new URL('../../../types/jobs/api.ts', import.meta.url), 'utf8')

  assert.match(jobsClient, /from ['"]@\/types\/jobs\/api['"]/)
  assert.match(jobsServiceCore, /from ['"]\.\.\/\.\.\/types\/jobs\/api\.ts['"]/)
  assert.match(jobsApiTypes, new RegExp(`export type ${'JobDetail'} = `))
  assert.doesNotMatch(jobsClient, new RegExp(`export type ${'JobDetail'}`))
  assert.doesNotMatch(jobsClient, new RegExp(`export type ${'JobSummary'}`))
  assert.doesNotMatch(jobsClient, new RegExp(`export type ${'JobSitePhoto'}`))
})
