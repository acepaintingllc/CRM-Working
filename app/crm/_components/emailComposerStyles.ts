import { crmInputClassName } from './crmStyles'

export const EMAIL_BODY_TEXTAREA_MIN_HEIGHT = 420
export const EMAIL_BODY_TEXTAREA_MIN_HEIGHT_CLASS = 'min-h-[420px]'
export const emailBodyTextareaStyle = { minHeight: EMAIL_BODY_TEXTAREA_MIN_HEIGHT }

export function emailBodyTextareaClassName(extraClassName = '') {
  return crmInputClassName(
    `${EMAIL_BODY_TEXTAREA_MIN_HEIGHT_CLASS} resize-y text-sm ${extraClassName}`.trim()
  )
}
