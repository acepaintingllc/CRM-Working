'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import type { NotesFolderDeleteResponse, NotesFolderResponse, NotesFolderWithCount } from '@/lib/notes/types'
import { useCallback, useMemo, useState } from 'react'
import { notesFetchJson, useNotesMutation } from './core'

export type FolderActionModalMode = 'rename' | 'delete_choice' | 'delete_move'

export type FolderActionModalState = {
  open: boolean
  mode: FolderActionModalMode | null
  folder: NotesFolderWithCount | null
  renameValue: string
  deleteTargetFolderId: string
  noteCount: number
}

type UseFolderActionsOptions = {
  folders: NotesFolderWithCount[]
  status: 'active' | 'archived'
  activeFolderId?: string | null
  refresh: () => Promise<void>
  onDeleteActiveFolder?: (() => Promise<void> | void) | null
}

const CLOSED_MODAL_STATE: FolderActionModalState = {
  open: false,
  mode: null,
  folder: null,
  renameValue: '',
  deleteTargetFolderId: '',
  noteCount: 0,
}

export function useFolderActions(options: UseFolderActionsOptions) {
  const [error, setError] = useState<string | null>(null)
  const [modalState, setModalState] = useState<FolderActionModalState>(CLOSED_MODAL_STATE)
  const { saving, runMutation } = useNotesMutation()

  const closeModal = useCallback(() => {
    setError(null)
    setModalState(CLOSED_MODAL_STATE)
  }, [])

  const afterDeleteSuccess = useCallback(
    async (folderId: string) => {
      closeModal()
      if (options.activeFolderId === folderId && options.onDeleteActiveFolder) {
        await options.onDeleteActiveFolder()
        return
      }
      await options.refresh()
    },
    [closeModal, options]
  )

  const createFolder = useCallback(
    async (name: string) => {
      if (!name.trim()) return false
      setError(null)
      const result = await runMutation<unknown>(
        () =>
          authedFetch('/api/notes/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim() }),
          }),
        {
          fallbackMessage: 'Unable to create folder.',
          refresh: options.refresh,
          onError: setError,
        }
      )
      return result.ok
    },
    [options.refresh, runMutation]
  )

  const renameFolder = useCallback(
    async (folderId: string, name: string) => {
      const nextName = name.trim()
      if (!nextName) {
        setError('Folder name is required.')
        return false
      }
      setError(null)
      const result = await runMutation<NotesFolderResponse>(
        () =>
          authedFetch(`/api/notes/folders/${folderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nextName }),
          }),
        {
          fallbackMessage: 'Unable to rename folder.',
          refresh: options.refresh,
          onError: setError,
          onSuccess: () => {
            closeModal()
          },
        }
      )
      return result.ok
    },
    [closeModal, options.refresh, runMutation]
  )

  const reorderFolder = useCallback(
    async (folderIdValue: string, direction: 'up' | 'down') => {
      const index = options.folders.findIndex((folder) => folder.id === folderIdValue)
      if (index < 0) return false

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= options.folders.length) return false

      const reordered = [...options.folders]
      const [folder] = reordered.splice(index, 1)
      reordered.splice(targetIndex, 0, folder)

      setError(null)
      const result = await runMutation<unknown>(
        () =>
          authedFetch('/api/notes/folders/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_ids: reordered.map((item) => item.id) }),
          }),
        {
          fallbackMessage: 'Unable to reorder folders.',
          refresh: options.refresh,
          onError: setError,
        }
      )
      return result.ok
    },
    [options.folders, options.refresh, runMutation]
  )

  const requestRename = useCallback((folder: NotesFolderWithCount) => {
    setError(null)
    setModalState({
      open: true,
      mode: 'rename',
      folder,
      renameValue: folder.name,
      deleteTargetFolderId: '',
      noteCount: 0,
    })
  }, [])

  const runDelete = useCallback(
    async (
      folder: NotesFolderWithCount,
      strategy?: 'uncategorize' | 'move_to_folder',
      targetFolderId?: string
    ) => {
      const body =
        strategy === 'move_to_folder'
          ? { strategy, target_folder_id: targetFolderId }
          : strategy
            ? { strategy }
            : undefined

      const deleteResult = await notesFetchJson<NotesFolderDeleteResponse>(
        `/api/notes/folders/${folder.id}`,
        {
          method: 'DELETE',
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        },
        'Unable to delete folder.'
      )

      if (deleteResult.ok) {
        await afterDeleteSuccess(folder.id)
        return true
      }

      const payload = deleteResult.payload as NotesFolderDeleteResponse | null
      if (!strategy && payload?.required) {
        setModalState({
          open: true,
          mode: 'delete_choice',
          folder,
          renameValue: folder.name,
          deleteTargetFolderId: '',
          noteCount: payload.notes_count ?? 0,
        })
        return false
      }

      setError(deleteResult.error)
      return false
    },
    [afterDeleteSuccess]
  )

  const requestDelete = useCallback(
    async (folder: NotesFolderWithCount) => {
      setError(null)
      return runDelete(folder)
    },
    [runDelete]
  )

  const submitRename = useCallback(async () => {
    if (!modalState.folder) return false
    return renameFolder(modalState.folder.id, modalState.renameValue)
  }, [modalState.folder, modalState.renameValue, renameFolder])

  const setRenameValue = useCallback((value: string) => {
    setModalState((current) => ({ ...current, renameValue: value }))
  }, [])

  const beginMoveDelete = useCallback(() => {
    setError(null)
    setModalState((current) => ({ ...current, mode: 'delete_move', deleteTargetFolderId: '' }))
  }, [])

  const setDeleteTargetFolderId = useCallback((value: string) => {
    setError(null)
    setModalState((current) => ({ ...current, deleteTargetFolderId: value }))
  }, [])

  const submitDelete = useCallback(
    async (strategy: 'uncategorize' | 'move_to_folder') => {
      if (!modalState.folder) return false
      if (strategy === 'move_to_folder') {
        const targetFolderId = modalState.deleteTargetFolderId
        if (!targetFolderId) {
          setError('Select a destination folder.')
          return false
        }
        return runDelete(modalState.folder, 'move_to_folder', targetFolderId)
      }
      return runDelete(modalState.folder, 'uncategorize')
    },
    [modalState.deleteTargetFolderId, modalState.folder, runDelete]
  )

  const availableMoveTargets = useMemo(() => {
    if (!modalState.folder) return []
    return options.folders.filter((row) => row.id !== modalState.folder?.id)
  }, [modalState.folder, options.folders])

  return {
    saving,
    error,
    createFolder,
    renameFolder,
    reorderFolder,
    requestRename,
    requestDelete,
    deleteFolder: requestDelete,
    modalState,
    closeModal,
    submitRename,
    submitDelete,
    beginMoveDelete,
    setDeleteTargetFolderId,
    setRenameValue,
    availableMoveTargets,
    status: options.status,
  }
}
