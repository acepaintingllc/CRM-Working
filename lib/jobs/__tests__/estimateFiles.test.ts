import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

type QueryResponse = {
  data: unknown
  error: unknown
}

type EstimateFilesModule = {
  listMatchingJobEstimateFiles: (params: {
    origin: string
    orgId: string
    userId: string
    jobId: string
  }) => Promise<unknown>
  getLatestJobEstimateFile: (params: {
    origin: string
    orgId: string
    userId: string
    jobId: string
  }) => Promise<unknown>
  selectJobEstimateFiles: (
    matching: { latest: Record<string, unknown> | null; files: Array<Record<string, unknown>> },
    estimateFileIds: readonly string[]
  ) => unknown
}

function loadEstimateFilesModule(options?: {
  queryResponses?: QueryResponse[]
  matchingResult?: { files: Array<Record<string, unknown>> } | { error: string }
  latestResult?: { file: Record<string, unknown> } | { error: string }
}) {
  const source = readFileSync(new URL('../estimateFiles.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText

  const queryResponses = [
    {
      data: { id: 'job-1', customer_id: 'customer-1' },
      error: null,
    },
    {
      data: { address: '123 Main St' },
      error: null,
    },
    ...(options?.queryResponses ?? []),
  ]

  const exports: Partial<EstimateFilesModule> = {}
  const okResult = <T>(data: T) => ({ ok: true, data })
  const errorResult = (kind: string, message: string) => ({ ok: false, kind, message })

  const supabaseAdmin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => queryResponses.shift() ?? { data: null, error: null },
          }),
        }),
      }),
    }),
  }

  vm.runInNewContext(compiled, {
    exports,
    require: (specifier: string) => {
      if (specifier === '@/lib/server/googleDrive') {
        return {
          findLatestEstimateFile: async () => options?.latestResult ?? { error: 'No match' },
          findMatchingEstimateFiles: async () => options?.matchingResult ?? { files: [] },
        }
      }
      if (specifier === '@/lib/server/org') return { supabaseAdmin }
      if (specifier === '@/lib/server/serviceResult') {
        return { okResult, errorResult }
      }
      throw new Error(`Unexpected import in estimateFiles test: ${specifier}`)
    },
  })

  return exports as EstimateFilesModule
}

function assertJsonLike(actual: unknown, expected: unknown) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected)
}

test('listMatchingJobEstimateFiles returns a nullable success envelope when Drive finds no files', async () => {
  const estimateFiles = loadEstimateFilesModule({
    matchingResult: { files: [] },
  })

  const result = await estimateFiles.listMatchingJobEstimateFiles({
    origin: 'http://localhost',
    orgId: 'org-1',
    userId: 'user-1',
    jobId: 'job-1',
  })

  assertJsonLike(result, {
    ok: true,
    data: { latest: null, files: [] },
  })
})

test('getLatestJobEstimateFile returns quote-facing not-found wording when Drive finds no files', async () => {
  const estimateFiles = loadEstimateFilesModule({
    latestResult: { error: 'No matching estimate PDF found in Drive folder.' },
  })

  const result = await estimateFiles.getLatestJobEstimateFile({
    origin: 'http://localhost',
    orgId: 'org-1',
    userId: 'user-1',
    jobId: 'job-1',
  })

  assertJsonLike(result, {
    ok: false,
    kind: 'not_found',
    message: 'No matching quote PDF found in Drive folder.',
  })
})

test('listMatchingJobEstimateFiles reports quote-file wording when Drive lookup fails', async () => {
  const estimateFiles = loadEstimateFilesModule({
    matchingResult: { error: 'No matching estimate file found in Drive folder.' },
  })

  const result = await estimateFiles.listMatchingJobEstimateFiles({
    origin: 'http://localhost',
    orgId: 'org-1',
    userId: 'user-1',
    jobId: 'job-1',
  })

  assertJsonLike(result, {
    ok: false,
    kind: 'not_found',
    message: 'No matching quote file found in Drive folder.',
  })
})

test('selectJobEstimateFiles keeps latest-file semantics aligned for compose and send', () => {
  const estimateFiles = loadEstimateFilesModule()
  const latest = { id: 'drive-2', name: 'Estimate-v2.pdf' }
  const older = { id: 'drive-1', name: 'Estimate-v1.pdf' }

  assertJsonLike(
    estimateFiles.selectJobEstimateFiles({ latest, files: [latest, older] }, []),
    {
      ok: true,
      data: { latest, files: [latest] },
    }
  )
  assertJsonLike(
    estimateFiles.selectJobEstimateFiles({ latest, files: [latest, older] }, ['drive-1']),
    {
      ok: true,
      data: { latest, files: [older] },
    }
  )
})
