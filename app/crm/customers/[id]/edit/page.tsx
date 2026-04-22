'use client'

import { CrmEntityFormPage } from '@/app/crm/_components/CrmEntityFormPage'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { CustomerForm } from '@/app/crm/customers/_components/CustomerForm'
import { useCustomerEditPage } from '@/app/crm/customers/_hooks/useCustomerEditPage'
import { UserRoundCog } from 'lucide-react'

export default function EditCustomerPage() {
  const controller = useCustomerEditPage()

  return (
    <CrmPageShell className="max-w-3xl">
      <CrmPageHeader
        eyebrow="Relationship hub"
        emoji="ðŸ› ï¸"
        title="Edit customer"
        description="Update customer details using the shared CRM profile form."
        backHref={controller.returnTo}
        backLabel="Back"
        meta={<UserRoundCog size={16} aria-hidden="true" />}
      />

      <CrmResourceState
        loading={controller.resource.loading}
        error={controller.resource.error}
        hasData={controller.resource.hasLoaded}
        loadingTitle="Loading customer"
        loadingDescription="Loading customer..."
        errorTitle="Customer unavailable"
        onRetry={() => void controller.resource.reload()}
      >
        <CrmEntityFormPage
          title="Customer profile"
          error={controller.resource.error}
          notice={controller.resource.notice}
          validationError={controller.validationError}
          saveLabel="Save changes"
          savingLabel="Saving..."
          saving={controller.resource.saving}
          canSave={controller.canSave}
          actions={null}
          onSave={() => void controller.saveAndNavigate()}
        >
          <CustomerForm
            value={controller.resource.data.value}
            onChange={controller.setValue}
            legacyAddressCleanup={controller.resource.data.legacyAddressCleanup}
            onSubmit={() => void controller.saveAndNavigate()}
            submitLabel="Save changes"
            submittingLabel="Saving..."
            saving={controller.resource.saving}
          />
        </CrmEntityFormPage>
      </CrmResourceState>
    </CrmPageShell>
  )
}
