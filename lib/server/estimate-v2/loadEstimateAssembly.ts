import { supabaseAdmin } from '../org.ts'
import { asText, type UnsafeRecord as Unsafe } from '../../estimator/parsing.ts'
import { buildEstimateGetResponse } from '../estimateGetResponse.ts'
import { loadEstimateTemplateSettings } from '../estimateTemplateSettings.ts'

import {
  enrichEstimateV2AccessFeeRows,
  enrichEstimateV2OtherRows,
} from './calculatedRowEnrichment.ts'
import { loadCalculatedEstimateV2Artifacts } from './calculationOrchestration.ts'
import { fail, getEstimate } from './shared.ts'

function assertActiveRowsReferenceExistingRooms(params: {
  rooms: Unsafe[]
  childCollections: Array<{
    table: string
    rows: Unsafe[]
  }>
}) {
  const validRoomIds = new Set(
    params.rooms
      .map((row) => asText(row.room_id).toUpperCase())
      .filter((roomId) => !!roomId)
  )

  for (const collection of params.childCollections) {
    for (const row of collection.rows) {
      const roomId = asText(row.room_id).toUpperCase()
      if (!roomId) continue
      if (validRoomIds.has(roomId)) continue

      const rowId = asText(row.id)
      fail(
        `Estimate integrity error: partial/corrupt estimate state. Active ${collection.table} row${rowId ? ` ${rowId}` : ''} references missing room_id ${roomId}.`,
        409
      )
    }
  }
}

export async function loadEstimateV2Response(params: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
}) {
  const estimateRes = await getEstimate(params.orgId, params.estimateId)
  if ('error' in estimateRes) {
    const message = asText(estimateRes.error) || 'Failed to load estimate'
    fail(message, message === 'Quote not found' ? 404 : 500)
  }

  const [jobsettings, rooms, roomWallScopes, wallSegments, roomCeilingScopes, ceilingScopeSegments, roomTrimScopes, roomDoorScopes, drywallRepairs, rollers, prejob, trimItems, jobColors, roomFlags, accessFees, other] = await Promise.all([
    supabaseAdmin.from('estimate_jobsettings').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).maybeSingle(),
    supabaseAdmin.from('estimate_rooms').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_wall_scopes').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('room_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_segments').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').not('wall_scope_id', 'is', null).order('wall_scope_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_ceiling_scopes').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('room_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_ceiling_scope_segments').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('ceiling_scope_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_trim_scopes').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('room_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_door_scopes').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('room_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_drywall_repairs').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('room_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_rollers').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('position', { ascending: true }),
    supabaseAdmin.from('estimate_prejob').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('position', { ascending: true }),
    supabaseAdmin.from('estimate_trim_items').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('sort_order', { ascending: true }),
    supabaseAdmin.from('estimate_job_colors').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_flags').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('position', { ascending: true }),
    supabaseAdmin.from('estimate_access_fees').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('position', { ascending: true }),
    supabaseAdmin.from('estimate_other').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('position', { ascending: true }),
  ])

  if (jobsettings.error) fail(jobsettings.error.message, 500)
  if (rooms.error) fail(rooms.error.message, 500)
  if (roomWallScopes.error) fail(roomWallScopes.error.message, 500)
  if (wallSegments.error) fail(wallSegments.error.message, 500)
  if (roomCeilingScopes.error) fail(roomCeilingScopes.error.message, 500)
  if (ceilingScopeSegments.error) fail(ceilingScopeSegments.error.message, 500)
  if (roomTrimScopes.error) fail(roomTrimScopes.error.message, 500)
  if (roomDoorScopes.error) fail(roomDoorScopes.error.message, 500)
  if (drywallRepairs.error) fail(drywallRepairs.error.message, 500)
  if (rollers.error) fail(rollers.error.message, 500)
  if (prejob.error) fail(prejob.error.message, 500)
  if (trimItems.error) fail(trimItems.error.message, 500)
  if (jobColors.error) fail(jobColors.error.message, 500)
  if (roomFlags.error) fail(roomFlags.error.message, 500)
  if (accessFees.error) fail(accessFees.error.message, 500)
  if (other.error) fail(other.error.message, 500)

  const roomRows = (rooms.data ?? []) as Unsafe[]
  const roomWallScopeRows = (roomWallScopes.data ?? []) as Unsafe[]
  const wallSegmentRows = (wallSegments.data ?? []) as Unsafe[]
  const roomCeilingScopeRows = (roomCeilingScopes.data ?? []) as Unsafe[]
  const ceilingScopeSegmentRows = (ceilingScopeSegments.data ?? []) as Unsafe[]
  const roomTrimScopeRows = (roomTrimScopes.data ?? []) as Unsafe[]
  const roomDoorScopeRows = (roomDoorScopes.data ?? []) as Unsafe[]
  const drywallRepairRows = (drywallRepairs.data ?? []) as Unsafe[]
  const roomFlagRows = (roomFlags.data ?? []) as Unsafe[]

  assertActiveRowsReferenceExistingRooms({
    rooms: roomRows,
    childCollections: [
      { table: 'estimate_room_wall_scopes', rows: roomWallScopeRows },
      { table: 'estimate_segments', rows: wallSegmentRows },
      { table: 'estimate_room_ceiling_scopes', rows: roomCeilingScopeRows },
      { table: 'estimate_room_ceiling_scope_segments', rows: ceilingScopeSegmentRows },
      { table: 'estimate_room_trim_scopes', rows: roomTrimScopeRows },
      { table: 'estimate_room_door_scopes', rows: roomDoorScopeRows },
      { table: 'estimate_drywall_repairs', rows: drywallRepairRows },
      { table: 'estimate_room_flags', rows: roomFlagRows },
    ],
  })

  const orgDefaults = await loadEstimateTemplateSettings({
    orgId: params.orgId,
    estimateId: params.estimateId,
  }).catch(() => null)
  const calculated = await loadCalculatedEstimateV2Artifacts({
    requestOrigin: params.requestOrigin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
    jobsettings: (jobsettings.data as Unsafe | null) ?? null,
    rooms: roomRows,
    roomWallScopes: roomWallScopeRows,
    wallSegments: wallSegmentRows,
    roomCeilingScopes: roomCeilingScopeRows,
    ceilingScopeSegments: ceilingScopeSegmentRows,
    roomTrimScopes: roomTrimScopeRows,
    roomDoorScopes: roomDoorScopeRows,
    drywallRepairs: drywallRepairRows,
    accessFees: (accessFees.data ?? []) as Unsafe[],
    other: (other.data ?? []) as Unsafe[],
    orgDefaults,
  })
  const enrichedAccessFees = enrichEstimateV2AccessFeeRows({
    rawRows: (accessFees.data ?? []) as Unsafe[],
    calculatedRows: calculated.accessFeeCalculation.rows,
  })
  const enrichedOther = enrichEstimateV2OtherRows({
    rawRows: (other.data ?? []) as Unsafe[],
    calculatedRows: calculated.otherCalculations.scopes,
  })

  return buildEstimateGetResponse({
    estimate: estimateRes.estimate,
    inputs: {
      jobsettings: jobsettings.data,
      org_defaults: orgDefaults,
      paint_products: calculated.calculationCatalogs.wall?.paint_products ?? [],
      rooms: rooms.data ?? [],
      room_wall_scopes: calculated.quoteWallScopes,
      wall_segments: calculated.wallCalculations.segments,
      room_ceiling_scopes: calculated.quoteCeilingScopes,
      ceiling_scope_segments: calculated.ceilingCalculations.segments,
      room_trim_scopes: calculated.quoteTrimScopes,
      room_door_scopes: calculated.quoteDoorScopes,
      drywall_repairs: calculated.drywallCalculations.scopes,
      rollers: rollers.data ?? [],
      prejob: prejob.data ?? [],
      trim_items: trimItems.data ?? [],
      job_colors: jobColors.data ?? [],
      room_flags: roomFlags.data ?? [],
      access_fees: enrichedAccessFees,
      other: enrichedOther,
    },
    wall_calculations: calculated.wallCalculations,
    ceiling_calculations: calculated.ceilingCalculations,
    trim_calculations: calculated.trimCalculations,
    door_calculations: calculated.doorCalculations,
    drywall_calculations: calculated.drywallCalculations,
    trim_paint: calculated.trimPaintInput,
    pricing_summary: calculated.pricingSummary,
  })
}
