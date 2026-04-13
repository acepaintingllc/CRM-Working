'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  SendToBack,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react'
import { authedFetch } from '@/lib/auth/authedFetch'
import {
  createPreviewUrl,
  deleteLocalSitePhoto,
  listLocalSitePhotosForJob,
  putLocalSitePhoto,
  queueCapturedSitePhoto,
  subscribeToLocalSitePhotoChanges,
  syncQueuedSitePhotos,
  type LocalSitePhotoRecord,
  type SitePhotoApiRow,
} from '@/lib/field/localSitePhotos'

type JobRow = {
  id: string
  title: string
  customer_name: string | null
  customer_address: string | null
  status: string | null
  scheduled_date?: string | null
}

const stageOrder: Record<string, number> = {
  estimate_scheduled: 0,
  estimate_sent: 1,
  follow_up: 2,
  scheduled: 3,
  completed: 4,
  lost: 5,
}

function normalizeStatus(status: string | null | undefined) {
  return (status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/_+/g, '_')
}

function sortJobsByStage(rows: JobRow[]) {
  return rows.slice().sort((a, b) => {
    const aRank = stageOrder[normalizeStatus(a.status)] ?? Number.MAX_SAFE_INTEGER
    const bRank = stageOrder[normalizeStatus(b.status)] ?? Number.MAX_SAFE_INTEGER
    if (aRank !== bRank) return aRank - bRank

    const aDate = a.scheduled_date ? Date.parse(a.scheduled_date) : Number.POSITIVE_INFINITY
    const bDate = b.scheduled_date ? Date.parse(b.scheduled_date) : Number.POSITIVE_INFINITY
    if (!Number.isNaN(aDate) && !Number.isNaN(bDate) && aDate !== bDate) {
      return aDate - bDate
    }

    return a.title.localeCompare(b.title)
  })
}

type LocalPhotoView = LocalSitePhotoRecord & {
  previewUrl: string | null
}

type DisplayPhoto =
  | {
      key: string
      kind: 'local'
      localId: string
      remoteId: string | null
      previewUrl: string | null
      caption: string
      capturedAt: string
      status: LocalSitePhotoRecord['status']
      error: string | null
    }
  | {
      key: string
      kind: 'remote'
      remoteId: string
      previewUrl: string
      caption: string
      capturedAt: string
      status: 'uploaded'
      error: null
    }

function formatStatus(value: string | null | undefined) {
  const text = (value ?? '').replaceAll('_', ' ').trim()
  if (!text) return 'Unknown'
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusBadge(status: LocalSitePhotoRecord['status']) {
  if (status === 'uploaded') return 'Uploaded'
  if (status === 'uploading') return 'Uploading'
  if (status === 'failed') return 'Retry needed'
  return 'Queued'
}

async function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to build image blob'))
        return
      }
      resolve(blob)
    }, type, quality)
  })
}

async function captureVideoFrame(video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  if (!sourceWidth || !sourceHeight) {
    throw new Error('Camera is not ready yet.')
  }

  const maxDimension = 1800
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas context unavailable')
  context.drawImage(video, 0, 0, width, height)
  return canvasToBlob(canvas)
}

export default function FieldJobPage() {
  const params = useParams()
  const router = useRouter()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const jobId = Array.isArray(rawId) ? rawId[0] : rawId

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [job, setJob] = useState<JobRow | null>(null)
  const [remotePhotos, setRemotePhotos] = useState<SitePhotoApiRow[]>([])
  const [localPhotos, setLocalPhotos] = useState<LocalPhotoView[]>([])
  const [loading, setLoading] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<DisplayPhoto | null>(null)
  const [captionDraft, setCaptionDraft] = useState('')

  const revokePreviewUrls = useCallback((rows: Array<{ previewUrl: string | null }>) => {
    rows.forEach((photo) => {
      if (photo.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(photo.previewUrl)
      }
    })
  }, [])

  const stopCamera = useCallback(() => {
    const node = videoRef.current
    if (!node) {
      setCameraReady(false)
      return
    }
    const stream = node?.srcObject
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop())
      node.srcObject = null
    }
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser.')
      return
    }

    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      if (videoRef.current) {
        stopCamera()
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setCameraReady(true)
    } catch (startError) {
      setCameraReady(false)
      setCameraError(startError instanceof Error ? startError.message : 'Unable to start camera.')
    }
  }, [stopCamera])

  const loadLocal = useCallback(
    async (activeJobId: string) => {
      const rows = await listLocalSitePhotosForJob(activeJobId)
      setLocalPhotos((prev) => {
        revokePreviewUrls(prev)
        return rows.map((row) => ({
          ...row,
          previewUrl: createPreviewUrl(row) ?? null,
        }))
      })
    },
    [revokePreviewUrls]
  )

  const loadRemote = useCallback(async (activeJobId: string, options?: { quietOffline?: boolean }) => {
    try {
      const res = await authedFetch(`/api/jobs/${activeJobId}/site-photos`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        return
      }
      setRemotePhotos((payload?.photos ?? []) as SitePhotoApiRow[])
    } catch (remoteError) {
      if (options?.quietOffline && typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }
      setError(
        remoteError instanceof Error ? remoteError.message : 'Unable to refresh remote site photos.'
      )
    }
  }, [])

  useEffect(() => {
    if (!jobId) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const jobsRes = await authedFetch('/api/jobs', { cache: 'no-store' })
        const jobsPayload = await jobsRes.json().catch(() => null)
        if (cancelled) return
        if (!jobsRes.ok) {
          setJobs([])
          setJob(null)
          setError(jobsPayload?.error ?? jobsRes.statusText)
          return
        }

        const rows = sortJobsByStage((jobsPayload?.jobs ?? []) as JobRow[])
        setJobs(rows)
        setJob(rows.find((row) => row.id === jobId) ?? null)

        await Promise.all([loadRemote(jobId, { quietOffline: true }), loadLocal(jobId)])
        await syncQueuedSitePhotos({ jobId })
        await loadLocal(jobId)
        if (typeof navigator === 'undefined' || navigator.onLine) {
          await loadRemote(jobId, { quietOffline: true })
        }
      } catch (loadError) {
        if (cancelled) return
        setJobs([])
        setJob(null)
        setError(loadError instanceof Error ? loadError.message : 'Unable to load field workspace.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [jobId, loadLocal, loadRemote])

  useEffect(() => {
    if (!jobId) return
    return subscribeToLocalSitePhotoChanges(() => {
      void loadLocal(jobId)
    })
  }, [jobId, loadLocal])

  useEffect(() => {
    void startCamera()
    return () => {
      stopCamera()
    }
  }, [startCamera, stopCamera])

  useEffect(() => {
    return () => {
      revokePreviewUrls(localPhotos)
    }
  }, [localPhotos, revokePreviewUrls])

  useEffect(() => {
    if (!selectedPhoto) return
    setCaptionDraft(selectedPhoto.caption)
  }, [selectedPhoto])

  const mergedPhotos = useMemo<DisplayPhoto[]>(() => {
    const localIds = new Set(localPhotos.map((photo) => photo.localId))
    const remoteIds = new Set(localPhotos.map((photo) => photo.remoteId).filter(Boolean) as string[])

    const locals: DisplayPhoto[] = localPhotos.map((photo) => ({
      key: `local:${photo.localId}`,
      kind: 'local',
      localId: photo.localId,
      remoteId: photo.remoteId,
      previewUrl: photo.previewUrl,
      caption: photo.caption,
      capturedAt: photo.capturedAt,
      status: photo.status,
      error: photo.error,
    }))

    const remotes: DisplayPhoto[] = remotePhotos
      .filter((photo) => !remoteIds.has(photo.id) && !localIds.has(photo.client_local_id))
      .map((photo) => ({
        key: `remote:${photo.id}`,
        kind: 'remote',
        remoteId: photo.id,
        previewUrl: photo.url,
        caption: photo.caption ?? '',
        capturedAt: photo.captured_at ?? photo.created_at ?? new Date().toISOString(),
        status: 'uploaded',
        error: null,
      }))

    return [...locals, ...remotes].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  }, [localPhotos, remotePhotos])

  const queueSummary = useMemo(() => {
    return {
      queued: localPhotos.filter((photo) => photo.status === 'queued' || photo.status === 'uploading').length,
      failed: localPhotos.filter((photo) => photo.status === 'failed').length,
    }
  }, [localPhotos])

  const runSync = useCallback(async () => {
    if (!jobId) return
    setSyncing(true)
    setError(null)
    try {
      await syncQueuedSitePhotos({ jobId })
      await loadLocal(jobId)
      if (typeof navigator === 'undefined' || navigator.onLine) {
        await loadRemote(jobId, { quietOffline: true })
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }, [jobId, loadLocal, loadRemote])

  const captureNow = async () => {
    if (!job || !jobId || !videoRef.current || capturing) return
    setCapturing(true)
    setError(null)

    try {
      const blob = await captureVideoFrame(videoRef.current)
      await queueCapturedSitePhoto({
        jobId,
        jobTitle: job.title,
        blob,
        mimeType: blob.type || 'image/jpeg',
      })
      await loadLocal(jobId)
      void runSync()
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'Capture failed')
    } finally {
      setCapturing(false)
    }
  }

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!job || !jobId || files.length === 0) return

    setCapturing(true)
    setError(null)
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        await queueCapturedSitePhoto({
          jobId,
          jobTitle: job.title,
          blob: file,
          mimeType: file.type,
        })
      }
      await loadLocal(jobId)
      void runSync()
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'Could not queue those photos.')
    } finally {
      setCapturing(false)
      event.target.value = ''
    }
  }

  const saveCaption = async () => {
    if (!selectedPhoto || !jobId) return
    setError(null)

    if (selectedPhoto.kind === 'local') {
      const local = localPhotos.find((photo) => photo.localId === selectedPhoto.localId)
      if (!local) return
      const { previewUrl: _previewUrl, ...persisted } = local
      await putLocalSitePhoto({
        ...persisted,
        caption: captionDraft,
      })
      if (local.remoteId) {
        const res = await authedFetch(`/api/jobs/${jobId}/site-photos/${local.remoteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption: captionDraft || null }),
        })
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          setError(payload?.error ?? res.statusText)
          return
        }
      }
    } else {
      const res = await authedFetch(`/api/jobs/${jobId}/site-photos/${selectedPhoto.remoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: captionDraft || null }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        return
      }
    }

    await Promise.all([loadRemote(jobId, { quietOffline: true }), loadLocal(jobId)])
    setSelectedPhoto(null)
  }

  const deletePhoto = async () => {
    if (!selectedPhoto || !jobId) return
    setError(null)

    if (selectedPhoto.kind === 'local' && !selectedPhoto.remoteId) {
      await deleteLocalSitePhoto(selectedPhoto.localId)
      await loadLocal(jobId)
      setSelectedPhoto(null)
      return
    }

    const remoteId = selectedPhoto.kind === 'remote' ? selectedPhoto.remoteId : selectedPhoto.remoteId
    if (!remoteId) return

    const res = await authedFetch(`/api/jobs/${jobId}/site-photos/${remoteId}`, {
      method: 'DELETE',
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }

    const localMatch = localPhotos.find((photo) => photo.remoteId === remoteId)
    if (localMatch) {
      await deleteLocalSitePhoto(localMatch.localId)
    }

    await Promise.all([loadRemote(jobId, { quietOffline: true }), loadLocal(jobId)])
    setSelectedPhoto(null)
  }

  if (!jobId) {
    return (
      <div className="rounded-[28px] border border-white/75 bg-white/92 px-4 py-8 text-center shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
        Missing job id.
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <section className="rounded-[30px] border border-white/75 bg-white/92 p-4 shadow-[0_22px_50px_rgba(15,23,42,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              onClick={() => router.push('/field/jobs')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500"
            >
              <ArrowLeft size={14} />
              <span>Jobs</span>
            </button>
            <div className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Field workspace</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              {job?.title ?? 'Loading job...'}
            </h1>
            <div className="mt-1 text-sm text-slate-500">
              {job?.customer_name ?? 'Loading customer'}
              {job?.customer_address ? ` | ${job.customer_address}` : ''}
            </div>
          </div>
          <Link
            href={`/crm/jobs/${jobId}`}
            className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700"
          >
            Open CRM
          </Link>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <select
            value={jobId}
            onChange={(event) => router.push(`/field/jobs/${event.target.value}`)}
            className="h-12 rounded-[20px] border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900"
          >
            {jobs.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title} - {option.customer_name ?? option.id}
              </option>
            ))}
          </select>
          <button
            onClick={() => void runSync()}
            disabled={syncing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-60"
          >
            {syncing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span>Sync</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Stage</div>
            <div className="mt-1 text-sm font-black text-slate-900">{formatStatus(job?.status)}</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Queued</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{queueSummary.queued}</div>
          </div>
          <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">Retry</div>
            <div className="mt-1 text-2xl font-black text-amber-700">{queueSummary.failed}</div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-[30px] border border-white/75 bg-white/92 shadow-[0_22px_50px_rgba(15,23,42,0.12)]">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-black text-slate-900">Live camera</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Camera stays open between shots
          </div>
        </div>
        <div className="relative bg-slate-900">
          <video ref={videoRef} muted playsInline autoPlay className="aspect-[4/3] w-full object-cover" />
          {!cameraReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/84 px-5 text-center text-white">
              {cameraError ? <AlertTriangle size={26} /> : <LoaderCircle size={26} className="animate-spin" />}
              <div className="max-w-[28ch] text-sm font-semibold">{cameraError ?? 'Starting camera...'}</div>
              {cameraError && (
                <button
                  onClick={() => void startCamera()}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 px-4 text-sm font-black text-white"
                >
                  <RefreshCw size={16} />
                  <span>Retry camera</span>
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700"
          >
            <ImagePlus size={18} />
            <span>Library</span>
          </button>

          <button
            onClick={() => void captureNow()}
            disabled={!cameraReady || capturing}
            className="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-[10px] border-slate-300 bg-slate-900 text-white shadow-[0_18px_35px_rgba(15,23,42,0.25)] disabled:opacity-60"
            aria-label="Take photo"
          >
            {capturing ? <LoaderCircle size={26} className="animate-spin" /> : <Camera size={28} />}
          </button>

          <button
            onClick={() => void runSync()}
            disabled={syncing}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700"
          >
            {syncing ? <LoaderCircle size={16} className="animate-spin" /> : <SendToBack size={16} />}
            <span>Send</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => void handleFilePick(event)}
        />
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Photo stream</div>
            <div className="mt-1 text-lg font-black text-slate-900">{mergedPhotos.length} photos</div>
          </div>
          {queueSummary.failed > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              <WifiOff size={14} />
              <span>{queueSummary.failed} needs retry</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-white/75 bg-white/92 px-4 py-8 text-center text-sm font-semibold text-slate-500 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
            Loading workspace...
          </div>
        ) : mergedPhotos.length === 0 ? (
          <div className="rounded-[28px] border border-white/75 bg-white/92 px-4 py-8 text-center shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
            <div className="text-lg font-black text-slate-900">No site photos yet.</div>
            <div className="mt-1 text-sm text-slate-500">Take a shot and it will appear here immediately.</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {mergedPhotos.map((photo) => (
              <button
                key={photo.key}
                onClick={() => setSelectedPhoto(photo)}
                className="overflow-hidden rounded-[26px] border border-white/75 bg-white/92 text-left shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
              >
                <div className="relative aspect-[4/5] bg-slate-100">
                  {photo.previewUrl ? (
                    <img src={photo.previewUrl} alt={photo.caption || 'Job photo'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
                      Preview unavailable
                    </div>
                  )}
                  <div className="absolute left-2 top-2 rounded-full bg-white/92 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700">
                    {photo.kind === 'local' ? statusBadge(photo.status) : 'Uploaded'}
                  </div>
                </div>
                <div className="p-3">
                  <div className="line-clamp-2 text-sm font-bold text-slate-900">
                    {photo.caption || 'Tap to add caption'}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-slate-400">
                    {new Date(photo.capturedAt).toLocaleString()}
                  </div>
                  {photo.kind === 'local' && photo.error && (
                    <div className="mt-2 text-xs font-bold text-amber-600">{photo.error}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/72 px-3 py-3" onClick={() => setSelectedPhoto(null)}>
          <div className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-[30px] border border-white/70 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.3)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Photo details
                </div>
                <div className="mt-1 text-lg font-black text-slate-900">
                  {selectedPhoto.kind === 'local' ? statusBadge(selectedPhoto.status) : 'Uploaded'}
                </div>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-hidden rounded-[24px] bg-slate-100">
              {selectedPhoto.previewUrl ? (
                <img src={selectedPhoto.previewUrl} alt={selectedPhoto.caption || 'Selected job photo'} className="max-h-[58vh] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center text-sm font-bold text-slate-400">
                  Preview unavailable
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-2">
              <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Caption</label>
              <textarea
                value={captionDraft}
                onChange={(event) => setCaptionDraft(event.target.value)}
                placeholder="Optional note for this photo"
                className="min-h-28 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <div className="text-xs font-semibold text-slate-400">
                Captured {new Date(selectedPhoto.capturedAt).toLocaleString()}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void saveCaption()}
                className="crm-btn-primary inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-black"
              >
                <CheckCircle2 size={16} />
                <span>Save caption</span>
              </button>
              {selectedPhoto.kind === 'local' && selectedPhoto.status !== 'uploaded' && (
                <button
                  onClick={() => void runSync()}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700"
                >
                  <RefreshCw size={16} />
                  <span>Retry upload</span>
                </button>
              )}
              <button
                onClick={() => void deletePhoto()}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-700"
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
