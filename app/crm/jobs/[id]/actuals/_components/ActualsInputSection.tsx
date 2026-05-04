import { Save, Send } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import type { JobActualsStatus } from '@/types/jobs/feedback'
import type {
  JobActualsFieldValidation,
  JobActualsFormState,
  JobActualsNumericField,
} from '@/lib/estimate-feedback/forms'

type JobActualsInputFieldVm = {
  id: JobActualsNumericField
  label: string
  step: string
  help: string
}

type ActualsInputSectionProps = {
  form: JobActualsFormState
  fields: JobActualsInputFieldVm[]
  actualsStatus: JobActualsStatus | null
  saving: boolean
  submitting: boolean
  isReadOnly: boolean
  validation: JobActualsFieldValidation
  setField: (field: keyof JobActualsFormState, value: string) => void
  saveDraft: () => Promise<boolean>
  submit: () => Promise<boolean>
}

const numberInputClass = crmInputClassName('text-sm')

export function ActualsInputSection({
  form,
  fields,
  actualsStatus,
  saving,
  submitting,
  isReadOnly,
  validation,
  setField,
  saveDraft,
  submit,
}: ActualsInputSectionProps) {
  const hasInvalidActuals = Object.keys(validation).length > 0

  return (
    <CrmSectionCard title="Actuals input">
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <CrmField
              key={field.id}
              label={field.label}
              error={validation[field.id]}
              help={field.help}
            >
              <input
                type="number"
                min="0"
                step={field.step}
                value={form[field.id]}
                onChange={(event) => setField(field.id, event.target.value)}
                disabled={isReadOnly}
                aria-invalid={Boolean(validation[field.id]) || undefined}
                className={numberInputClass}
              />
            </CrmField>
          ))}
        </div>

        <CrmField label="Notes">
          <textarea
            value={form.notes}
            onChange={(event) => setField('notes', event.target.value)}
            disabled={isReadOnly}
            className={crmInputClassName('min-h-[130px] resize-y text-sm')}
          />
        </CrmField>

        <div className="flex flex-wrap gap-2">
          <CrmButton
            type="button"
            tone="secondary"
            onClick={() => void saveDraft()}
            disabled={saving || submitting || isReadOnly || hasInvalidActuals}
          >
            <Save size={15} aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save draft'}</span>
          </CrmButton>
          <CrmButton
            type="button"
            tone="primary"
            onClick={() => void submit()}
            disabled={saving || submitting || isReadOnly || hasInvalidActuals}
          >
            <Send size={15} aria-hidden="true" />
            <span>{submitting ? 'Submitting...' : 'Submit actuals'}</span>
          </CrmButton>
        </div>

        {hasInvalidActuals ? (
          <CrmNotice tone="warning" compact>
            Fix the highlighted actuals before saving or submitting.
          </CrmNotice>
        ) : null}

        {isReadOnly ? (
          <CrmNotice tone="info" compact>
            These actuals are {actualsStatus}. Draft edits are disabled.
          </CrmNotice>
        ) : null}
      </div>
    </CrmSectionCard>
  )
}
