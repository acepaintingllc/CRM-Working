'use client'

import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { CustomerForm } from '@/app/crm/customers/_components/CustomerForm'
import {
  customerRecordToFormValues,
  type CustomerFormValues,
  type CustomerLegacyAddressCleanup,
} from '@/lib/customers/forms'
import { loadCustomerDetail, updateCustomer } from '@/lib/customers/client'
import type { UpdateCustomerInput } from '@/lib/customers/types'
import { useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, UserRoundCog } from 'lucide-react'

function safeReturnPath(value: string | null, id: string | undefined) {
  if (!value) return id ? `/crm/customers/${id}` : '/crm/customers'
  if (!value.startsWith('/')) return id ? `/crm/customers/${id}` : '/crm/customers'
  return value
}

type EditCustomerResource = {
  initialValues: CustomerFormValues | null
  legacyAddressCleanup: CustomerLegacyAddressCleanup | null
}

const emptyEditCustomerResource: EditCustomerResource = {
  initialValues: null,
  legacyAddressCleanup: null,
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
  const resource = useLoadableResource<EditCustomerResource>({
    initialData: emptyEditCustomerResource,
    load: async () => {
      if (!id || typeof id !== 'string') {
        throw new Error('Missing customer id.')
      }

      const customer = await loadCustomerDetail(id)
      const formValues = customer ? customerRecordToFormValues(customer) : null
      if (formValues && !formValues.ok) {
        throw new Error(formValues.error)
      }

      return {
        initialValues: formValues?.value.values ?? null,
        legacyAddressCleanup: formValues?.value.legacyAddressCleanup ?? null,
      }
    },
    getErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : 'Failed to load customer.',
    reloadKey: id,
  })

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

    await updateCustomer(id, payload)

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

      {resource.error && <div className="text-red-600">{resource.error}</div>}
      {resource.loading && <div className="text-sm text-gray-600">Loading customer...</div>}

      {!resource.loading && resource.data.initialValues && (
        <CustomerForm
          initialValues={resource.data.initialValues}
          legacyAddressCleanup={resource.data.legacyAddressCleanup}
          onSubmit={patchCustomer}
          submitLabel="Save changes"
          submittingLabel="Saving..."
          onCancel={() => router.push(returnPath)}
        />
      )}
    </div>
  )
}
