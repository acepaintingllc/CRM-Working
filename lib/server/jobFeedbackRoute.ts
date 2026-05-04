import { readUuidParam, resolveParams } from './apiRoute'

export type JobIdRouteContext = {
  params: { id?: string } | Promise<{ id?: string }>
}

type EstimateSnapshotIdNormalizer<T> = (value: unknown) => T

export async function readJobIdParam(context: JobIdRouteContext) {
  const params = await resolveParams(context)
  return readUuidParam(params?.id, 'job id')
}

export function readEstimateSnapshotIdFromUrl<T>(
  request: Request,
  normalizeSnapshotId: EstimateSnapshotIdNormalizer<T>
) {
  const url = new URL(request.url)
  return normalizeSnapshotId(
    url.searchParams.get('estimateSnapshotId') ?? url.searchParams.get('estimate_snapshot_id')
  )
}

export function readEstimateSnapshotIdFromBody<T>(
  body: unknown,
  normalizeSnapshotId: EstimateSnapshotIdNormalizer<T>
) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return normalizeSnapshotId(null)
  }

  const record = body as Record<string, unknown>
  return normalizeSnapshotId(record.estimate_snapshot_id ?? record.estimateSnapshotId)
}
