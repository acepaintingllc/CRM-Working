'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EstimatorV2NewRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/crm/estimates/v2')
  }, [router])
  return null
}
