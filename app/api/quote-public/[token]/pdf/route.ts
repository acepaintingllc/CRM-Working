import { resolveParams, jsonError } from '@/lib/server/apiRoute'
import { readCustomerSendPersistedPdf } from '@/lib/server/customer-send/types'
import { loadPublicEstimateByToken } from '@/lib/server/estimatePublicPortal'
import { downloadDriveFile } from '@/lib/server/googleDrive'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function contentDispositionFilename(filename: string) {
  const safe = asText(filename).replace(/["\r\n]/g, '_') || 'Quote.pdf'
  return `attachment; filename="${safe}"`
}

export async function GET(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await resolveParams(context)
  const token = asText((params as { token?: string } | null | undefined)?.token)
  if (!token) return jsonError('Invalid token', 400)

  const loaded = await loadPublicEstimateByToken(token, new URL(request.url).origin)
  if (!('version' in loaded) || !loaded.version) {
    return jsonError(asText(loaded.error) || 'Quote not found', 404)
  }

  const pdf = readCustomerSendPersistedPdf(loaded.version.snapshot_json)
  if (!pdf?.drive_file_id) {
    return jsonError('Quote PDF not found', 404)
  }

  const download = await downloadDriveFile({
    origin: new URL(request.url).origin,
    orgId: asText(loaded.version.org_id),
    userId: asText(loaded.version.created_by),
    fileId: pdf.drive_file_id,
  })
  if ('error' in download) {
    return jsonError(download.error || 'Unable to load quote PDF', 500)
  }

  return new Response(download.buffer, {
    headers: {
      'Content-Type': pdf.mime_type || 'application/pdf',
      'Content-Disposition': contentDispositionFilename(pdf.filename || pdf.drive_file_name),
      'Cache-Control': 'private, no-store',
    },
  })
}
