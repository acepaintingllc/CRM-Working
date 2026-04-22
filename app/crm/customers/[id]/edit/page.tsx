'use client'

import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
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
import { UserRoundCog } from 'lucide-react'

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
    <CrmPageShell className="max-w-3xl">
      <CrmPageHeader
        eyebrow="Relationship hub"
        emoji="🛠️"
        title="Edit customer"
        description="Update customer details using the shared CRM profile form."
        backHref={returnPath}
        backLabel="Back"
        meta={<UserRoundCog size={16} aria-hidden="true" />}
      />

      {resource.error ? <CrmNotice tone="error">{resource.error}</CrmNotice> : null}

      <CrmSectionCard title={resource.loading ? 'Loading customer' : 'Customer profile'}>
        {resource.loading ? <div className="text-sm text-[color:var(--crm-ui-muted)]">Loading customer...</div> : null}

        {!resource.loading && resource.data.initialValues ? (
          <CustomerForm
            initialValues={resource.data.initialValues}
            legacyAddressCleanup={resource.data.legacyAddressCleanup}
            onSubmit={patchCustomer}
            submitLabel="Save changes"
            submittingLabel="Saving..."
            onCancel={() => router.push(returnPath)}
          />
        ) : null}
      </CrmSectionCard>
    </CrmPageShell>
  )
}
