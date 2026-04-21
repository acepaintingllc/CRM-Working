import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPropsWithoutRef } from 'react'
import NoteDetailPage from '../notes/[id]/page'

const { mockAuthedFetch, mockUseParams, mockUseSearchParams, mockPush } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
  mockUseParams: vi.fn(),
  mockUseSearchParams: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

vi.mock('next/navigation', () => ({
  useParams: mockUseParams,
  useSearchParams: mockUseSearchParams,
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('NoteDetailPage', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'note-1' })
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    mockAuthedFetch.mockReset()
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          note: {
            id: 'note-1',
            title: 'Site walkthrough',
            body: 'Capture all open items.',
            folder_id: null,
            status: 'active',
            starred: false,
            created_by: null,
            created_at: '',
            updated_at: '',
            archived_at: null,
            org_id: 'org',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folders: [] }),
      })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the note detail view after the hook-driven load completes', async () => {
    render(<NoteDetailPage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Site walkthrough' })).toBeTruthy()
      expect(screen.getByText('Capture all open items.')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    })
  })
})
