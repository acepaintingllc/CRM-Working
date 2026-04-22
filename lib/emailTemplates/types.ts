import {
  errorResult,
  okResult,
  type ServiceError,
  type ServiceErrorKind,
  type ServiceResult,
  type ServiceSuccess,
} from '@/lib/server/serviceResult'

export type EmailTemplateRecord = {
  stage: string
  subject: string
  body: string
}

export type SaveEmailTemplateInput = EmailTemplateRecord

export type EmailTemplateServiceResult<T> = ServiceResult<T>
export type EmailTemplateServiceError = ServiceError
export type EmailTemplateServiceSuccess<T> = ServiceSuccess<T>
export type EmailTemplateServiceErrorKind = ServiceErrorKind

export function emailTemplateOk<T>(data: T): EmailTemplateServiceSuccess<T> {
  return okResult(data)
}

export function emailTemplateError(
  kind: EmailTemplateServiceErrorKind,
  message: string
): EmailTemplateServiceError {
  return errorResult(kind, message)
}
