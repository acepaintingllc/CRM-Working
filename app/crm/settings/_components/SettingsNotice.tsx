import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import type { ReactNode } from 'react'

type SettingsNoticeProps = {
  tone: 'error' | 'success' | 'info'
  children: ReactNode
}

const toneMap: Record<SettingsNoticeProps['tone'], 'error' | 'success' | 'info'> = {
  error: 'error',
  success: 'success',
  info: 'info',
}

export function SettingsNotice(props: SettingsNoticeProps) {
  return <CrmNotice tone={toneMap[props.tone]}>{props.children}</CrmNotice>
}
