'use client'

import { useResource } from './useResource'

type LoadableResourceOptions<T> = {
  initialData: T
  load: () => Promise<T>
  getErrorMessage: (error: unknown) => string
  reloadKey?: unknown
}

export function useLoadableResource<T>({
  initialData,
  load,
  getErrorMessage,
  reloadKey,
}: LoadableResourceOptions<T>) {
  return useResource({
    initialData,
    load,
    getErrorMessage,
    reloadKey,
    resetOnError: true,
  })
}
