import type { EstimateV2GetResponse, EstimateV2ResponseInputs } from '@/types/estimator/v2'

export type EstimateGetResponseParams = {
  estimate: EstimateV2GetResponse['estimate'] | Record<string, unknown>
  inputs: EstimateV2ResponseInputs
  wall_calculations: EstimateV2GetResponse['wall_calculations']
  ceiling_calculations: EstimateV2GetResponse['ceiling_calculations']
  trim_calculations: EstimateV2GetResponse['trim_calculations']
  door_calculations?: EstimateV2GetResponse['door_calculations']
  drywall_calculations?: EstimateV2GetResponse['drywall_calculations']
  trim_paint: EstimateV2GetResponse['trim_paint']
  pricing_summary: EstimateV2GetResponse['pricing_summary'] | Record<string, unknown>
}

export function buildEstimateGetResponse(params: EstimateGetResponseParams): EstimateV2GetResponse {
  return {
    estimate: params.estimate as EstimateV2GetResponse['estimate'],
    inputs: params.inputs,
    wall_calculations: params.wall_calculations,
    ceiling_calculations: params.ceiling_calculations,
    trim_calculations: params.trim_calculations,
    door_calculations: params.door_calculations ?? null,
    drywall_calculations: params.drywall_calculations ?? null,
    trim_paint: params.trim_paint,
    pricing_summary: params.pricing_summary as EstimateV2GetResponse['pricing_summary'],
  }
}
