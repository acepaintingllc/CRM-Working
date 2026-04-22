"use client";

import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { CustomerForm } from '@/app/crm/customers/_components/CustomerForm'
import { createCustomer as createCustomerRequest } from '@/lib/customers/client'
import type { CustomerFormValues } from '@/lib/customers/forms'
import type { CreateCustomerInput } from '@/lib/customers/types'
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

export default function NewCustomerPage() {
  const router = useRouter();

  async function createCustomer(values: CustomerFormValues) {
    const payload: CreateCustomerInput = {
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      street: values.street || null,
      city: values.city || null,
      state: values.state || null,
      zip: values.zip || null,
      notes: null,
    }

    await createCustomerRequest(payload)

    router.push("/crm/customers");
  }

  return (
    <CrmPageShell className="max-w-3xl">
      <CrmPageHeader
        eyebrow="Relationship hub"
        emoji="👤"
        title="New customer"
        description="Create a shared CRM customer profile before attaching jobs, estimates, and communication."
        backHref="/crm/customers"
        backLabel="Back to customers"
        meta={<UserPlus size={16} aria-hidden="true" />}
      />

      <CrmSectionCard title="Customer profile" description="Use the shared CRM form system for all standard customer fields.">
        <CustomerForm
          onSubmit={createCustomer}
          submitLabel="Create customer"
          submittingLabel="Saving..."
        />
      </CrmSectionCard>
    </CrmPageShell>
  );
}
