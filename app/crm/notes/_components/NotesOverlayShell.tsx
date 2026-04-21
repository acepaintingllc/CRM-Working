'use client'

import { useLockBodyScroll } from '@/lib/hooks/useLockBodyScroll'
import { useMediaQuery } from '@/lib/hooks/useMediaQuery'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

export type OverlayShellProps = {
  open: boolean
  title: string
  description: string
  variant: 'task' | 'note'
  onClose: () => void
  children: ReactNode
}

function overlayWidth(variant: OverlayShellProps['variant'], mobile: boolean) {
  if (mobile) return '100vw'
  return variant === 'task' ? 'min(42rem, calc(100vw - 2rem))' : 'min(64rem, calc(100vw - 2rem))'
}

export function NotesOverlayShell(props: OverlayShellProps) {
  const mobile = useMediaQuery('(max-width: 767px)')
  useLockBodyScroll(props.open)

  useEffect(() => {
    if (!props.open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [props])

  if (!props.open) return null

  const alignClass = mobile ? 'items-end' : 'items-stretch justify-end'

  return (
    <div className={`fixed inset-0 z-50 flex ${alignClass} bg-black/70 backdrop-blur-sm`} role="presentation">
      <button type="button" aria-label="Close composer" onClick={props.onClose} className="absolute inset-0 cursor-default" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`notes-composer-${props.variant}-title`}
        className={`relative grid max-h-screen w-full grid-rows-[auto_1fr] overflow-hidden border border-neutral-800 bg-neutral-950 text-white shadow-2xl ${
          mobile ? 'min-h-[100dvh] rounded-t-[28px]' : 'h-full rounded-l-[28px]'
        }`}
        style={{ width: overlayWidth(props.variant, mobile) }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-800 px-5 py-4">
          <div className="grid gap-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">
              {props.variant === 'task' ? 'Task Composer' : 'Note Composer'}
            </div>
            <div>
              <h2 id={`notes-composer-${props.variant}-title`} className="text-xl font-extrabold text-white">
                {props.title}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">{props.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="overflow-y-auto">{props.children}</div>
      </section>
    </div>
  )
}
