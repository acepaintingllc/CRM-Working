import {
  accessFee,
  buildCanonicalEditorState,
  buildCanonicalJobSettings,
  CANONICAL_IDS,
  ceilingScope,
  ceilingSegment,
  doorScope,
  drywallRepair,
  prejobTrip,
  room,
  trimScope,
  wallScope,
  wallSegment,
  type EstimateV2CanonicalFixture,
} from '../estimateV2CanonicalFixtureTypes.ts'

const BEDROOM_ID = 'R-BEDROOM'
const BATHROOM_ID = 'R-BATHROOM'
const HALLWAY_ID = 'R-HALLWAY'

export const estimateV2FunctionalCompletenessSmokeIds = {
  orgId: 'org-functional-smoke',
  customerId: 'customer-functional-smoke',
  customerName: 'Avery Smoke',
  customerEmail: 'avery.smoke@example.test',
  customerAddress: '321 Deterministic Way, Austin, TX 78701',
  jobId: 'job-functional-smoke',
  estimateId: 'estimate-functional-smoke',
  publicVersionId: 'public-functional-smoke-v1',
  publicToken: 'public-functional-smoke-token',
  rooms: {
    bedroom: BEDROOM_ID,
    bathroom: BATHROOM_ID,
    hallway: HALLWAY_ID,
  },
  walls: {
    bedroom: 'wall-bedroom-main',
    bedroomExcluded: 'wall-bedroom-excluded',
  },
  wallSegments: {
    bedroomRectangle: 'wall-bedroom-rect-segment',
    bedroomManual: 'wall-bedroom-manual-segment',
  },
  ceilings: {
    bathroom: 'ceiling-bathroom-main',
  },
  ceilingSegments: {
    bathroomManual: 'ceiling-bathroom-manual-segment',
  },
  trim: {
    bedroom: 'trim-bedroom-base',
    hallway: 'trim-hallway-base',
  },
  doors: {
    hallway: 'door-hallway-panel',
  },
  drywall: {
    bedroom: 'drywall-bedroom-tape-repair',
  },
  accessFees: {
    job: 'access-job-level',
    bedroom: 'access-bedroom-room-level',
  },
  prejob: {
    bedroomWallpaper: 'prejob-bedroom-wallpaper',
    bedroomFurniture: 'prejob-bedroom-furniture',
  },
} as const

export const scenarioName = 'Estimate V2 functional completeness smoke'
export const scenarioDescription =
  'Three-room fixture covering visible scope families, hidden access/prejob costs, overrides, policies, and excluded rows.'

export const editorState = buildCanonicalEditorState({
  scenarioId: 'functional-completeness-smoke',
  scenarioName,
  jobSettingsDraft: buildCanonicalJobSettings({
    laborDayEnabled: true,
    dayhours: 7,
    roundingIncrementHours: 2,
    laborRate: 73,
    jobMinEnabled: true,
    jobMinAmount: 3_500,
  }),
  rooms: [
    room({
      id: 'room-bedroom',
      roomId: BEDROOM_ID,
      roomName: 'Bedroom',
      lengthIn: '168',
      widthIn: '144',
      heightIn: '96',
      position: 0,
    }),
    room({
      id: 'room-bathroom',
      roomId: BATHROOM_ID,
      roomName: 'Bathroom',
      lengthIn: '96',
      widthIn: '84',
      heightIn: '96',
      position: 1,
    }),
    room({
      id: 'room-hallway',
      roomId: HALLWAY_ID,
      roomName: 'Hallway',
      lengthIn: '180',
      widthIn: '48',
      heightIn: '96',
      position: 2,
    }),
  ],
  wallScopes: [
    wallScope({
      id: estimateV2FunctionalCompletenessSmokeIds.walls.bedroom,
      roomId: BEDROOM_ID,
      scopeName: 'Bedroom walls',
      mode: 'SEG',
      heightIn: '96',
      perimeterIn: '',
      overrideTotal: '880',
      notes: 'Scope total override for smoke coverage.',
    }),
    wallScope({
      id: estimateV2FunctionalCompletenessSmokeIds.walls.bedroomExcluded,
      roomId: BEDROOM_ID,
      scopeName: 'Bedroom excluded accent wall',
      mode: 'RECT',
      include: 'N',
      heightIn: '96',
      perimeterIn: '120',
      notes: 'Excluded row remains persisted but should not price.',
    }),
  ],
  wallSegments: [
    wallSegment({
      id: estimateV2FunctionalCompletenessSmokeIds.wallSegments.bedroomRectangle,
      wallScopeId: estimateV2FunctionalCompletenessSmokeIds.walls.bedroom,
      roomId: BEDROOM_ID,
      segmentName: 'Bedroom long wall',
      widthIn: '168',
      heightIn: '96',
      position: 0,
    }),
    wallSegment({
      id: estimateV2FunctionalCompletenessSmokeIds.wallSegments.bedroomManual,
      wallScopeId: estimateV2FunctionalCompletenessSmokeIds.walls.bedroom,
      roomId: BEDROOM_ID,
      segmentName: 'Bedroom manual alcove',
      shapeType: 'MANUAL',
      widthIn: '',
      heightIn: '',
      manualAreaSqFt: '64',
      position: 1,
    }),
  ],
  ceilingScopes: [
    ceilingScope({
      id: estimateV2FunctionalCompletenessSmokeIds.ceilings.bathroom,
      roomId: BATHROOM_ID,
      scopeName: 'Bathroom ceiling',
      mode: 'SEG',
      lengthIn: '',
      widthIn: '',
      overridePaintGallons: '1.25',
    }),
  ],
  ceilingSegments: [
    ceilingSegment({
      id: estimateV2FunctionalCompletenessSmokeIds.ceilingSegments.bathroomManual,
      ceilingScopeId: estimateV2FunctionalCompletenessSmokeIds.ceilings.bathroom,
      roomId: BATHROOM_ID,
      segmentName: 'Bathroom manual ceiling',
      shapeType: 'MANUAL',
      widthIn: '',
      heightIn: '',
      manualAreaSqFt: '72',
    }),
  ],
  trimScopes: [
    trimScope({
      id: estimateV2FunctionalCompletenessSmokeIds.trim.bedroom,
      roomId: BEDROOM_ID,
      scopeName: 'Bedroom trim',
      helperValue: '52',
      position: 0,
    }),
    trimScope({
      id: estimateV2FunctionalCompletenessSmokeIds.trim.hallway,
      roomId: HALLWAY_ID,
      scopeName: 'Hallway trim',
      helperValue: '38',
      position: 0,
    }),
  ],
  doorScopes: [
    doorScope({
      id: estimateV2FunctionalCompletenessSmokeIds.doors.hallway,
      roomId: HALLWAY_ID,
      scopeName: 'Hallway doors',
      quantity: '3',
      sides: '2',
      doorTypeId: CANONICAL_IDS.doorTypes.panelDoor,
    }),
  ],
  drywallRepairs: [
    drywallRepair({
      id: estimateV2FunctionalCompletenessSmokeIds.drywall.bedroom,
      roomId: BEDROOM_ID,
      surface: 'ceiling',
      repairType: CANONICAL_IDS.drywallRates.ceilingPatch,
      quantity: '8',
    }),
  ],
  accessFees: [
    accessFee({
      id: estimateV2FunctionalCompletenessSmokeIds.accessFees.job,
      roomId: '',
      qty: '1',
      actualCostOverride: '160',
      notes: 'Job-level building access.',
      position: 0,
    }),
    accessFee({
      id: estimateV2FunctionalCompletenessSmokeIds.accessFees.bedroom,
      roomId: BEDROOM_ID,
      qty: '2',
      notes: 'Bedroom room-level ladder setup.',
      position: 1,
    }),
  ],
  prejobTrips: [
    prejobTrip({
      id: estimateV2FunctionalCompletenessSmokeIds.prejob.bedroomWallpaper,
      roomId: BEDROOM_ID,
      tripName: 'Bedroom wallpaper prep',
      tripCount: '1',
      tripRate: '125',
      manualAdjustment: '25',
      notes: 'Steam wallpaper seam before painting.',
      position: 0,
    }),
    prejobTrip({
      id: estimateV2FunctionalCompletenessSmokeIds.prejob.bedroomFurniture,
      roomId: BEDROOM_ID,
      tripName: 'Bedroom furniture prep',
      tripCount: '1',
      tripRate: '95',
      notes: 'Move furniture before work starts.',
      position: 1,
    }),
  ],
})

editorState.meta.estimate = {
  id: estimateV2FunctionalCompletenessSmokeIds.estimateId,
  org_id: estimateV2FunctionalCompletenessSmokeIds.orgId,
  job_id: estimateV2FunctionalCompletenessSmokeIds.jobId,
  version_name: scenarioName,
  version_state: 'draft',
  version_kind: 'quote',
  updated_at: '2026-05-05T12:00:00.000Z',
}
editorState.meta.job = {
  id: estimateV2FunctionalCompletenessSmokeIds.jobId,
  title: scenarioName,
  status: 'open',
  customer_id: estimateV2FunctionalCompletenessSmokeIds.customerId,
  customer_name: estimateV2FunctionalCompletenessSmokeIds.customerName,
  customer_address: estimateV2FunctionalCompletenessSmokeIds.customerAddress,
  customer_email: estimateV2FunctionalCompletenessSmokeIds.customerEmail,
  customer_phone: '555-0199',
}
editorState.meta.customerDraft = {
  customerId: estimateV2FunctionalCompletenessSmokeIds.customerId,
  name: estimateV2FunctionalCompletenessSmokeIds.customerName,
  email: estimateV2FunctionalCompletenessSmokeIds.customerEmail,
  phone: '555-0199',
  address: estimateV2FunctionalCompletenessSmokeIds.customerAddress,
}

export const expectedTotals: EstimateV2CanonicalFixture['expectedTotals'] = {
  finalTotal: 3500,
  rooms: [],
  scopeTotals: {
    walls: [
      {
        scopeId: estimateV2FunctionalCompletenessSmokeIds.walls.bedroom,
        roomId: BEDROOM_ID,
        total: 880,
      },
      {
        scopeId: estimateV2FunctionalCompletenessSmokeIds.walls.bedroomExcluded,
        roomId: BEDROOM_ID,
        total: 0,
      },
    ],
    ceilings: [],
    trim: [],
    doors: [],
    drywall: [],
    accessFees: [],
  },
}

export const estimateV2FunctionalCompletenessSmokeFixture: EstimateV2CanonicalFixture = {
  scenarioName,
  scenarioDescription,
  editorState,
  expectedTotals,
}
