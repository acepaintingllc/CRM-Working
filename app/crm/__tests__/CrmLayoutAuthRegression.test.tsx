import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('crm layout auth regression', () => {
  it('keeps bootstrap-org and removes client-side auth redirect logic', async () => {
    const layoutSource = await readFile(
      path.join(process.cwd(), 'app', 'crm', 'layout.tsx'),
      'utf8'
    )

    expect(layoutSource).toContain('/api/bootstrap-org')
    expect(layoutSource).not.toContain('supabaseBrowser.auth.getSession')
    expect(layoutSource).not.toContain('refreshSession')
    expect(layoutSource).not.toContain("router.replace(`/login")
  })
})
