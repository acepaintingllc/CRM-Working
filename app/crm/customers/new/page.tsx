"use client";

import { CustomerForm } from '@/app/crm/customers/_components/CustomerForm'
import { createCustomer as createCustomerRequest } from '@/lib/customers/client'
import type { CustomerFormValues } from '@/lib/customers/forms'
import type { CreateCustomerInput } from '@/lib/customers/types'
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";

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
    <div className="p-6 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold inline-flex items-center gap-2">
          <UserPlus size={20} aria-hidden="true" />
          <span>New customer</span>
        </h1>
        <Link
          href="/crm/customers"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back</span>
        </Link>
      </div>

      <CustomerForm
        onSubmit={createCustomer}
        submitLabel="Create customer"
        submittingLabel="Saving..."
      />
    </div>
  );
}
