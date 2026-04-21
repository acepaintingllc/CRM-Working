'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import type {
  SettingsApiError,
  SettingsDataResponse,
  SettingsMutationResponse,
} from '@/lib/settings/types'

function getFallbackError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export async function loadSettingsData<T>(url: string, fallback: string) {
  try {
    const response = await authedFetch(url, { cache: 'no-store' })
    const payload = (await response.json().catch(() => null)) as
      | SettingsDataResponse<T>
      | SettingsApiError
      | null
    if (!response.ok) {
      throw new Error(payload && 'error' in payload ? payload.error : fallback)
    }
    return payload && 'data' in payload ? (payload.data as T) : (undefined as T)
  } catch (error) {
    throw new Error(getFallbackError(error, fallback))
  }
}

export async function saveSettingsData<T>(url: string, data: T, fallback: string) {
  try {
    const response = await authedFetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    const payload = (await response.json().catch(() => null)) as
      | SettingsMutationResponse<T>
      | SettingsApiError
      | null
    if (!response.ok) {
      throw new Error(payload && 'error' in payload ? payload.error : fallback)
    }
    return {
      data: payload && 'data' in payload ? (payload.data as T) : data,
      notice: payload && 'notice' in payload ? payload.notice ?? 'Saved.' : 'Saved.',
    }
  } catch (error) {
    throw new Error(getFallbackError(error, fallback))
  }
}
