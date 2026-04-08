'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

type JobHeader = {
  id: string
  title: string
  status: string
}

type PrepLevel = 'low' | 'med' | 'high'
type ColorGroup = 'A' | 'B' | 'C' | 'D'
const COLOR_ORDER: ColorGroup[] = ['A', 'B', 'C', 'D']

type SimpleWallDefaults = {
  wall_paint_product: string
  default_prep: PrepLevel
}

type SimpleCeilingDefaults = {
  ceiling_paint_product: string
  roller_cover_size: string
  crown_present: boolean
  ceilings_only: boolean
  default_prep: PrepLevel
}

type SimpleCeilingRoom = {
  id?: string
  room_name: string
  ceiling_type: string
  obstructions: string
  length_ft: number | null
  width_ft: number | null
  height_ft: number | null
  coats: number | null
  prep_override: PrepLevel | null
}

type SimpleTrimDefaults = {
  default_prep: PrepLevel
}

type SimpleTrimItem = {
  id?: string
  item_activity: string
  quantity: number | null
  coats: number | null
  prep_override: PrepLevel | null
}

type SimpleTrimPaint = {
  id?: string
  paint_product: string
  gallons_input: number | null
}

type SimpleWallColorGroup = {
  color_group: ColorGroup
  roller_nap: string
  extra_setup_minutes: number | null
  extra_supplies_allowance: number | null
}

type SimpleWallRoomDetail = {
  id?: string
  room_name: string
  color_group: ColorGroup
  coats_override: number | null
  prep_override: PrepLevel | null
}

type SimpleWallRoom = {
  id?: string
  room_name: string
  length_ft: number | null
  width_ft: number | null
  height_ft: number | null
  include_walls: boolean
  include_ceilings: boolean
  include_trim: boolean
  color_group: ColorGroup
  coats_override: number | null
  prep_override: PrepLevel | null
}

type EstimateOptions = {
  wallPaintOptions: string[]
  wallRollerNapOptions: string[]
  ceilingPaintOptions: string[]
  ceilingRollerCoverOptions: string[]
  ceilingTypeOptions: string[]
  ceilingObstructionOptions: string[]
  trimItemOptions: string[]
  trimPaintOptions: string[]
}

type SimpleSummary = {
  wall_total_sqft: string
  wall_total_supply_cost: string
  wall_total_paint_gal: string
  wall_total_paint_cost: string
  estimate_total: string
  missingRanges: string[]
}

type SimpleSheet = {
  id: string
  webViewLink: string | null
  editUrl: string | null
}

const MAX_SIMPLE_ROOMS = 10

const defaultSimpleWallDefaults = (): SimpleWallDefaults => ({
  wall_paint_product: '',
  default_prep: 'med',
})

const defaultSimpleCeilingDefaults = (): SimpleCeilingDefaults => ({
  ceiling_paint_product: '',
  roller_cover_size: 'N/A',
  crown_present: false,
  ceilings_only: false,
  default_prep: 'med',
})

const createEmptyCeilingRoom = (): SimpleCeilingRoom => ({
  room_name: '',
  ceiling_type: 'N/A',
  obstructions: 'N/A',
  length_ft: null,
  width_ft: null,
  height_ft: null,
  coats: null,
  prep_override: null,
})

const defaultSimpleTrimDefaults = (): SimpleTrimDefaults => ({
  default_prep: 'med',
})

const createEmptyTrimItem = (): SimpleTrimItem => ({
  item_activity: 'N/A',
  quantity: null,
  coats: null,
  prep_override: null,
})

const createEmptyTrimPaint = (): SimpleTrimPaint => ({
  paint_product: '',
  gallons_input: null,
})

const defaultColorGroups = (): SimpleWallColorGroup[] => ([
  { color_group: 'A', roller_nap: '', extra_setup_minutes: null, extra_supplies_allowance: null },
  { color_group: 'B', roller_nap: '', extra_setup_minutes: null, extra_supplies_allowance: null },
  { color_group: 'C', roller_nap: '', extra_setup_minutes: null, extra_supplies_allowance: null },
  { color_group: 'D', roller_nap: '', extra_setup_minutes: null, extra_supplies_allowance: null },
])

const createEmptySimpleRoom = (): SimpleWallRoom => ({
  room_name: '',
  length_ft: null,
  width_ft: null,
  height_ft: null,
  include_walls: true,
  include_ceilings: false,
  include_trim: false,
  color_group: 'A',
  coats_override: null,
  prep_override: null,
})

const createEmptyWallRoomDetail = (): SimpleWallRoomDetail => ({
  room_name: '',
  color_group: 'A',
  coats_override: null,
  prep_override: null,
})

const emptySimpleSummary = (): SimpleSummary => ({
  wall_total_sqft: '',
  wall_total_supply_cost: '',
  wall_total_paint_gal: '',
  wall_total_paint_cost: '',
  estimate_total: '',
  missingRanges: [],
})

export default function SimpleEstimatePage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()

  const [job, setJob] = useState<JobHeader | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [estimateOptions, setEstimateOptions] = useState<EstimateOptions>({
    wallPaintOptions: [],
    wallRollerNapOptions: [],
    ceilingPaintOptions: [],
    ceilingRollerCoverOptions: [],
    ceilingTypeOptions: [],
    ceilingObstructionOptions: [],
    trimItemOptions: [],
    trimPaintOptions: [],
  })
  const [simpleDefaults, setSimpleDefaults] = useState<SimpleWallDefaults>(
    defaultSimpleWallDefaults
  )
  const [simpleRooms, setSimpleRooms] = useState<SimpleWallRoom[]>([
    createEmptySimpleRoom(),
  ])
  const [wallRooms, setWallRooms] = useState<SimpleWallRoomDetail[]>([createEmptyWallRoomDetail()])
  const [ceilingDefaults, setCeilingDefaults] = useState<SimpleCeilingDefaults>(
    defaultSimpleCeilingDefaults
  )
  const [ceilingRooms, setCeilingRooms] = useState<SimpleCeilingRoom[]>([createEmptyCeilingRoom()])
  const [trimDefaults, setTrimDefaults] = useState<SimpleTrimDefaults>(defaultSimpleTrimDefaults)
  const [trimItems, setTrimItems] = useState<SimpleTrimItem[]>([createEmptyTrimItem()])
  const [trimPaints, setTrimPaints] = useState<SimpleTrimPaint[]>([createEmptyTrimPaint()])
  const [colorGroups, setColorGroups] = useState<SimpleWallColorGroup[]>(defaultColorGroups)
  const [colorCount, setColorCount] = useState(1)
  const [savingSimple, setSavingSimple] = useState(false)
  const [generatingSimplePdf, setGeneratingSimplePdf] = useState(false)
  const [simpleSummary, setSimpleSummary] = useState<SimpleSummary | null>(null)
  const [simpleSheet, setSimpleSheet] = useState<SimpleSheet | null>(null)
  const [sheetBusy, setSheetBusy] = useState(false)

  useEffect(() => {
    if (!id || typeof id !== 'string') {
      setLoading(false)
      setError('Missing job id in URL.')
      return
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      const [jobRes, optionsRes, simpleRes] = await Promise.all([
        fetch(`/api/jobs/${id}`, { cache: 'no-store' }),
        fetch('/api/estimate-options', { cache: 'no-store' }),
        fetch(`/api/jobs/${id}/simple-wall-estimate`, { cache: 'no-store' }),
      ])

      const jobPayload = await jobRes.json().catch(() => null)
      if (!jobRes.ok) {
        setError(jobPayload?.error ?? jobRes.statusText)
        setLoading(false)
        return
      }

      const jobRow = jobPayload?.job
      setJob({
        id: String(jobRow?.id ?? id),
        title: String(jobRow?.title ?? 'Job'),
        status: String(jobRow?.status ?? ''),
      })

      const optionsPayload = await optionsRes.json().catch(() => null)
      if (optionsRes.ok) {
        setEstimateOptions({
          wallPaintOptions: Array.isArray(optionsPayload?.wallPaintOptions)
            ? optionsPayload.wallPaintOptions
            : [],
          wallRollerNapOptions: Array.isArray(optionsPayload?.wallRollerNapOptions)
            ? optionsPayload.wallRollerNapOptions
            : [],
          ceilingPaintOptions: Array.isArray(optionsPayload?.ceilingPaintOptions)
            ? optionsPayload.ceilingPaintOptions
            : [],
          ceilingRollerCoverOptions: Array.isArray(optionsPayload?.ceilingRollerCoverOptions)
            ? optionsPayload.ceilingRollerCoverOptions
            : [],
          ceilingTypeOptions: Array.isArray(optionsPayload?.ceilingTypeOptions)
            ? optionsPayload.ceilingTypeOptions
            : [],
          ceilingObstructionOptions: Array.isArray(optionsPayload?.ceilingObstructionOptions)
            ? optionsPayload.ceilingObstructionOptions
            : [],
          trimItemOptions: Array.isArray(optionsPayload?.trimItemOptions)
            ? optionsPayload.trimItemOptions
            : [],
          trimPaintOptions: Array.isArray(optionsPayload?.trimPaintOptions)
            ? optionsPayload.trimPaintOptions
            : [],
        })
      }

      const simplePayload = await simpleRes.json().catch(() => null)
      if (simpleRes.ok && simplePayload?.estimate) {
        const defaults = simplePayload.estimate.defaults
        const wallRooms = Array.isArray(simplePayload.estimate.rooms)
          ? simplePayload.estimate.rooms
          : []
        const sharedRooms = Array.isArray(simplePayload.estimate.shared_rooms)
          ? simplePayload.estimate.shared_rooms
          : []
        const ceilingRowsRaw = Array.isArray(simplePayload.estimate?.ceilings?.rooms)
          ? simplePayload.estimate.ceilings.rooms
          : []
        const wallByName = new Map<string, Unsafe>(
          wallRooms.map((room: Unsafe) => [String(room?.room_name ?? '').trim().toLowerCase(), room])
        )
        const ceilingByName = new Map<string, Unsafe>(
          ceilingRowsRaw.map((room: Unsafe) => [String(room?.room_name ?? '').trim().toLowerCase(), room])
        )
        const rooms = sharedRooms.length
          ? sharedRooms
          : wallRooms
        setSimpleDefaults({
          wall_paint_product: defaults?.wall_paint_product ?? '',
          default_prep: (defaults?.default_prep as PrepLevel) ?? 'med',
        })
        const nextRooms =
          rooms.length
            ? rooms.map((room: Unsafe) => ({
                id: room.id,
                room_name: room.room_name ?? '',
                length_ft:
                  room.length_ft == null || Number.isNaN(Number(room.length_ft))
                    ? null
                    : Number(room.length_ft),
                width_ft:
                  room.width_ft == null || Number.isNaN(Number(room.width_ft))
                    ? null
                    : Number(room.width_ft),
                height_ft:
                  room.height_ft == null || Number.isNaN(Number(room.height_ft))
                    ? null
                    : Number(room.height_ft),
                include_walls:
                  sharedRooms.length > 0
                    ? Boolean(room?.include_walls ?? true)
                    : true,
                include_ceilings:
                  sharedRooms.length > 0
                    ? Boolean(room?.include_ceilings ?? false)
                    : ceilingByName.has(String(room?.room_name ?? '').trim().toLowerCase()),
                include_trim:
                  sharedRooms.length > 0
                    ? Boolean(room?.include_trim ?? false)
                    : false,
                color_group:
                  ((wallByName.get(String(room?.room_name ?? '').trim().toLowerCase())?.color_group ??
                    room.color_group) as ColorGroup) ?? 'A',
                coats_override:
                  (wallByName.get(String(room?.room_name ?? '').trim().toLowerCase())?.coats_override ??
                    room.coats_override) == null ||
                  Number.isNaN(
                    Number(
                      wallByName.get(String(room?.room_name ?? '').trim().toLowerCase())?.coats_override ??
                        room.coats_override
                    )
                  )
                    ? null
                    : Number(
                        wallByName.get(String(room?.room_name ?? '').trim().toLowerCase())?.coats_override ??
                          room.coats_override
                      ),
                prep_override:
                  (wallByName.get(String(room?.room_name ?? '').trim().toLowerCase())?.prep_override ??
                  room.prep_override)
                    ? ((wallByName.get(String(room?.room_name ?? '').trim().toLowerCase())?.prep_override ??
                        room.prep_override) as PrepLevel)
                    : null,
              }))
            : [createEmptySimpleRoom()]
        setSimpleRooms(nextRooms)
        const nextWallRooms = nextRooms
          .filter((room: SimpleWallRoom) => room.include_walls)
          .map((room: SimpleWallRoom) => ({
            room_name: room.room_name,
            color_group: room.color_group,
            coats_override: room.coats_override,
            prep_override: room.prep_override,
          }))
        setWallRooms(nextWallRooms.length ? nextWallRooms : [createEmptyWallRoomDetail()])
        const rawGroups = Array.isArray(simplePayload.estimate.color_groups)
          ? simplePayload.estimate.color_groups
          : []
        const normalizedGroups = defaultColorGroups().map((group) => {
          const match = rawGroups.find(
            (row: Unsafe) => String(row?.color_group ?? '').toUpperCase() === group.color_group
          )
          return {
            color_group: group.color_group,
            roller_nap: match?.roller_nap ?? '',
            extra_setup_minutes:
              match?.extra_setup_minutes == null ||
              Number.isNaN(Number(match.extra_setup_minutes))
                ? null
                : Number(match.extra_setup_minutes),
            extra_supplies_allowance:
              match?.extra_supplies_allowance == null ||
              Number.isNaN(Number(match.extra_supplies_allowance))
                ? null
                : Number(match.extra_supplies_allowance),
          }
        })
        setColorGroups(normalizedGroups)
        const usedColors = rooms.map((room: Unsafe) =>
          String(room?.color_group ?? 'A').toUpperCase()
        )
        const usedMax = usedColors.reduce((acc: number, value: string) => {
          const idx = COLOR_ORDER.indexOf(value as ColorGroup)
          return idx >= 0 ? Math.max(acc, idx + 1) : acc
        }, 1)
        const hasGroupValues = normalizedGroups.reduce((acc, row) => {
          if (row.roller_nap || row.extra_setup_minutes != null || row.extra_supplies_allowance != null) {
            return Math.max(acc, COLOR_ORDER.indexOf(row.color_group) + 1)
          }
          return acc
        }, 1)
        setColorCount(Math.max(usedMax, hasGroupValues, 1))

        const ceilings = simplePayload.estimate.ceilings
        const ceilingDefaultsPayload = ceilings?.defaults
        setCeilingDefaults({
          ceiling_paint_product: ceilingDefaultsPayload?.ceiling_paint_product ?? '',
          roller_cover_size: ceilingDefaultsPayload?.roller_cover_size ?? 'N/A',
          crown_present: Boolean(ceilingDefaultsPayload?.crown_present ?? false),
          ceilings_only: Boolean(ceilingDefaultsPayload?.ceilings_only ?? false),
          default_prep: (ceilingDefaultsPayload?.default_prep as PrepLevel) ?? 'med',
        })
        const ceilingRoomRows = Array.isArray(ceilings?.rooms) ? ceilings.rooms : []
        setCeilingRooms(
          ceilingRoomRows.length
            ? ceilingRoomRows.map((room: Unsafe) => ({
                id: room.id,
                room_name: room.room_name ?? '',
                ceiling_type: room.ceiling_type ?? 'N/A',
                obstructions: room.obstructions ?? 'N/A',
                length_ft: null,
                width_ft: null,
                height_ft: null,
                coats:
                  room.coats == null || Number.isNaN(Number(room.coats)) ? null : Number(room.coats),
                prep_override: room.prep_override ? (room.prep_override as PrepLevel) : null,
              }))
            : [createEmptyCeilingRoom()]
        )

        const trim = simplePayload.estimate.trim
        const trimDefaultsPayload = trim?.defaults
        setTrimDefaults({
          default_prep: (trimDefaultsPayload?.default_prep as PrepLevel) ?? 'med',
        })
        const trimRows = Array.isArray(trim?.items) ? trim.items : []
        setTrimItems(
          trimRows.length
            ? trimRows.map((row: Unsafe) => ({
                id: row.id,
                item_activity: row.item_activity ?? 'N/A',
                quantity:
                  row.quantity == null || Number.isNaN(Number(row.quantity))
                    ? null
                    : Number(row.quantity),
                coats:
                  row.coats == null || Number.isNaN(Number(row.coats)) ? null : Number(row.coats),
                prep_override: row.prep_override ? (row.prep_override as PrepLevel) : null,
              }))
            : [createEmptyTrimItem()]
        )
        const trimPaintRows = Array.isArray(trim?.paints) ? trim.paints : []
        setTrimPaints(
          trimPaintRows.length
            ? trimPaintRows.map((row: Unsafe) => ({
                id: row.id,
                paint_product: row.paint_product ?? '',
                gallons_input:
                  row.gallons_input == null || Number.isNaN(Number(row.gallons_input))
                    ? null
                    : Number(row.gallons_input),
              }))
            : [createEmptyTrimPaint()]
        )
        setSimpleSheet(
          simplePayload?.sheet?.id
            ? {
                id: String(simplePayload.sheet.id),
                webViewLink: simplePayload.sheet.webViewLink ?? null,
                editUrl: simplePayload.sheet.editUrl ?? null,
              }
            : null
        )
      } else {
        setSimpleDefaults(defaultSimpleWallDefaults())
        setSimpleRooms([createEmptySimpleRoom()])
        setWallRooms([createEmptyWallRoomDetail()])
        setCeilingDefaults(defaultSimpleCeilingDefaults())
        setCeilingRooms([createEmptyCeilingRoom()])
        setTrimDefaults(defaultSimpleTrimDefaults())
        setTrimItems([createEmptyTrimItem()])
        setTrimPaints([createEmptyTrimPaint()])
        setColorGroups(defaultColorGroups())
        setColorCount(1)
        setSimpleSheet(null)
      }

      setLoading(false)
    }

    void load()
  }, [id])

  const updateSimpleDefaults = (patch: Partial<SimpleWallDefaults>) => {
    setSimpleDefaults((prev) => ({ ...prev, ...patch }))
  }

  const updateSimpleRoom = (index: number, patch: Partial<SimpleWallRoom>) => {
    setSimpleRooms((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  const syncRoomSelection = (
    roomNameRaw: string,
    includeWalls: boolean,
    includeCeilings: boolean
  ) => {
    const roomName = roomNameRaw.trim()
    if (!roomName) return
    const roomKey = roomName.toLowerCase()

    setWallRooms((prev) => {
      const existing = prev.find((row) => row.room_name.trim().toLowerCase() === roomKey)
      if (includeWalls) {
        if (existing) return prev
        const cleaned = prev.filter((row) => row.room_name.trim())
        return [...cleaned, { ...createEmptyWallRoomDetail(), room_name: roomName }]
      }
      const filtered = prev.filter((row) => row.room_name.trim().toLowerCase() !== roomKey)
      return filtered.length ? filtered : [createEmptyWallRoomDetail()]
    })

    setCeilingRooms((prev) => {
      const existing = prev.find((row) => row.room_name.trim().toLowerCase() === roomKey)
      if (includeCeilings) {
        if (existing) return prev
        const cleaned = prev.filter((row) => row.room_name.trim())
        return [...cleaned, { ...createEmptyCeilingRoom(), room_name: roomName }]
      }
      const filtered = prev.filter((row) => row.room_name.trim().toLowerCase() !== roomKey)
      return filtered.length ? filtered : [createEmptyCeilingRoom()]
    })
  }

  const updateRoomName = (index: number, roomName: string) => {
    const prevRoom = simpleRooms[index]
    updateSimpleRoom(index, { room_name: roomName })
    if (!prevRoom) return
    const oldKey = prevRoom.room_name.trim().toLowerCase()
    const newName = roomName.trim()
    if (!newName) return
    if (!oldKey || oldKey === newName.toLowerCase()) {
      syncRoomSelection(newName, prevRoom.include_walls, prevRoom.include_ceilings)
      return
    }

    setWallRooms((prev) =>
      prev.map((row) =>
        row.room_name.trim().toLowerCase() === oldKey ? { ...row, room_name: newName } : row
      )
    )
    setCeilingRooms((prev) =>
      prev.map((row) =>
        row.room_name.trim().toLowerCase() === oldKey ? { ...row, room_name: newName } : row
      )
    )
    syncRoomSelection(newName, prevRoom.include_walls, prevRoom.include_ceilings)
  }

  const addSimpleRoom = () => {
    setSimpleRooms((prev) => {
      if (prev.length >= MAX_SIMPLE_ROOMS) return prev
      return [...prev, createEmptySimpleRoom()]
    })
  }

  const removeSimpleRoom = (index: number) => {
    setSimpleRooms((prev) => {
      const removed = prev[index]
      const next = prev.length <= 1 ? [createEmptySimpleRoom()] : prev.filter((_, i) => i !== index)
      if (removed?.room_name) {
        const key = removed.room_name.trim().toLowerCase()
        setWallRooms((rows) => {
          const filtered = rows.filter((row) => row.room_name.trim().toLowerCase() !== key)
          return filtered.length ? filtered : [createEmptyWallRoomDetail()]
        })
        setCeilingRooms((rows) => {
          const filtered = rows.filter((row) => row.room_name.trim().toLowerCase() !== key)
          return filtered.length ? filtered : [createEmptyCeilingRoom()]
        })
      }
      return next
    })
  }

  const updateCeilingDefaults = (patch: Partial<SimpleCeilingDefaults>) => {
    setCeilingDefaults((prev) => ({ ...prev, ...patch }))
  }

  const updateWallRoom = (index: number, patch: Partial<SimpleWallRoomDetail>) => {
    setWallRooms((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addWallRoom = () => {
    setWallRooms((prev) => {
      if (prev.length >= MAX_SIMPLE_ROOMS) return prev
      return [...prev, createEmptyWallRoomDetail()]
    })
  }

  const removeWallRoom = (index: number) => {
    setWallRooms((prev) => {
      if (prev.length <= 1) return [createEmptyWallRoomDetail()]
      return prev.filter((_, i) => i !== index)
    })
  }

  const updateCeilingRoom = (index: number, patch: Partial<SimpleCeilingRoom>) => {
    setCeilingRooms((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  const addCeilingRoom = () => {
    setCeilingRooms((prev) => {
      if (prev.length >= MAX_SIMPLE_ROOMS) return prev
      return [...prev, createEmptyCeilingRoom()]
    })
  }

  const removeCeilingRoom = (index: number) => {
    setCeilingRooms((prev) => {
      if (prev.length <= 1) return [createEmptyCeilingRoom()]
      return prev.filter((_, i) => i !== index)
    })
  }

  const updateTrimDefaults = (patch: Partial<SimpleTrimDefaults>) => {
    setTrimDefaults((prev) => ({ ...prev, ...patch }))
  }

  const updateTrimItem = (index: number, patch: Partial<SimpleTrimItem>) => {
    setTrimItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  const updateTrimPaint = (index: number, patch: Partial<SimpleTrimPaint>) => {
    setTrimPaints((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  const addTrimItem = () => {
    setTrimItems((prev) => {
      if (prev.length >= MAX_SIMPLE_ROOMS) return prev
      return [...prev, createEmptyTrimItem()]
    })
  }

  const removeTrimItem = (index: number) => {
    setTrimItems((prev) => {
      if (prev.length <= 1) return [createEmptyTrimItem()]
      return prev.filter((_, i) => i !== index)
    })
  }

  const addTrimPaint = () => {
    setTrimPaints((prev) => {
      if (prev.length >= 8) return prev
      return [...prev, createEmptyTrimPaint()]
    })
  }

  const removeTrimPaint = (index: number) => {
    setTrimPaints((prev) => {
      if (prev.length <= 1) return [createEmptyTrimPaint()]
      return prev.filter((_, i) => i !== index)
    })
  }

  const wallTotals = useMemo(() => {
    let wallSqft = 0
    for (const row of simpleRooms) {
      const l = Number(row.length_ft ?? 0)
      const w = Number(row.width_ft ?? 0)
      const h = Number(row.height_ft ?? 0)
      if (l > 0 && w > 0 && h > 0) {
        wallSqft += 2 * (l + w) * h
      }
    }
    return {
      roomCount: simpleRooms.length,
      wallSqft: Number.isFinite(wallSqft) ? wallSqft : 0,
    }
  }, [simpleRooms])

  const hasWallsSelected = useMemo(
    () => simpleRooms.some((room) => room.include_walls),
    [simpleRooms]
  )
  const hasCeilingsSelected = useMemo(
    () => simpleRooms.some((room) => room.include_ceilings),
    [simpleRooms]
  )
  const hasTrimSelected = useMemo(
    () => simpleRooms.some((room) => room.include_trim),
    [simpleRooms]
  )

  const roomNameOptions = useMemo(() => {
    const names = [
      ...simpleRooms.map((r) => String(r.room_name ?? '').trim()),
      ...ceilingRooms.map((r) => String(r.room_name ?? '').trim()),
    ].filter(Boolean)
    return Array.from(new Set(names))
  }, [simpleRooms, ceilingRooms])

  const parseNullableNumber = (value: string) => {
    if (!value.trim()) return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }

  const validateSimpleWallEstimate = () => {
    for (let i = 0; i < simpleRooms.length; i++) {
      const room = simpleRooms[i]
      const roomNumber = i + 1
      if (!room.room_name.trim()) return `Room ${roomNumber}: room name is required.`
      if (!room.length_ft || Number(room.length_ft) <= 0)
        return `Room ${roomNumber}: length must be greater than 0.`
      if (!room.width_ft || Number(room.width_ft) <= 0)
        return `Room ${roomNumber}: width must be greater than 0.`
      if (!room.height_ft || Number(room.height_ft) <= 0)
        return `Room ${roomNumber}: height must be greater than 0.`
      if (room.include_walls) {
        if (room.coats_override == null || Number(room.coats_override) <= 0) {
          return `Room ${roomNumber}: coats must be greater than 0 for walls.`
        }
        const colorIndex = COLOR_ORDER.indexOf(room.color_group)
        if (colorIndex === -1 || colorIndex + 1 > colorCount) {
          return `Room ${roomNumber}: color group must be within selected colors.`
        }
      }
    }

    const activeWallRows = wallRooms.filter((row) => row.room_name.trim())
    const selectedWallNames = new Set(
      simpleRooms
        .filter((room) => room.include_walls)
        .map((room) => room.room_name.trim().toLowerCase())
    )
    if (hasWallsSelected && activeWallRows.length < 1) {
      return 'Walls: add at least one wall room.'
    }
    const usedColors = new Set(
      activeWallRows
        .filter((row) => selectedWallNames.has(row.room_name.trim().toLowerCase()))
        .map((row) => row.color_group)
    )
    for (const group of colorGroups.slice(0, colorCount)) {
      if (!usedColors.has(group.color_group)) continue
      if (!group.roller_nap.trim()) {
        return `Color ${group.color_group}: roller nap is required.`
      }
      if (group.extra_setup_minutes != null && Number(group.extra_setup_minutes) < 0) {
        return `Color ${group.color_group}: extra setup minutes must be 0 or greater.`
      }
      if (group.extra_supplies_allowance != null && Number(group.extra_supplies_allowance) < 0) {
        return `Color ${group.color_group}: extra supplies allowance must be 0 or greater.`
      }
    }

    const sharedCeilingNames = new Set(
      simpleRooms
        .filter((room) => room.include_ceilings)
        .map((room) => room.room_name.trim().toLowerCase())
    )
    const activeCeilingRooms = ceilingRooms.filter((room) => room.room_name.trim())
    if (hasCeilingsSelected && activeCeilingRooms.length) {
      if (!ceilingDefaults.ceiling_paint_product.trim()) {
        return 'Ceilings: master ceiling paint is required when adding ceiling rooms.'
      }

      for (let i = 0; i < activeCeilingRooms.length; i++) {
        const room = activeCeilingRooms[i]
        const roomNumber = i + 1
        const key = room.room_name.trim().toLowerCase()
        if (!sharedCeilingNames.has(key)) {
          return `Ceiling room ${roomNumber}: select a room that is checked for ceilings.`
        }
        if (room.coats == null || Number(room.coats) <= 0) {
          return `Ceiling room ${roomNumber}: coats must be greater than 0.`
        }
      }
    }

    const activeTrimItems = trimItems.filter(
      (row) => row.item_activity.trim() && row.item_activity.trim().toLowerCase() !== 'n/a'
    )
    if (hasTrimSelected && activeTrimItems.length) {
      for (let i = 0; i < activeTrimItems.length; i++) {
        const row = activeTrimItems[i]
        const rowNumber = i + 1
        if (row.quantity == null || Number(row.quantity) <= 0) {
          return `Trim item ${rowNumber}: quantity must be greater than 0.`
        }
        if (row.coats == null || Number(row.coats) <= 0) {
          return `Trim item ${rowNumber}: coats must be greater than 0.`
        }
      }
    }

    if (hasTrimSelected) {
      const activePaintRows = trimPaints.filter((row) => row.paint_product.trim())
      for (let i = 0; i < activePaintRows.length; i++) {
        const row = activePaintRows[i]
        const rowNumber = i + 1
        if (row.gallons_input == null || Number(row.gallons_input) <= 0) {
          return `Trim paint row ${rowNumber}: gallons must be greater than 0.`
        }
      }
    }

    return null
  }

  const buildSimpleWallEstimatePayload = () => {
    const preferredNap =
      colorGroups.find((group) => group.color_group === 'A')?.roller_nap.trim() ?? ''
    const fallbackNap =
      colorGroups.find((group) => group.roller_nap.trim())?.roller_nap.trim() ?? ''
    const sectionNap = preferredNap || fallbackNap
    const visibleColors = colorGroups.slice(0, colorCount)
    const selectedWallNames = new Set(
      simpleRooms
        .filter((room) => room.include_walls)
        .map((room) => room.room_name.trim().toLowerCase())
    )
    const selectedWallRows = wallRooms
      .filter((row) => row.room_name.trim())
      .filter((row) => selectedWallNames.has(row.room_name.trim().toLowerCase()))
    const roomDimMap = new Map(
      simpleRooms.map((room) => [room.room_name.trim().toLowerCase(), room])
    )
    const activeCeilingNames = new Set(
      simpleRooms
        .filter((room) => room.include_ceilings)
        .map((room) => room.room_name.trim().toLowerCase())
    )
    const selectedCeilingRows = ceilingRooms
      .filter((room) => room.room_name.trim())
      .filter((room) => activeCeilingNames.has(room.room_name.trim().toLowerCase()))
      .map((room) => {
        const shared = roomDimMap.get(room.room_name.trim().toLowerCase())
        return {
          room_name: room.room_name.trim(),
          ceiling_type: room.ceiling_type.trim(),
          obstructions: room.obstructions.trim(),
          length_ft: shared?.length_ft ?? null,
          width_ft: shared?.width_ft ?? null,
          height_ft: shared?.height_ft ?? null,
          coats: room.coats,
          prep_override: room.prep_override,
        }
      })

    return {
      defaults: {
        wall_paint_product: simpleDefaults.wall_paint_product,
        wall_roller_nap: sectionNap,
        default_coats: 2,
        default_prep: simpleDefaults.default_prep,
        default_extra_setup_minutes: null,
        default_extra_supplies_note: '',
        default_extra_supplies_allowance: null,
      },
      color_groups: visibleColors.map((group) => ({
        color_group: group.color_group,
        roller_nap: group.roller_nap.trim(),
        extra_setup_minutes: group.extra_setup_minutes,
        extra_supplies_allowance: group.extra_supplies_allowance,
      })),
      shared_rooms: simpleRooms.map((room) => ({
        room_name: room.room_name.trim(),
        length_ft: room.length_ft,
        width_ft: room.width_ft,
        height_ft: room.height_ft,
        include_walls: room.include_walls,
        include_ceilings: room.include_ceilings,
        include_trim: room.include_trim,
      })),
      rooms: selectedWallRows.map((room) => {
        const shared = roomDimMap.get(room.room_name.trim().toLowerCase())
        return ({
        room_name: room.room_name.trim(),
        length_ft: shared?.length_ft ?? null,
        width_ft: shared?.width_ft ?? null,
        height_ft: shared?.height_ft ?? null,
        color_group: room.color_group,
        coats_override: room.coats_override,
        prep_override: room.prep_override,
        extra_setup_minutes: null,
        extra_supplies_note: '',
        extra_supplies_allowance: null,
        })
      }),
      ceilings: {
        defaults: {
          ceiling_paint_product: ceilingDefaults.ceiling_paint_product,
          roller_cover_size: ceilingDefaults.roller_cover_size,
          crown_present: ceilingDefaults.crown_present,
          ceilings_only: ceilingDefaults.ceilings_only,
          default_prep: ceilingDefaults.default_prep,
        },
        rooms: selectedCeilingRows,
      },
      trim: {
        defaults: {
          default_prep: trimDefaults.default_prep,
        },
        items: (hasTrimSelected ? trimItems : []).map((row) => ({
          item_activity: row.item_activity.trim(),
          quantity: row.quantity,
          coats: row.coats,
          prep_override: row.prep_override,
        })),
        paints: (hasTrimSelected ? trimPaints : []).map((row) => ({
          paint_product: row.paint_product.trim(),
          gallons_input: row.gallons_input,
        })),
      },
    }
  }

  const saveSimpleWallEstimate = async () => {
    if (!id || typeof id !== 'string') return false
    const validationError = validateSimpleWallEstimate()
    if (validationError) {
      setError(validationError)
      return false
    }

    setSavingSimple(true)
    setError(null)
    const res = await fetch(`/api/jobs/${id}/simple-wall-estimate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSimpleWallEstimatePayload()),
    })
    const payload = await res.json().catch(() => null)
    setSavingSimple(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return false
    }
    setNotice('Simple wall estimate saved')
    window.setTimeout(() => setNotice(null), 2000)
    const sheet = await syncSimpleSheet(simpleSheet?.id ? 'update' : 'create')
    if (!sheet) return false
    return true
  }

  const syncSimpleSheet = async (action: 'create' | 'update') => {
    if (!id || typeof id !== 'string') return null
    setSheetBusy(true)
    setError(null)
    const res = await fetch(`/api/jobs/${id}/simple-wall-estimate/sheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const payload = await res.json().catch(() => null)
    setSheetBusy(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return null
    }
    if (payload?.sheet?.id) {
      setSimpleSheet({
        id: String(payload.sheet.id),
        webViewLink: payload.sheet.webViewLink ?? null,
        editUrl: payload.sheet.editUrl ?? null,
      })
      setNotice(action === 'create' ? 'Estimate sheet created' : 'Estimate sheet updated')
      window.setTimeout(() => setNotice(null), 2000)
    }
    return payload?.sheet ?? null
  }

  const normalizeSimpleSummary = (value: Unsafe): SimpleSummary => ({
    wall_total_sqft: String(value?.wall_total_sqft ?? ''),
    wall_total_supply_cost: String(value?.wall_total_supply_cost ?? ''),
    wall_total_paint_gal: String(value?.wall_total_paint_gal ?? ''),
    wall_total_paint_cost: String(value?.wall_total_paint_cost ?? ''),
    estimate_total: String(value?.estimate_total ?? ''),
    missingRanges: Array.isArray(value?.missingRanges)
      ? value.missingRanges.map((v: Unsafe) => String(v))
      : [],
  })

  const generateSimpleWallPdf = async () => {
    if (!id || typeof id !== 'string') return
    const ok = await saveSimpleWallEstimate()
    if (!ok) return

    setGeneratingSimplePdf(true)
    setSimpleSummary(null)
    setError(null)
    const res = await fetch(`/api/jobs/${id}/simple-wall-estimate/generate-pdf`, {
      method: 'POST',
    })
    const payload = await res.json().catch(() => null)
    setGeneratingSimplePdf(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }

    setSimpleSummary(normalizeSimpleSummary(payload?.summary ?? emptySimpleSummary()))
    const pdfUrl = payload?.pdf?.webViewLink ?? null
    const sheetUrl = payload?.sheet?.webViewLink ?? payload?.sheet?.editUrl ?? null
    if (typeof pdfUrl === 'string' && pdfUrl) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer')
    } else if (typeof sheetUrl === 'string' && sheetUrl) {
      window.open(sheetUrl, '_blank', 'noopener,noreferrer')
    }
    setNotice('Simple estimate PDF generated')
    window.setTimeout(() => setNotice(null), 2500)
  }

  return (
    <div className="crm-page" style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 12 }}>
      <div className="crm-topbar" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#173427' }}>Simple estimate</h1>
          <p style={{ margin: 0, color: 'var(--crm-muted)' }}>
            {job?.title ?? 'Job'} {job?.status ? `(${job.status.replaceAll('_', ' ')})` : ''}
          </p>
        </div>
        <div className="crm-actions">
          <Link href={`/crm/jobs/${id}`} style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Back to details
          </Link>
        </div>
      </div>

      <div className="crm-card se-card" style={{ borderRadius: 12, padding: 16 }}>
        {loading && <div style={{ color: 'var(--crm-muted)' }}>Loading simple estimate...</div>}
        {!loading && error && (
          <div style={{ marginTop: 10, background: 'var(--crm-card)', border: '1px solid #fecaca', borderRadius: 12, padding: 12, color: '#991b1b' }}>
            {error}
          </div>
        )}
        {!loading && notice && (
          <div style={{ marginTop: 10, background: 'var(--crm-card)', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12, color: '#166534' }}>
            {notice}
          </div>
        )}

        {!loading && job && (
          <>
            <datalist id="simple-room-names">
              {roomNameOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {job.status !== 'estimate_scheduled' && (
              <div style={{ marginTop: 10, background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 12, padding: 12, color: '#92400e' }}>
                Job must be in <strong>estimate_scheduled</strong> to generate the simple estimate PDF.
              </div>
            )}

            <div style={sectionTitle}>
              Rooms ({simpleRooms.length}/{MAX_SIMPLE_ROOMS})
            </div>
            <div className="se-scroll">
              <div
                className="se-grid se-rooms-grid"
                style={{
                  marginTop: 6,
                  display: 'grid',
                  gridTemplateColumns: '2fr repeat(3, 1fr) 0.7fr 0.7fr 0.7fr auto',
                  gap: 8,
                  ...gridHeaderText,
                }}
              >
                <div>Room</div>
                <div>Length</div>
                <div>Width</div>
                <div>Height</div>
                <div>Walls</div>
                <div>Ceilings</div>
                <div>Trim</div>
                <div>Actions</div>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {simpleRooms.map((room, index) => (
                  <div
                    key={room.id ?? `room-${index}`}
                    style={{ border: '1px solid #d9e5de', borderRadius: 10, padding: 10, background: 'var(--crm-card)' }}
                  >
                    <div className="se-grid se-rooms-grid" style={{ display: 'grid', gridTemplateColumns: '2fr repeat(3, 1fr) 0.7fr 0.7fr 0.7fr auto', gap: 8 }}>
                    <input
                      value={room.room_name}
                      onChange={(e) => updateRoomName(index, e.target.value)}
                      placeholder="Room"
                      list="simple-room-names"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={room.length_ft ?? ''}
                      onChange={(e) =>
                        updateSimpleRoom(index, { length_ft: parseNullableNumber(e.target.value) })
                      }
                      placeholder="Length"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={room.width_ft ?? ''}
                      onChange={(e) =>
                        updateSimpleRoom(index, { width_ft: parseNullableNumber(e.target.value) })
                      }
                      placeholder="Width"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={room.height_ft ?? ''}
                      onChange={(e) =>
                        updateSimpleRoom(index, { height_ft: parseNullableNumber(e.target.value) })
                      }
                      placeholder="Height"
                      style={inputStyle}
                    />
                    <input
                      type="checkbox"
                      checked={room.include_walls}
                      onChange={(e) => {
                        const next = e.target.checked
                        updateSimpleRoom(index, { include_walls: next })
                        syncRoomSelection(room.room_name, next, room.include_ceilings)
                      }}
                      style={{ alignSelf: 'center', justifySelf: 'center' }}
                    />
                    <input
                      type="checkbox"
                      checked={room.include_ceilings}
                      onChange={(e) => {
                        const next = e.target.checked
                        updateSimpleRoom(index, { include_ceilings: next })
                        syncRoomSelection(room.room_name, room.include_walls, next)
                      }}
                      style={{ alignSelf: 'center', justifySelf: 'center' }}
                    />
                    <input
                      type="checkbox"
                      checked={room.include_trim}
                      onChange={(e) => updateSimpleRoom(index, { include_trim: e.target.checked })}
                      style={{ alignSelf: 'center', justifySelf: 'center' }}
                    />
                    <button
                      onClick={() => removeSimpleRoom(index)}
                      style={{ ...smallButton, background: 'var(--crm-card)' }}
                    >
                      Remove
                    </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="crm-actions" style={{ gap: 8, marginTop: 10, alignItems: 'center' }}>
              <button
                onClick={() => addSimpleRoom()}
                disabled={simpleRooms.length >= MAX_SIMPLE_ROOMS}
                style={smallButton}
              >
                + Add room
              </button>
            </div>

            {hasCeilingsSelected && (
              <>
            <div style={sectionTitle}>
              Ceilings
            </div>

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <div style={smallLabel}>Master ceiling paint</div>
                <select
                  value={ceilingDefaults.ceiling_paint_product}
                  onChange={(e) => updateCeilingDefaults({ ceiling_paint_product: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Select paint</option>
                  {ceilingDefaults.ceiling_paint_product &&
                    !estimateOptions.ceilingPaintOptions.includes(ceilingDefaults.ceiling_paint_product) && (
                      <option value={ceilingDefaults.ceiling_paint_product}>
                        {ceilingDefaults.ceiling_paint_product}
                      </option>
                    )}
                  {estimateOptions.ceilingPaintOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <div style={smallLabel}>Default prep</div>
                <select
                  value={ceilingDefaults.default_prep}
                  onChange={(e) => updateCeilingDefaults({ default_prep: e.target.value as PrepLevel })}
                  style={inputStyle}
                >
                  <option value="low">Light</option>
                  <option value="med">Medium</option>
                  <option value="high">Heavy</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <div style={smallLabel}>Roller cover size</div>
                <select
                  value={ceilingDefaults.roller_cover_size}
                  onChange={(e) => updateCeilingDefaults({ roller_cover_size: e.target.value })}
                  style={inputStyle}
                >
                  <option value="N/A">N/A</option>
                  {estimateOptions.ceilingRollerCoverOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <div style={smallLabel}>Crown present?</div>
                <select
                  value={ceilingDefaults.crown_present ? 'Yes' : 'No'}
                  onChange={(e) => updateCeilingDefaults({ crown_present: e.target.value === 'Yes' })}
                  style={inputStyle}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <div style={smallLabel}>Ceilings only?</div>
                <select
                  value={ceilingDefaults.ceilings_only ? 'Yes' : 'No'}
                  onChange={(e) => updateCeilingDefaults({ ceilings_only: e.target.value === 'Yes' })}
                  style={inputStyle}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </label>
            </div>

            <div style={sectionTitle}>
              Ceiling rooms ({ceilingRooms.length}/{MAX_SIMPLE_ROOMS})
            </div>
            <div className="se-scroll">
              <div
                className="se-grid se-ceiling-grid"
                style={{
                  marginTop: 6,
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                  gap: 8,
                  ...gridHeaderText,
                }}
              >
                <div>Room</div>
                <div>Type</div>
                <div>Obstructions</div>
                <div>Coats</div>
                <div>Prep</div>
                <div>Actions</div>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {ceilingRooms.map((room, index) => (
                  <div
                    key={room.id ?? `ceiling-${index}`}
                    style={{ border: '1px solid #d9e5de', borderRadius: 10, padding: 10, background: 'var(--crm-card)' }}
                  >
                    <div className="se-grid se-ceiling-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8 }}>
                    <select
                      value={room.room_name}
                      onChange={(e) => updateCeilingRoom(index, { room_name: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Select room</option>
                      {simpleRooms
                        .filter((r) => r.include_ceilings)
                        .map((r) => r.room_name.trim())
                        .filter(Boolean)
                        .map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                    </select>
                    <select
                      value={room.ceiling_type}
                      onChange={(e) => updateCeilingRoom(index, { ceiling_type: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="N/A">N/A</option>
                      {room.ceiling_type &&
                        room.ceiling_type !== 'N/A' &&
                        !estimateOptions.ceilingTypeOptions.includes(room.ceiling_type) && (
                          <option value={room.ceiling_type}>{room.ceiling_type}</option>
                        )}
                      {estimateOptions.ceilingTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <select
                      value={room.obstructions}
                      onChange={(e) => updateCeilingRoom(index, { obstructions: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="N/A">N/A</option>
                      {room.obstructions &&
                        room.obstructions !== 'N/A' &&
                        !estimateOptions.ceilingObstructionOptions.includes(room.obstructions) && (
                          <option value={room.obstructions}>{room.obstructions}</option>
                        )}
                      {estimateOptions.ceilingObstructionOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={room.coats ?? ''}
                      onChange={(e) => updateCeilingRoom(index, { coats: parseNullableNumber(e.target.value) })}
                      placeholder="Coats"
                      style={inputStyle}
                    />
                    <select
                      value={room.prep_override ?? ''}
                      onChange={(e) =>
                        updateCeilingRoom(index, {
                          prep_override: e.target.value ? (e.target.value as PrepLevel) : null,
                        })
                      }
                      style={inputStyle}
                    >
                      <option value="">Prep default</option>
                      <option value="low">Light</option>
                      <option value="med">Medium</option>
                      <option value="high">Heavy</option>
                    </select>
                    <button
                      onClick={() => removeCeilingRoom(index)}
                      style={{ ...smallButton, background: 'var(--crm-card)' }}
                    >
                      Remove
                    </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                onClick={() => addCeilingRoom()}
                disabled={ceilingRooms.length >= MAX_SIMPLE_ROOMS}
                style={smallButton}
              >
                + Add ceiling room
              </button>
            </div>
              </>
            )}

            {hasTrimSelected && (
              <>
            <div style={sectionTitle}>
              Trim
            </div>

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <div style={smallLabel}>Default prep</div>
                <select
                  value={trimDefaults.default_prep}
                  onChange={(e) => updateTrimDefaults({ default_prep: e.target.value as PrepLevel })}
                  style={inputStyle}
                >
                  <option value="low">Light</option>
                  <option value="med">Medium</option>
                  <option value="high">Heavy</option>
                </select>
              </label>
            </div>

            <div className="se-scroll">
              <div className="se-grid se-trim-item-grid" style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, ...gridHeaderText }}>
                <div>Item / activity</div>
                <div>Quantity</div>
                <div>Coats</div>
                <div>Prep</div>
                <div>Actions</div>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {trimItems.map((row, index) => (
                  <div
                    key={row.id ?? `trim-${index}`}
                    style={{ border: '1px solid #d9e5de', borderRadius: 10, padding: 10, background: 'var(--crm-card)' }}
                  >
                    <div className="se-grid se-trim-item-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8 }}>
                    <select
                      value={row.item_activity}
                      onChange={(e) => updateTrimItem(index, { item_activity: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="N/A">N/A</option>
                      {row.item_activity &&
                        row.item_activity !== 'N/A' &&
                        !estimateOptions.trimItemOptions.includes(row.item_activity) && (
                          <option value={row.item_activity}>{row.item_activity}</option>
                        )}
                      {estimateOptions.trimItemOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={row.quantity ?? ''}
                      onChange={(e) => updateTrimItem(index, { quantity: parseNullableNumber(e.target.value) })}
                      placeholder="Qty"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min={0.25}
                      step={0.25}
                      value={row.coats ?? ''}
                      onChange={(e) => updateTrimItem(index, { coats: parseNullableNumber(e.target.value) })}
                      placeholder="Coats"
                      style={inputStyle}
                    />
                    <select
                      value={row.prep_override ?? ''}
                      onChange={(e) =>
                        updateTrimItem(index, {
                          prep_override: e.target.value ? (e.target.value as PrepLevel) : null,
                        })
                      }
                      style={inputStyle}
                    >
                      <option value="">Prep default</option>
                      <option value="low">Light</option>
                      <option value="med">Medium</option>
                      <option value="high">Heavy</option>
                    </select>
                    <button
                      onClick={() => removeTrimItem(index)}
                      style={{ ...smallButton, background: 'var(--crm-card)' }}
                    >
                      Remove
                    </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                onClick={() => addTrimItem()}
                disabled={trimItems.length >= MAX_SIMPLE_ROOMS}
                style={smallButton}
              >
                + Add trim item
              </button>
            </div>

            <div style={sectionTitle}>
              Trim paint options
            </div>
            <div className="se-scroll">
              <div className="se-grid se-trim-paint-grid" style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, ...gridHeaderText }}>
                <div>Paint</div>
                <div>Gallons</div>
                <div>Actions</div>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {trimPaints.map((row, index) => (
                  <div
                    key={row.id ?? `trim-paint-${index}`}
                    style={{ border: '1px solid #d9e5de', borderRadius: 10, padding: 10, background: 'var(--crm-card)' }}
                  >
                    <div className="se-grid se-trim-paint-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8 }}>
                    <select
                      value={row.paint_product}
                      onChange={(e) => updateTrimPaint(index, { paint_product: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Select paint</option>
                      {row.paint_product &&
                        !estimateOptions.trimPaintOptions.includes(row.paint_product) && (
                          <option value={row.paint_product}>{row.paint_product}</option>
                        )}
                      {estimateOptions.trimPaintOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      step={0.25}
                      value={row.gallons_input ?? ''}
                      onChange={(e) => updateTrimPaint(index, { gallons_input: parseNullableNumber(e.target.value) })}
                      placeholder="Gallons"
                      style={inputStyle}
                    />
                    <button
                      onClick={() => removeTrimPaint(index)}
                      style={{ ...smallButton, background: 'var(--crm-card)' }}
                    >
                      Remove
                    </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                onClick={() => addTrimPaint()}
                disabled={trimPaints.length >= 8}
                style={smallButton}
              >
                + Add trim paint
              </button>
            </div>
              </>
            )}

            {hasWallsSelected && (
              <>
                <div style={sectionTitle}>Walls</div>
                <div
                  style={{
                    marginTop: 12,
                    border: '1px solid #d9e5de',
                    borderRadius: 10,
                    padding: 10,
                    background: 'var(--crm-card)',
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ ...sectionTitle, marginTop: 0 }}>
                      Walls Color Groups (roller + setup + supplies)
                    </div>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={smallLabel}># of colors</div>
                      <select
                        value={colorCount}
                        onChange={(e) => {
                          const next = Math.min(4, Math.max(1, Number(e.target.value)))
                          setColorCount(next)
                          const maxColor = COLOR_ORDER[next - 1]
                          setWallRooms((prev) =>
                            prev.map((row) => {
                              const idx = COLOR_ORDER.indexOf(row.color_group)
                              if (idx === -1 || idx + 1 > next) {
                                return { ...row, color_group: maxColor }
                              }
                              return row
                            })
                          )
                        }}
                        style={{ ...inputStyle, minWidth: 90 }}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={smallLabel}>Wall paint</div>
                      <select
                        value={simpleDefaults.wall_paint_product}
                        onChange={(e) => updateSimpleDefaults({ wall_paint_product: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Select paint</option>
                        {simpleDefaults.wall_paint_product &&
                          !estimateOptions.wallPaintOptions.includes(simpleDefaults.wall_paint_product) && (
                            <option value={simpleDefaults.wall_paint_product}>
                              {simpleDefaults.wall_paint_product}
                            </option>
                          )}
                        {estimateOptions.wallPaintOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: 'grid', gap: 4 }}>
                      <div style={smallLabel}>Default prep</div>
                      <select
                        value={simpleDefaults.default_prep}
                        onChange={(e) =>
                          updateSimpleDefaults({ default_prep: e.target.value as PrepLevel })
                        }
                        style={inputStyle}
                      >
                        <option value="low">Light</option>
                        <option value="med">Medium</option>
                        <option value="high">Heavy</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="se-scroll">
                  <div className="se-grid se-color-grid" style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '0.7fr 1fr 1fr 1fr', gap: 8, ...gridHeaderText }}>
                    <div>Color</div>
                    <div>Roller nap</div>
                    <div>Extra setup min</div>
                    <div>Extra supplies $</div>
                  </div>
                  <div style={{ marginTop: 6, display: 'grid', gap: 8 }}>
                    {colorGroups.slice(0, colorCount).map((group) => (
                      <div
                        key={group.color_group}
                        style={{ border: '1px solid #d9e5de', borderRadius: 10, padding: 10, background: 'var(--crm-card)' }}
                      >
                        <div
                          className="se-grid se-color-grid"
                          style={{ display: 'grid', gridTemplateColumns: '0.7fr 1fr 1fr 1fr', gap: 8 }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, alignSelf: 'center' }}>
                            Color {group.color_group}
                          </div>
                          <select
                            value={group.roller_nap}
                            onChange={(e) =>
                              setColorGroups((prev) =>
                                prev.map((row) =>
                                  row.color_group === group.color_group
                                    ? { ...row, roller_nap: e.target.value }
                                    : row
                                )
                              )
                            }
                            style={inputStyle}
                          >
                            <option value="">Select roller nap</option>
                            {group.roller_nap &&
                              !estimateOptions.wallRollerNapOptions.includes(group.roller_nap) && (
                                <option value={group.roller_nap}>{group.roller_nap}</option>
                              )}
                            {estimateOptions.wallRollerNapOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            step={0.25}
                            value={group.extra_setup_minutes ?? ''}
                            onChange={(e) =>
                              setColorGroups((prev) =>
                                prev.map((row) =>
                                  row.color_group === group.color_group
                                    ? { ...row, extra_setup_minutes: parseNullableNumber(e.target.value) }
                                    : row
                                )
                              )
                            }
                            placeholder="0"
                            style={inputStyle}
                          />
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={group.extra_supplies_allowance ?? ''}
                            onChange={(e) =>
                              setColorGroups((prev) =>
                                prev.map((row) =>
                                  row.color_group === group.color_group
                                    ? { ...row, extra_supplies_allowance: parseNullableNumber(e.target.value) }
                                    : row
                                )
                              )
                            }
                            placeholder="0"
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={sectionTitle}>
                  Wall rooms ({wallRooms.length}/{MAX_SIMPLE_ROOMS})
                </div>
                <div className="se-scroll">
                  <div className="se-grid se-wall-room-grid" style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, ...gridHeaderText }}>
                    <div>Room</div>
                    <div>Coats</div>
                    <div>Color Group</div>
                    <div>Prep</div>
                    <div>Actions</div>
                  </div>
                  <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                    {wallRooms.map((room, index) => (
                      <div
                        key={room.id ?? `wall-${index}`}
                        style={{ border: '1px solid #d9e5de', borderRadius: 10, padding: 10, background: 'var(--crm-card)' }}
                      >
                        <div className="se-grid se-wall-room-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8 }}>
                        <select
                          value={room.room_name}
                          onChange={(e) => updateWallRoom(index, { room_name: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">Select room</option>
                          {simpleRooms
                            .filter((r) => r.include_walls)
                            .map((r) => r.room_name.trim())
                            .filter(Boolean)
                            .map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          min={0.25}
                          step={0.25}
                          value={room.coats_override ?? ''}
                          onChange={(e) => updateWallRoom(index, { coats_override: parseNullableNumber(e.target.value) })}
                          placeholder="Coats"
                          style={inputStyle}
                        />
                        <select
                          value={room.color_group}
                          onChange={(e) => updateWallRoom(index, { color_group: e.target.value as ColorGroup })}
                          style={inputStyle}
                        >
                          {COLOR_ORDER.slice(0, colorCount).map((color) => (
                            <option key={color} value={color}>
                              Color {color}
                            </option>
                          ))}
                        </select>
                        <select
                          value={room.prep_override ?? ''}
                          onChange={(e) =>
                            updateWallRoom(index, {
                              prep_override: e.target.value ? (e.target.value as PrepLevel) : null,
                            })
                          }
                          style={inputStyle}
                        >
                          <option value="">Prep default</option>
                          <option value="low">Light</option>
                          <option value="med">Medium</option>
                          <option value="high">Heavy</option>
                        </select>
                        <button onClick={() => removeWallRoom(index)} style={{ ...smallButton, background: 'var(--crm-card)' }}>
                          Remove
                        </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => addWallRoom()}
                    disabled={wallRooms.length >= MAX_SIMPLE_ROOMS}
                    style={smallButton}
                  >
                    + Add wall room
                  </button>
                </div>
              </>
            )}

            <div className="crm-actions se-actions" style={{ gap: 8, marginTop: 12, alignItems: 'center' }}>
              <button
                onClick={() => void saveSimpleWallEstimate()}
                disabled={savingSimple}
                style={smallButton}
              >
                {savingSimple ? 'Saving...' : 'Save simple estimate'}
              </button>
              <button
                onClick={() => void saveSimpleWallEstimate()}
                disabled={sheetBusy || savingSimple}
                style={smallButton}
              >
                {sheetBusy
                  ? 'Syncing sheet...'
                  : simpleSheet?.id
                    ? 'Save + update estimate sheet'
                    : 'Save + create estimate sheet'}
              </button>
              {simpleSheet?.webViewLink && (
                <a
                  href={simpleSheet.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  Open estimate sheet
                </a>
              )}
              <button
                onClick={() => void generateSimpleWallPdf()}
                disabled={generatingSimplePdf || job.status !== 'estimate_scheduled'}
                style={{ ...smallButton, background: 'var(--crm-accent)', color: 'var(--crm-accent-text)', border: '1px solid var(--crm-accent)' }}
              >
                {generatingSimplePdf ? 'Generating PDF...' : 'Generate simple estimate PDF'}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--crm-muted)' }}>
              Total wall sqft preview: {Math.round(wallTotals.wallSqft)} ({wallTotals.roomCount} rooms)
            </div>

            {simpleSummary && (
              <div
                style={{
                  marginTop: 10,
                  border: '1px solid var(--crm-border)',
                  borderRadius: 10,
                  background: 'var(--crm-card)',
                  padding: 10,
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div style={{ ...gridHeaderText, color: '#14532d' }}>
                  Calculated summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <div style={{ fontSize: 13 }}>Total wall sqft: {simpleSummary.wall_total_sqft || '-'}</div>
                  <div style={{ fontSize: 13 }}>Supply cost: {simpleSummary.wall_total_supply_cost || '-'}</div>
                  <div style={{ fontSize: 13 }}>Paint gallons: {simpleSummary.wall_total_paint_gal || '-'}</div>
                  <div style={{ fontSize: 13 }}>Paint cost: {simpleSummary.wall_total_paint_cost || '-'}</div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>
                    Estimate total: {simpleSummary.estimate_total || '-'}
                  </div>
                </div>

                {simpleSummary.missingRanges.length > 0 && (
                  <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, padding: 8 }}>
                    Summary unavailable for: {simpleSummary.missingRanges.join(', ')}. Add these named ranges in your template to show full checks here.
                  </div>
                )}

                <div className="crm-actions" style={{ gap: 8 }}>
                  <button
                    onClick={() => router.push(`/crm/jobs/${id}?compose=estimate_sent`)}
                    style={{ ...smallButton, background: 'var(--crm-accent)', color: 'var(--crm-accent-text)', border: '1px solid var(--crm-accent)' }}
                  >
                    Review &amp; send estimate
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <style jsx>{`
        .se-card {
          background: #f3f4f6;
          border: 1px solid #d2e2d8;
          box-shadow: 0 6px 18px rgba(21, 44, 33, 0.06);
        }
        .se-scroll {
          overflow-x: auto;
          padding-bottom: 2px;
        }
        .se-grid {
          min-width: 720px;
        }
        .se-rooms-grid {
          min-width: 940px;
        }
        .se-ceiling-grid {
          min-width: 860px;
        }
        .se-trim-item-grid {
          min-width: 760px;
        }
        .se-trim-paint-grid {
          min-width: 600px;
        }
        .se-color-grid {
          min-width: 700px;
        }
        .se-wall-room-grid {
          min-width: 780px;
        }
        @media (max-width: 900px) {
          .se-actions :global(button),
          .se-actions :global(a) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--crm-border)',
  borderRadius: 10,
  fontSize: 14,
  width: '100%',
  padding: '8px 10px',
}

const smallButton: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  border: '1px solid var(--crm-border)',
  background: 'var(--crm-card)',
  color: 'var(--crm-text)',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}

const smallLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#274636',
  textTransform: 'uppercase',
  letterSpacing: 0.25,
}

const sectionTitle: React.CSSProperties = {
  marginTop: 14,
  fontSize: 13,
  fontWeight: 900,
  color: '#f8fffb',
  textTransform: 'uppercase',
  letterSpacing: 0.35,
  background: '#2f5d46',
  border: '1px solid #2a523e',
  borderRadius: 8,
  padding: '7px 10px',
  display: 'inline-block',
}

const gridHeaderText: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#1f3c2f',
  textTransform: 'uppercase',
  letterSpacing: 0.2,
}
