'use client'

import { CustomerForm } from '@/app/crm/customers/_components/CustomerForm'
import { readJsonResponse } from '@/app/crm/customers/_lib/http'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  customerRecordToFormValues,
  type CustomerFormValues,
  type CustomerLegacyAddressCleanup,
} from '@/lib/customers/forms'
import type { CustomerDetail, UpdateCustomerInput } from '@/lib/customers/types'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, UserRoundCog } from 'lucide-react'

function safeReturnPath(value: string | null, id: string | undefined) {
  if (!value) return id ? `/crm/customers/${id}` : '/crm/customers'
  if (!value.startsWith('/')) return id ? `/crm/customers/${id}` : '/crm/customers'
  return value
}

export default function EditCustomerPage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnPath = useMemo(
    () => safeReturnPath(searchParams.get('returnTo'), id),
    [searchParams, id]
  )

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [initialValues, setInitialValues] = useState<CustomerFormValues | null>(null)
  const [legacyAddressCleanup, setLegacyAddressCleanup] = useState<CustomerLegacyAddressCleanup | null>(null)

  useEffect(() => {
    let ignore = false

    async function load() {
      if (!id || typeof id !== 'string') {
        setErr('Missing customer id.')
        setLoading(false)
        return
      }

      setErr(null)
      setLoading(true)

      const response = await authedFetch(`/api/customers/${id}`, { cache: 'no-store' })
      const payload = await readJsonResponse<{ customer?: CustomerDetail; error?: string }>(response)

      if (!response.ok) {
        if (!ignore) {
          setErr(payload?.error ?? 'Failed to load customer.')
          setLoading(false)
        }
        return
      }

      const customer = payload?.customer ?? null
      const formValues = customer ? customerRecordToFormValues(customer) : null

      if (!ignore) {
        if (formValues && !formValues.ok) {
          setErr(formValues.error)
          setInitialValues(null)
          setLegacyAddressCleanup(null)
        } else {
          setInitialValues(formValues?.value.values ?? null)
          setLegacyAddressCleanup(formValues?.value.legacyAddressCleanup ?? null)
        }
        setLoading(false)
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [id])

  async function patchCustomer(values: CustomerFormValues) {
    if (!id || typeof id !== 'string') {
      throw new Error('Missing customer id.')
    }

    const payload: UpdateCustomerInput = {
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      street: values.street || null,
      city: values.city || null,
      state: values.state || null,
      zip: values.zip || null,
      notes: null,
    }

    const response = await authedFetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await readJsonResponse<{ error?: string }>(response)
    if (!response.ok) {
      throw new Error(result?.error ?? 'Failed to update customer.')
    }

    router.push(returnPath)
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold inline-flex items-center gap-2">
          <UserRoundCog size={20} aria-hidden="true" />
          <span>Edit customer</span>
        </h1>
        <button
          type="button"
          onClick={() => router.push(returnPath)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back</span>
        </button>
      </div>

      {err && <div className="text-red-600">{err}</div>}
      {loading && <div className="text-sm text-gray-600">Loading customer...</div>}

      {!loading && initialValues && (
        <CustomerForm
          initialValues={initialValues}
          legacyAddressCleanup={legacyAddressCleanup}
          onSubmit={patchCustomer}
          submitLabel="Save changes"
          submittingLabel="Saving..."
          onCancel={() => router.push(returnPath)}
        />
      )}
    </div>
  )
}
