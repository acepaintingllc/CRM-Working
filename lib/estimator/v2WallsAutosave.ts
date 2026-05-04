export type SaveStatus = 'idle' | 'autosaving' | 'saved' | 'error' | 'blocked'

export function shouldQueueAutosave(params: { loading: boolean; saving: boolean; dirty: boolean }) {
  return !params.loading && !params.saving && params.dirty
}

export function createSaveRequestTracker() {
  let latestRequestId = 0
  return {
    start() {
      latestRequestId += 1
      return latestRequestId
    },
    isLatest(requestId: number) {
      return requestId === latestRequestId
    },
    latest() {
      return latestRequestId
    },
  }
}

export function getSaveStatusText(params: {
  saving: boolean
  saveStatus: SaveStatus
  dirty: boolean
  blockedReason: string | null
  error: string | null
  updatedAt: string | null
  formatDateTime: (value: string | null) => string
}) {
  if (params.saving) {
    return params.saveStatus === 'autosaving' ? 'Autosaving draft...' : 'Saving draft...'
  }
  if (params.saveStatus === 'error') {
    return params.error ?? 'Save failed'
  }
  if (params.saveStatus === 'blocked') {
    return params.blockedReason
      ? `Unsaved changes - save blocked: ${params.blockedReason}`
      : 'Unsaved changes - save blocked: fix validation issues'
  }
  if (params.dirty) {
    return 'Unsaved changes - ready to save'
  }
  return `Saved ${params.formatDateTime(params.updatedAt)}`
}
