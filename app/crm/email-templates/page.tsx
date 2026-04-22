'use client'

import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmPageHeader } from '@/app/crm/_components/CrmPageHeader'
import { CrmPageShell } from '@/app/crm/_components/CrmPageShell'
import { CrmResourceState } from '@/app/crm/_components/CrmResourceState'
import { EmailTemplateEditor } from './EmailTemplateEditor'
import {
  useEmailTemplatesController,
  emailTemplateStages,
} from './useEmailTemplatesController'

export default function EmailTemplatesPage() {
  const controller = useEmailTemplatesController()

  return (
    <CrmPageShell className="max-w-[900px]">
      <CrmPageHeader
        eyebrow="Message system"
        emoji="ðŸ“¬"
        title="Email templates"
        description="Draft templates per job stage. Variables will be filled later from the customer and job."
        badge={<CrmChip tone="accent">Settings-style editable resource</CrmChip>}
        backHref="/crm/settings/templates"
        backLabel="Back to templates"
      />

      <CrmResourceState
        loading={controller.loading}
        error={controller.error}
        hasData={controller.hasLoaded}
        loadingTitle="Loading email templates"
        loadingDescription="Loading email templates..."
        errorTitle="Email templates unavailable"
        onRetry={() => void controller.reload()}
      >
        <EmailTemplateEditor
          active={controller.active}
          activeLabel={controller.activeLabel}
          subject={controller.subject}
          body={controller.body}
          setActive={controller.setActive}
          setSubject={controller.setSubject}
          setBody={controller.setBody}
          insertVariable={controller.insertVariable}
          stages={emailTemplateStages}
          saving={controller.saving}
          canSave={controller.dirty && !controller.saving}
          error={controller.error}
          notice={controller.notice}
          onSave={() => void controller.saveChanges()}
        />
      </CrmResourceState>
    </CrmPageShell>
  )
}
