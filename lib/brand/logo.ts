const FALLBACK_BRAND_LOGO = '/ace-logo-clean.png'

export function getBrandLogoUrl(preferred?: string | null) {
  const value = (preferred ?? '').trim()
  if (value) return value
  const envLogo = (process.env.NEXT_PUBLIC_CRM_LOGO ?? '').trim()
  if (envLogo) return envLogo
  return FALLBACK_BRAND_LOGO
}

export function getBrandLogoFallback() {
  return FALLBACK_BRAND_LOGO
}
