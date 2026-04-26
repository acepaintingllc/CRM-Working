'use client'

import { useCallback, useRef, useState } from 'react'
import type { ScopeKind } from '@/lib/estimator/scopeKinds'

type ScopeRecord = Record<string, boolean>

export function useEstimateV2EditorPageUiState({
  selectedRoomId,
  roomScopeByRoomId,
  roomCeilingScopeByRoomId,
  toggleWallsInclude,
  toggleCeilingsInclude,
}: {
  selectedRoomId?: string
  roomScopeByRoomId: Map<string, Array<{ id: string; include: string }>>
  roomCeilingScopeByRoomId: Map<string, Array<{ id: string; include: string }>>
  toggleWallsInclude: (roomId: string) => void
  toggleCeilingsInclude: (roomId: string) => void
}) {
  const wallsSectionRef = useRef<HTMLDivElement | null>(null)
  const ceilingsSectionRef = useRef<HTMLDivElement | null>(null)
  const trimSectionRef = useRef<HTMLDivElement | null>(null)
  const [openWallsSection, setOpenWallsSection] = useState<ScopeRecord>({})
  const [openAdvanced, setOpenAdvanced] = useState<ScopeRecord>({})
  const [openCeilingSection, setOpenCeilingSection] = useState<ScopeRecord>({})
  const [openCeilingAdvanced, setOpenCeilingAdvanced] = useState<ScopeRecord>({})
  const [openTrimSection, setOpenTrimSection] = useState<ScopeRecord>({})
  const [openTrimAdvanced, setOpenTrimAdvanced] = useState<ScopeRecord>({})

  const toggleRoomWallInclude = useCallback(
    (roomId: string) => {
      const hasRoomScopes = (roomScopeByRoomId.get(roomId)?.length ?? 0) > 0
      toggleWallsInclude(roomId)
      if (!hasRoomScopes) {
        setOpenWallsSection((prev) => ({ ...prev, [roomId]: true }))
      }
    },
    [roomScopeByRoomId, toggleWallsInclude]
  )

  const toggleRoomCeilingInclude = useCallback(
    (roomId: string) => {
      const hasRoomScopes = (roomCeilingScopeByRoomId.get(roomId)?.length ?? 0) > 0
      toggleCeilingsInclude(roomId)
      if (!hasRoomScopes) {
        setOpenCeilingSection((prev) => ({ ...prev, [roomId]: true }))
      }
    },
    [roomCeilingScopeByRoomId, toggleCeilingsInclude]
  )

  const focusRoomSection = useCallback(
    (section: ScopeKind) => {
      if (!selectedRoomId) return

      const ref =
        section === 'walls'
          ? wallsSectionRef
          : section === 'ceilings'
            ? ceilingsSectionRef
            : trimSectionRef

      if (section === 'walls') {
        setOpenWallsSection((prev) => ({ ...prev, [selectedRoomId]: true }))
      } else if (section === 'ceilings') {
        setOpenCeilingSection((prev) => ({ ...prev, [selectedRoomId]: true }))
      } else {
        setOpenTrimSection((prev) => ({ ...prev, [selectedRoomId]: true }))
      }

      window.setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 40)
    },
    [selectedRoomId]
  )

  return {
    wallsSectionRef,
    ceilingsSectionRef,
    trimSectionRef,
    openWallsSection,
    setOpenWallsSection,
    openAdvanced,
    setOpenAdvanced,
    openCeilingSection,
    setOpenCeilingSection,
    openCeilingAdvanced,
    setOpenCeilingAdvanced,
    openTrimSection,
    setOpenTrimSection,
    openTrimAdvanced,
    setOpenTrimAdvanced,
    toggleRoomWallInclude,
    toggleRoomCeilingInclude,
    focusRoomSection,
  }
}
