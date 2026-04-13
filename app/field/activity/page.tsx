'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react'
import {
  clearUploadedLocalSitePhotos,
  createPreviewUrl,
  listRecentLocalSitePhotos,
  subscribeToLocalSitePhotoChanges,
  syncQueuedSitePhotos,
  type LocalSitePhotoRecord,
} from '@/lib/field/localSitePhotos'

type RecentPhotoView = LocalSitePhotoRecord & {
  previewUrl: string | null
}

function statusLabel(status: LocalSitePhotoRecord['status']) {
  if (status === 'uploaded') return 'Uploaded'
  if (status === 'uploading') return 'Uploading'
  if (status === 'failed') return 'Needs retry'
  return 'Queued'
}

export default function FieldActivityPage() {
  const [photos, setPhotos] = useState<RecentPhotoView[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const rows = await listRecentLocalSitePhotos()
    setPhotos((prev) => {
      prev.forEach((photo) => {
        if (photo.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
      })
      return rows.map((row) => ({ ...row, previewUrl: createPreviewUrl(row) ?? null }))
    })
  }, [])

  useEffect(() => {
    void load()
    return subscribeToLocalSitePhotoChanges(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    return () => {
      photos.forEach((photo) => {
        if (photo.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
      })
    }
  }, [photos])

  const counts = useMemo(() => {
    return {
      uploaded: photos.filter((photo) => photo.status === 'uploaded').length,
      queued: photos.filter((photo) => photo.status === 'queued' || photo.status === 'uploading').length,
      failed: photos.filter((photo) => photo.status === 'failed').length,
    }
  }, [photos])

  const handleRetry = async () => {
    setRefreshing(true)
    await syncQueuedSitePhotos()
    await load()
    setRefreshing(false)
  }

  const handleClear = async () => {
    setRefreshing(true)
    await clearUploadedLocalSitePhotos()
    await load()
    setRefreshing(false)
  }

  return (
    <div className="grid gap-3">
      <section className="rounded-[30px] border border-white/75 bg-white/92 p-4 shadow-[0_22px_50px_rgba(15,23,42,0.12)]">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Activity</div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Recent captures on this device.</h1>
        <p className="mt-1 text-sm text-slate-500">
          This screen only shows photos created from the new field route on this device.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Uploaded</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{counts.uploaded}</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Queued</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{counts.queued}</div>
          </div>
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">Retry</div>
            <div className="mt-1 text-2xl font-black text-amber-700">{counts.failed}</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => void handleRetry()}
            disabled={refreshing}
            className="crm-btn-primary inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-black"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span>Retry sync</span>
          </button>
          <button
            onClick={() => void handleClear()}
            disabled={refreshing}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-60"
          >
            <span>Clear uploaded history</span>
          </button>
        </div>
      </section>

      <section className="grid gap-3">
        {photos.length === 0 ? (
          <div className="rounded-[28px] border border-white/75 bg-white/92 px-4 py-8 text-center shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
            <div className="text-lg font-black text-slate-900">No recent field captures yet.</div>
            <Link href="/field/jobs" className="crm-btn-primary mt-3 inline-flex rounded-full px-4 py-2 text-sm font-black">
              Open jobs
            </Link>
          </div>
        ) : (
          photos.map((photo) => (
            <Link
              key={photo.localId}
              href={`/field/jobs/${photo.jobId}`}
              className="overflow-hidden rounded-[28px] border border-white/75 bg-white/92 shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                {photo.previewUrl ? (
                  <img src={photo.previewUrl} alt={photo.caption || photo.jobTitle} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
                    Preview unavailable
                  </div>
                )}
                <div className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700">
                  {statusLabel(photo.status)}
                </div>
              </div>
              <div className="p-4">
                <div className="text-base font-black text-slate-900">{photo.jobTitle}</div>
                <div className="mt-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  {photo.status === 'uploaded' ? <CheckCircle2 size={13} /> : photo.status === 'failed' ? <AlertTriangle size={13} /> : <Clock3 size={13} />}
                  <span>{statusLabel(photo.status)}</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {photo.caption || 'No caption yet'}
                </div>
                <div className="mt-3 text-xs font-semibold text-slate-400">
                  {new Date(photo.capturedAt).toLocaleString()}
                </div>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  )
}
