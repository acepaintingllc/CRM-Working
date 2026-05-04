export function getCodexBrowserTestOrgId() {
  const orgId = process.env.CODEX_BROWSER_TEST_ORG_ID?.trim()
  return orgId || null
}

export function codexBrowserTestOrgError() {
  return 'Codex browser testing is restricted to the configured test org.'
}
