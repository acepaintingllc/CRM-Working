export type SearchLike = URLSearchParams | { toString(): string } | null

function mergeSearchParams(searchParams: SearchLike, updates: Record<string, string | null | undefined>) {
  const params = new URLSearchParams(searchParams?.toString() ?? '')
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  return params
}

export function buildNotesModuleHref(
  pathname: string,
  searchParams: SearchLike,
  updates: Record<string, string | null | undefined>
) {
  const params = mergeSearchParams(searchParams, updates)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function buildNotesCloseHref(pathname: string, searchParams: SearchLike) {
  return buildNotesModuleHref(pathname, searchParams, {
    composer: null,
    taskId: null,
    noteId: null,
    folder: null,
  })
}
