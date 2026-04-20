type AnyRecord = Record<string, unknown>

export type EstimateGetResponseParams = {
  estimate: AnyRecord
  inputs: {
    jobsettings: unknown
    paint_products: unknown[]
    rooms: unknown[]
    room_wall_scopes: unknown[]
    segments: unknown[]
    wall_segments: unknown[]
    ceiling_segments: unknown[]
    room_ceiling_scopes: unknown[]
    ceiling_scope_segments: unknown[]
    room_trim_scopes: unknown[]
    rollers: unknown[]
    prejob: unknown[]
    trim_items: unknown[]
    job_colors: unknown[]
    room_flags: unknown[]
    access_fees: unknown[]
    other: unknown[]
  }
  wall_calculations: unknown
  ceiling_calculations: unknown
  trim_calculations: unknown
  trim_paint: unknown
  pricing_summary: unknown
}

export function buildEstimateGetResponse(params: EstimateGetResponseParams) {
  return {
    estimate: params.estimate,
    inputs: {
      jobsettings: params.inputs.jobsettings,
      paint_products: params.inputs.paint_products,
      rooms: params.inputs.rooms,
      room_wall_scopes: params.inputs.room_wall_scopes,
      segments: params.inputs.segments,
      wall_segments: params.inputs.wall_segments,
      ceiling_segments: params.inputs.ceiling_segments,
      room_ceiling_scopes: params.inputs.room_ceiling_scopes,
      ceiling_scope_segments: params.inputs.ceiling_scope_segments,
      room_trim_scopes: params.inputs.room_trim_scopes,
      rollers: params.inputs.rollers,
      prejob: params.inputs.prejob,
      trim_items: params.inputs.trim_items,
      job_colors: params.inputs.job_colors,
      room_flags: params.inputs.room_flags,
      access_fees: params.inputs.access_fees,
      other: params.inputs.other,
    },
    wall_calculations: params.wall_calculations,
    ceiling_calculations: params.ceiling_calculations,
    trim_calculations: params.trim_calculations,
    trim_paint: params.trim_paint,
    pricing_summary: params.pricing_summary,
  }
}
