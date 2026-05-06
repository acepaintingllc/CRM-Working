function buildJobRoutePath(jobId: string, suffix = '') {
  return `/api/jobs/${encodeURIComponent(jobId)}${suffix}`
}

export function buildJobEstimateFilePath(
  jobId: string,
  options?: { all?: boolean; redirect?: boolean }
) {
  const path = buildJobRoutePath(jobId, '/estimate-file')
  const search = new URLSearchParams()

  if (options?.all) search.set('all', '1')
  if (options?.redirect) search.set('redirect', '1')

  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export function buildJobEstimateFileRedirectPath(jobId: string) {
  return buildJobEstimateFilePath(jobId, { redirect: true })
}
