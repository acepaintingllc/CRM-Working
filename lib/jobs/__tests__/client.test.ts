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

type JobsClientModule = {
  loadJobEstimateFile: (jobId: string) => Promise<unknown>
  loadJobActuals: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  saveDraftJobActuals: (jobId: string, payload: Record<string, unknown>) => Promise<unknown>
  submitJobActuals: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  lockJobActuals: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  loadJobReview: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  saveJobReview: (jobId: string, payload: Record<string, unknown>) => Promise<unknown>
  lockJobReview: (jobId: string, estimateSnapshotId: string) => Promise<unknown>
  repairAcceptedEstimateSnapshot: (jobId: string) => Promise<unknown>
}

function loadJobsClientWithApiMocks() {
  const calls: ApiCall[] = []
  const clientSource = readFileSync(new URL('../client.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(clientSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const exports: Partial<JobsClientModule> = {}
  const apiClient = {
    loadData: async (path: string, init?: RequestInit) => {
      calls.push({ helper: 'loadData', path, init })
      return { loaded: true }
    },
    mutateData: async (path: string, init?: RequestInit) => {
      calls.push({ helper: 'mutateData', path, init })
      return { data: { mutated: true }, notice: 'Saved.' }
    },
    requestApi: async (path: string, init?: RequestInit) => {
      calls.push({ helper: 'requestApi', path, init })
      return { data: { requested: true }, notice: 'Done.' }
    },
    requestRawApi: async (path: string, init?: RequestInit) => {
      calls.push({ helper: 'requestRawApi', path, init })
      return {
        response: { ok: true },
        payload: { id: 'drive-1', name: 'Estimate.pdf' },
        errorMessage: null,
      }
    },
  }

  vm.runInNewContext(compiled, {
    exports,
    require: (specifier: string) => {
      if (specifier === '@/lib/client/api') return apiClient
      if (specifier === '@/lib/jobs/paintLog') return { mapPaintLogRow: (row: unknown) => row }
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
