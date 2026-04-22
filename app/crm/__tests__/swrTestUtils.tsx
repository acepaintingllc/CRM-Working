import type { PropsWithChildren } from 'react'
import { SWRConfig } from 'swr'

export function createSWRWrapper() {
  const cache = new Map()

  return function SWRWrapper({ children }: PropsWithChildren) {
    return (
      <SWRConfig
        value={{
          provider: () => cache,
          dedupingInterval: 5000,
          revalidateOnFocus: false,
        }}
      >
        {children}
      </SWRConfig>
    )
  }
}
