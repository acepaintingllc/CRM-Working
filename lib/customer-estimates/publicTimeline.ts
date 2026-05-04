import type {
  EstimatePublicTimelineEvent,
  EstimatePublicTimelineEventRow,
  EstimatePublicTimelineVersion,
} from '@/types/customer-estimates/publicTimeline'

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function publicQuoteLink(version: EstimatePublicTimelineVersion | null, metadata: Record<string, unknown> | null) {
  const publicUrl = asText(metadata?.publicUrl)
  if (publicUrl) return publicUrl
  const token = asText(version?.public_token)
  return token ? `/quote/${encodeURIComponent(token)}` : null
}

function eventTitle(type: string, resend: boolean) {
  if (type === 'sent') return resend ? 'Quote resent' : 'Quote sent'
  if (type === 'viewed') return 'Quote viewed'
  if (type === 'accepted') return 'Quote accepted'
  return null
}

export function buildEstimatePublicTimelineEvents(params: {
  versions: EstimatePublicTimelineVersion[]
  publicEvents: EstimatePublicTimelineEventRow[]
}): EstimatePublicTimelineEvent[] {
  const versionById = new Map(params.versions.map((version) => [version.id, version]))
  const publicUrlByVersionId = new Map<string, string>()
  for (const event of params.publicEvents) {
    const versionId = asText(event.estimate_public_version_id)
    const publicUrl = asText(event.metadata?.publicUrl)
    if (versionId && publicUrl && !publicUrlByVersionId.has(versionId)) {
      publicUrlByVersionId.set(versionId, publicUrl)
    }
  }
  const sentCountByVersion = new Map<string, number>()
  const eventBackedTimelineEvents = params.publicEvents
    .slice()
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .flatMap((event): EstimatePublicTimelineEvent[] => {
      const versionId = asText(event.estimate_public_version_id)
      const version = versionById.get(versionId) ?? null
      const eventType = asText(event.event_type)
      const isSent = eventType === 'sent'
      const sentCount = isSent ? (sentCountByVersion.get(versionId) ?? 0) + 1 : 0
      if (isSent) sentCountByVersion.set(versionId, sentCount)

      const title = eventTitle(eventType, sentCount > 1)
      if (!title) return []

      const publicLink = publicUrlByVersionId.get(versionId) ?? publicQuoteLink(version, event.metadata)
      const versionLabel =
        typeof version?.version_number === 'number' && Number.isFinite(version.version_number)
          ? `Public version #${version.version_number}`
          : 'Public quote'

      return [
        {
          id: `quote-event-${event.id}`,
          type: isSent && sentCount > 1 ? 'quote_resent' : `quote_${eventType}`,
          title,
          body: versionLabel,
          created_at: event.created_at ?? null,
          created_by: event.created_by ?? null,
          link_path: publicLink,
          link_label: publicLink ? 'Open quote' : null,
          source_estimate_id: version?.estimate_id ?? null,
          source_public_version_id: version?.id ?? null,
        },
      ]
    })
  const terminalEventTypesByVersionId = new Map<string, Set<string>>()
  for (const event of params.publicEvents) {
    const eventType = asText(event.event_type)
    if (eventType !== 'accepted' && eventType !== 'declined') continue
    const versionId = asText(event.estimate_public_version_id)
    if (!versionId) continue
    const eventTypes = terminalEventTypesByVersionId.get(versionId) ?? new Set<string>()
    eventTypes.add(eventType)
    terminalEventTypesByVersionId.set(versionId, eventTypes)
  }

  const fallbackTerminalEvents = params.versions.flatMap((version): EstimatePublicTimelineEvent[] => {
    const status = asText(version.status)
    if (status !== 'accepted' && status !== 'declined') return []
    if (terminalEventTypesByVersionId.get(version.id)?.has(status)) return []

    const createdAt = status === 'accepted' ? asText(version.accepted_at) : asText(version.declined_at)
    if (!createdAt) return []

    const publicLink = publicUrlByVersionId.get(version.id) ?? publicQuoteLink(version, null)
    const versionLabel =
      typeof version.version_number === 'number' && Number.isFinite(version.version_number)
        ? `Public version #${version.version_number}`
        : 'Public quote'

    return [
      {
        id: `quote-event-${status}-${version.id}`,
        type: `quote_${status}`,
        title: status === 'accepted' ? 'Quote accepted' : 'Quote declined',
        body: versionLabel,
        created_at: createdAt,
        created_by: null,
        link_path: publicLink,
        link_label: publicLink ? 'Open quote' : null,
        source_estimate_id: version.estimate_id ?? null,
        source_public_version_id: version.id,
      },
    ]
  })

  return [...eventBackedTimelineEvents, ...fallbackTerminalEvents]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}
