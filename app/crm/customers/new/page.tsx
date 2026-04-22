"use client";

import { CrmEntityFormPage } from '@/app/crm/_components/CrmEntityFormPage'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CustomerForm } from '@/app/crm/customers/_components/CustomerForm'
import { useCustomerCreatePage } from '@/app/crm/customers/_hooks/useCustomerCreatePage'
import { UserPlus } from "lucide-react";

export default function NewCustomerPage() {
  const controller = useCustomerCreatePage()

  return (
    <CrmPageShell className="max-w-3xl">
      <CrmPageHeader
        eyebrow="Relationship hub"
        emoji="ðŸ‘¤"
        title="New customer"
        description="Create a shared CRM customer profile before attaching jobs, estimates, and communication."
        backHref="/crm/customers"
        backLabel="Back to customers"
        meta={<UserPlus size={16} aria-hidden="true" />}
      />

      <CrmEntityFormPage
        title="Customer profile"
        description="Use the shared CRM form system for all standard customer fields."
        error={controller.error}
        notice={controller.notice}
        validationError={controller.validationError}
        saveLabel="Create customer"
        savingLabel="Saving..."
        saving={controller.saving}
        canSave={controller.canSave}
        actions={null}
        onSave={() => void controller.save()}
      >
        <CustomerForm
          value={controller.value}
          onChange={controller.setValue}
          onSubmit={() => void controller.save()}
          submitLabel="Create customer"
          submittingLabel="Saving..."
          saving={controller.saving}
        />
      </CrmEntityFormPage>
    </CrmPageShell>
  );
}
