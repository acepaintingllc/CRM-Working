export type CustomerFormValues = {
  name: string
  phone: string
  email: string
  street: string
  city: string
  state: string
  zip: string
}

export type CustomerFormRecord = {
  name?: string | null
  phone?: string | null
  email?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  address?: string | null
}

export type CustomerLegacyAddressCleanup = {
  needsCleanup: true
  warning: string
  legacyAddress: string
}

export type CustomerFormState = {
  values: CustomerFormValues
  legacyAddressCleanup: CustomerLegacyAddressCleanup | null
}

type CustomerFormStateResult =
  | { ok: true; value: CustomerFormState }
  | { ok: false; error: string }

type CustomerFormInput = {
  name?: string | null
  phone?: string | null
  email?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function normalizeCustomerFormValues(values?: CustomerFormInput): CustomerFormValues {
  return {
    name: asText(values?.name),
    phone: asText(values?.phone),
    email: asText(values?.email),
    street: asText(values?.street),
    city: asText(values?.city),
    state: asText(values?.state),
    zip: asText(values?.zip),
  }
}

export function parseLegacyCustomerAddress(address: string) {
  const normalized = address
    .replace(/\r?\n/g, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()

  const match = /^(.*?),\s*(.*?),\s*([A-Za-z]{2})\s+([A-Za-z0-9-]+)$/.exec(normalized)
  if (!match) {
    return {
      ok: false as const,
      error: 'This customer has an address in an older format. Enter a street, city, state, and ZIP to replace it.',
    }
  }

  const [, street, city, state, zip] = match
  if (!street.trim() || !city.trim()) {
    return {
      ok: false as const,
      error: 'This customer has an address in an older format. Enter a street, city, state, and ZIP to replace it.',
    }
  }

  return {
    ok: true as const,
    value: {
      street: street.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zip: zip.trim(),
    },
  }
}

export function customerRecordToFormValues(customer: CustomerFormRecord): CustomerFormStateResult {
  const structured = normalizeCustomerFormValues(customer)
  if (structured.street || structured.city || structured.state || structured.zip) {
    return {
      ok: true as const,
      value: {
        values: {
          ...structured,
          name: asText(customer.name),
          phone: asText(customer.phone),
          email: asText(customer.email),
        },
        legacyAddressCleanup: null,
      },
    }
  }

  const address = asText(customer.address).trim()
  if (!address) {
    return {
      ok: true as const,
      value: {
        values: {
          ...structured,
          name: asText(customer.name),
          phone: asText(customer.phone),
          email: asText(customer.email),
        },
        legacyAddressCleanup: null,
      },
    }
  }

  const parsed = parseLegacyCustomerAddress(address)
  if (!parsed.ok) {
    return {
      ok: true as const,
      value: {
        values: {
          ...structured,
          name: asText(customer.name),
          phone: asText(customer.phone),
          email: asText(customer.email),
        },
        legacyAddressCleanup: {
          needsCleanup: true,
          warning: parsed.error,
          legacyAddress: address,
        },
      },
    }
  }

  return {
    ok: true as const,
    value: {
      values: {
        name: asText(customer.name),
        phone: asText(customer.phone),
        email: asText(customer.email),
        ...parsed.value,
      },
      legacyAddressCleanup: null,
    },
  }
}
