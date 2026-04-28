import { supabaseAdmin } from '../org.ts'
import { asText, type UnsafeRecord as Unsafe } from '../../estimator/parsing.ts'
import { buildEstimateGetResponse } from '../estimateGetResponse.ts'
import { loadEstimateTemplateSettings } from '../estimateTemplateSettings.ts'

import { loadCalculatedEstimateV2Artifacts } from './calculationOrchestration.ts'
import { fail, getEstimate } from './shared.ts'

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

  const [jobsettings, rooms, roomWallScopes, segments, wallSegments, ceilingSegments, roomCeilingScopes, ceilingScopeSegments, roomTrimScopes, roomDoorScopes, rollers, prejob, trimItems, jobColors, roomFlags, accessFees, other] = await Promise.all([
    supabaseAdmin.from('estimate_jobsettings').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).maybeSingle(),
    supabaseAdmin.from('estimate_rooms').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_wall_scopes').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('room_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_segments').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').is('wall_scope_id', null).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_segments').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').not('wall_scope_id', 'is', null).order('wall_scope_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_ceiling_segments').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_ceiling_scopes').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('room_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_ceiling_scope_segments').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('ceiling_scope_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_trim_scopes').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('room_id', { ascending: true }).order('position', { ascending: true }),
    supabaseAdmin.from('estimate_room_door_scopes').select('*').eq('org_id', params.orgId).eq('estimate_id', params.estimateId).eq('active', 'Y').order('room_id', { ascending: true }).order('position', { ascending: true }),
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
  if (segments.error) fail(segments.error.message, 500)
  if (wallSegments.error) fail(wallSegments.error.message, 500)
  if (ceilingSegments.error) fail(ceilingSegments.error.message, 500)
  if (roomCeilingScopes.error) fail(roomCeilingScopes.error.message, 500)
  if (ceilingScopeSegments.error) fail(ceilingScopeSegments.error.message, 500)
  if (roomTrimScopes.error) fail(roomTrimScopes.error.message, 500)
  if (roomDoorScopes.error) fail(roomDoorScopes.error.message, 500)
  if (rollers.error) fail(rollers.error.message, 500)
  if (prejob.error) fail(prejob.error.message, 500)
  if (trimItems.error) fail(trimItems.error.message, 500)
  if (jobColors.error) fail(jobColors.error.message, 500)
  if (roomFlags.error) fail(roomFlags.error.message, 500)
  if (accessFees.error) fail(accessFees.error.message, 500)
  if (other.error) fail(other.error.message, 500)

  const orgDefaults = await loadEstimateTemplateSettings(params.orgId).catch(() => null)
  const calculated = await loadCalculatedEstimateV2Artifacts({
    requestOrigin: params.requestOrigin,
    orgId: params.orgId,
    userId: params.userId,
    estimateId: params.estimateId,
    jobsettings: (jobsettings.data as Unsafe | null) ?? null,
    rooms: (rooms.data ?? []) as Unsafe[],
    roomWallScopes: (roomWallScopes.data ?? []) as Unsafe[],
    wallSegments: (wallSegments.data ?? []) as Unsafe[],
    roomCeilingScopes: (roomCeilingScopes.data ?? []) as Unsafe[],
    ceilingScopeSegments: (ceilingScopeSegments.data ?? []) as Unsafe[],
    roomTrimScopes: (roomTrimScopes.data ?? []) as Unsafe[],
    roomDoorScopes: (roomDoorScopes.data ?? []) as Unsafe[],
    orgDefaults,
  })

  return buildEstimateGetResponse({
    estimate: estimateRes.estimate,
    inputs: {
      jobsettings: jobsettings.data,
      org_defaults: orgDefaults,
      paint_products: calculated.calculationCatalogs.wall?.paint_products ?? [],
      rooms: rooms.data ?? [],
      room_wall_scopes: calculated.quoteWallScopes,
      segments: segments.data ?? [],
      wall_segments: wallSegments.data ?? [],
      ceiling_segments: ceilingSegments.data ?? [],
      room_ceiling_scopes: calculated.quoteCeilingScopes,
      ceiling_scope_segments: ceilingScopeSegments.data ?? [],
      room_trim_scopes: calculated.quoteTrimScopes,
      room_door_scopes: calculated.quoteDoorScopes,
      rollers: rollers.data ?? [],
      prejob: prejob.data ?? [],
      trim_items: trimItems.data ?? [],
      job_colors: jobColors.data ?? [],
      room_flags: roomFlags.data ?? [],
      access_fees: accessFees.data ?? [],
      other: other.data ?? [],
    },
    wall_calculations: calculated.wallCalculations,
    ceiling_calculations: calculated.ceilingCalculations,
    trim_calculations: calculated.trimCalculations,
    door_calculations: calculated.doorCalculations,
    trim_paint: calculated.trimPaintInput,
    pricing_summary: calculated.pricingSummary,
  })
}
