'use client'

import { mutate } from 'swr'

export function invalidateSwrKey(key: string) {
  return mutate(key)
}
