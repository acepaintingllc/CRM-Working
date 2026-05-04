import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('jobs client owns job actuals, review, and snapshot repair helpers', () => {
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
    assert.doesNotMatch(
      estimateFeedbackClient,
      new RegExp(`export async function ${exportedName}\\b`)
    )
  }
})

test('shared job feedback workflow types live outside client transport modules', () => {
  const jobsClient = readFileSync(new URL('../client.ts', import.meta.url), 'utf8')
  const jobsService = readFileSync(new URL('../service.ts', import.meta.url), 'utf8')
  const jobsServiceCore = readFileSync(new URL('../serviceCore.ts', import.meta.url), 'utf8')

  assert.match(jobsClient, /from ['"]@\/types\/jobs\/feedback['"]/)
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
