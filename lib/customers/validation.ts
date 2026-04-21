export type CustomerAddressParts = {
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  address?: string | null
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function buildCustomerAddress(parts: CustomerAddressParts) {
  const street = asTrimmedString(parts.street)
  const city = asTrimmedString(parts.city)
  const state = asTrimmedString(parts.state)
  const zip = asTrimmedString(parts.zip)

  const cityStateZip = [state, zip].filter(Boolean).join(' ').trim()
  const assembled = [street, city ? (cityStateZip ? `${city}, ${cityStateZip}` : city) : cityStateZip]
    .filter(Boolean)
    .join(', ')
    .trim()

  if (assembled) return assembled

  const fallbackAddress = asTrimmedString(parts.address)
  return fallbackAddress || null
}
