import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
import type { JobReviewDataQualityStatus } from '@/types/jobs/feedback'
import type { JobReviewFormState } from '@/lib/estimate-feedback/forms'
import type { JobReviewVm } from '../_lib/jobReviewVm'

type ReviewClassificationSectionProps = {
  form: JobReviewFormState
  vm: JobReviewVm
  isReadOnly: boolean
  setField: <TField extends keyof JobReviewFormState>(
    field: TField,
    value: JobReviewFormState[TField]
  ) => void
}

const inputClass = crmInputClassName('text-sm')

export function ReviewClassificationSection({
  form,
  vm,
  isReadOnly,
  setField,
}: ReviewClassificationSectionProps) {
  return (
    <CrmSectionCard title="Root cause and quality" variant="rail">
      <div className="grid gap-4">
        <CrmField label="Cause tag">
          <select
            value={form.primary_cause_tag}
            onChange={(event) => setField('primary_cause_tag', event.target.value)}
            disabled={isReadOnly}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {vm.classificationOptions.causeTags.map((tag) => (
              <option key={tag.value} value={tag.value}>
                {tag.label}
              </option>
            ))}
          </select>
        </CrmField>

        <CrmField label="Review notes">
          <textarea
            value={form.review_notes}
            onChange={(event) => setField('review_notes', event.target.value)}
            disabled={isReadOnly}
            className={crmInputClassName('min-h-[130px] resize-y text-sm')}
          />
        </CrmField>

        <CrmField label="Data quality">
          <select
            value={form.data_quality_status}
            onChange={(event) =>
              setField(
                'data_quality_status',
                event.target.value as JobReviewDataQualityStatus
              )
            }
            disabled={isReadOnly}
            className={inputClass}
          >
            {vm.classificationOptions.dataQuality.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </CrmField>

        <label className="ace-crm-surface-muted flex items-start gap-3 p-3 text-sm font-bold text-[color:var(--crm-ui-text)]">
          <input
            type="checkbox"
            checked={form.change_order_present}
            onChange={(event) => setField('change_order_present', event.target.checked)}
            disabled={isReadOnly}
            className="mt-1"
          />
          <span>Change order present</span>
        </label>

        <label className="ace-crm-surface-muted flex items-start gap-3 p-3 text-sm font-bold text-[color:var(--crm-ui-text)]">
          <input
            type="checkbox"
            checked={form.exclude_from_trends}
            onChange={(event) => setField('exclude_from_trends', event.target.checked)}
            disabled={isReadOnly}
            className="mt-1"
          />
          <span>Exclude from trends</span>
        </label>

        <div className="ace-crm-surface p-3 text-xs leading-5 text-[color:var(--crm-ui-muted)]">
          {vm.lockedAt
            ? `Locked ${vm.lockedAt}`
            : vm.reviewedAt
              ? `Reviewed ${vm.reviewedAt}`
              : 'Not reviewed yet'}
        </div>
      </div>
    </CrmSectionCard>
  )
}
