import { getValidAccessToken } from '@/lib/server/googleCalendar'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readGoogleErrorMessage(json: unknown) {
  const obj = asRecord(json)
  const err = asRecord(obj?.error)
  const msg = err?.message
  return typeof msg === 'string' ? msg : null
}

export async function runEstimatePdfScript(params: {
  origin: string
  orgId: string
  userId: string
  scriptId: string
  spreadsheetId: string
  outputFolderId: string
  pdfFileName: string
}) {
  const access = await getValidAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
  })
  if ('error' in access) return { error: access.error } as const

  const url = `https://script.googleapis.com/v1/scripts/${encodeURIComponent(params.scriptId)}:run`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      function: 'acecrmGenerateEstimatePdf',
      parameters: [params.spreadsheetId, params.outputFolderId, params.pdfFileName],
      devMode: false,
    }),
  })

  const json: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = readGoogleErrorMessage(json) ?? 'Failed to run estimate PDF script'
    return { error: msg, status: res.status } as const
  }

  const obj = asRecord(json)
  const scriptError = asRecord(obj?.error)
  if (scriptError) {
    const details = Array.isArray(scriptError.details) ? scriptError.details : []
    const first = details[0]
    const firstObj = asRecord(first)
    const detailMsg = firstObj?.errorMessage
    if (typeof detailMsg === 'string' && detailMsg) return { error: detailMsg } as const
    const msg = scriptError.message
    return { error: typeof msg === 'string' ? msg : 'Apps Script execution failed' } as const
  }

  const responseObj = asRecord(obj?.response)
  const resultObj = asRecord(responseObj?.result)
  if (!resultObj) {
    return { error: 'Apps Script did not return a valid result object' } as const
  }

  const id = resultObj.id
  const name = resultObj.name
  const webViewLink = resultObj.webViewLink
  if (typeof id !== 'string' || typeof name !== 'string') {
    return { error: 'Apps Script result is missing file id or name' } as const
  }

  return {
    pdf: {
      id,
      name,
      webViewLink: typeof webViewLink === 'string' ? webViewLink : null,
    },
  } as const
}
