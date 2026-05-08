'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isEstimateRouteFamilySendHref } from '../../estimateRouteFamily'
import type {
  EstimateV2EditorNavigationActions,
  EstimateV2EditorNavigationVm,
  EstimateV2EditorPageVm,
  EstimateV2EditorSaveVm,
} from './estimateV2EditorTypes'
import { shouldGuardEstimateV2Navigation } from './estimateV2NavigationGuard'

const defaultUnsavedDescription = 'This quote workspace has unsaved edits.'
const defaultUnsavedNoticeText =
  'Save your changes before leaving, discard them, or cancel navigation to keep editing.'
const sendUnsavedNoticeText =
  'The send page uses the last saved server total. Your unsaved editor changes will not be included unless you save first.'

export function useEstimateV2GuardedNavigation({
  listHref,
  pageVm,
  saveVm,
}: {
  listHref: string
  pageVm: Pick<EstimateV2EditorPageVm, 'loading' | 'saving'>
  saveVm: EstimateV2EditorSaveVm
}): {
  navigationVm: EstimateV2EditorNavigationVm
  navigationActions: EstimateV2EditorNavigationActions
} {
  const router = useRouter()
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null)
  const shouldGuardNavigation = shouldGuardEstimateV2Navigation({
    loading: pageVm.loading,
    saving: pageVm.saving,
    saveVm,
  })
  const shouldGuardNavigationRef = useRef(shouldGuardNavigation)
  const currentHrefRef = useRef<string | null>(null)
  const currentHistoryStateRef = useRef<unknown>(null)

  useEffect(() => {
    shouldGuardNavigationRef.current = shouldGuardNavigation
  }, [shouldGuardNavigation])

  useEffect(() => {
    currentHrefRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    currentHistoryStateRef.current = window.history.state
  }, [])

  const requestBackNavigation = useCallback(() => {
    if (shouldGuardNavigation) {
      setPendingNavigationHref(listHref)
      return
    }
    router.push(listHref)
  }, [listHref, router, shouldGuardNavigation])

  const cancelNavigation = useCallback(() => {
    setPendingNavigationHref(null)
  }, [])

  const saveAndLeave = useCallback(() => {
    const href = pendingNavigationHref ?? listHref
    void saveVm.save().then((ok) => {
      if (!ok) return
      setPendingNavigationHref(null)
      router.push(href)
    })
  }, [listHref, pendingNavigationHref, router, saveVm])

  const discardAndLeave = useCallback(() => {
    const href = pendingNavigationHref ?? listHref
    setPendingNavigationHref(null)
    router.push(href)
  }, [listHref, pendingNavigationHref, router])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!shouldGuardNavigationRef.current) return
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return

      const nextHref = `${url.pathname}${url.search}${url.hash}`
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextHref === currentHref) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setPendingNavigationHref(nextHref)
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      if (!shouldGuardNavigationRef.current) {
        currentHrefRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`
        currentHistoryStateRef.current = window.history.state
        return
      }

      const nextHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const currentHref = currentHrefRef.current
      if (!currentHref || nextHref === currentHref) return

      window.history.pushState(currentHistoryStateRef.current, '', currentHref)
      setPendingNavigationHref(nextHref)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const isPendingSendNavigation =
    pendingNavigationHref != null && isEstimateRouteFamilySendHref(pendingNavigationHref)

  return {
    navigationVm: {
      unsavedDialogProps: {
        isOpen: Boolean(pendingNavigationHref) && shouldGuardNavigation,
        canSave: !pageVm.saving && saveVm.canManualSave,
        description: defaultUnsavedDescription,
        noticeText: isPendingSendNavigation ? sendUnsavedNoticeText : defaultUnsavedNoticeText,
        onStay: cancelNavigation,
        onSave: saveAndLeave,
        onLeave: discardAndLeave,
      },
    },
    navigationActions: {
      requestBackNavigation,
    },
  }
}
