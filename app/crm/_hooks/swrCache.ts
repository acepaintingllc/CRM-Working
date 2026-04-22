'use client'

import { mutate } from 'swr'

export function invalidateSwrKey(key: string) {
  return mutate(key)
}

export function invalidateSwrPrefix(prefix: string) {
  return mutate((key) => typeof key === 'string' && key.startsWith(prefix))
}
