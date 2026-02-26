'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { FilePlus2, FolderOpen, Trash2 } from 'lucide-react'

type EstimateRow = {
  id: string
  job_id: string
  customer_id: string
  status: string
  job_title: string | null
  customer_name: string | null
  latest_output_json?: {
    output_app?: Record<string, string | number | null>
    updated_at?: string
  } | null
  updated_at: string
}

function formatCurrency(value: string | number | null | undefined) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

export default function EstimatesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<EstimateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<EstimateRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await authedFetch('/api/estimates', { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      setLoading(false)
      return
    }
    setRows(payload?.estimates ?? [])
    setLoading(false)
  }, [])

  const deleteEstimate = async () => {
    if (!confirmingDelete) return
    setDeletingId(confirmingDelete.id)
    setError(null)
    const res = await authedFetch(`/api/estimates/${confirmingDelete.id}`, { method: 'DELETE' })
    const payload = await res.json().catch(() => null)
    setDeletingId(null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    if (payload?.warning) {
      setError(payload.warning)
    }
    setRows((prev) => prev.filter((row) => row.id !== confirmingDelete.id))
    setConfirmingDelete(null)
  }

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <h1 className="m-0 text-2xl font-extrabold text-gray-900">Estimates</h1>
            <div className="mt-1 text-sm text-gray-600">
              Spreadsheet-backed estimates using INPUT_* / OUTPUT_App.
            </div>
          </div>
          <Link
            href="/crm/estimates/new"
            className="inline-flex items-center gap-1.5 rounded-xl border border-black bg-black px-3 py-2 text-sm font-extrabold text-white transition duration-200 hover:scale-[1.02]"
          >
            <FilePlus2 size={16} aria-hidden="true" />
            <span>New estimate</span>
          </Link>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-white p-3 text-sm text-red-800 shadow-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600 shadow-sm">
            No estimates yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => (
              <div
                key={row.id}
                onClick={() => router.push(`/crm/estimates/${row.id}`)}
                className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="text-base font-extrabold text-gray-900">
                      {row.job_title ?? 'Untitled job'}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600">
                      {row.customer_name ?? row.customer_id}
                    </div>
                    <div className="mt-1.5 text-xs text-gray-600">Status: {row.status}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Final total</div>
                    <div className="text-xl font-black text-gray-900">
                      {formatCurrency(row.latest_output_json?.output_app?.FinalTotal)}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Updated: {new Date(row.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Link
                    href={`/crm/estimates/${row.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-900"
                  >
                    <FolderOpen size={14} aria-hidden="true" />
                    <span>Open</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmingDelete(row)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17,24,39,0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 60,
          }}
          onClick={() => (deletingId ? null : setConfirmingDelete(null))}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 14,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 17 }}>Delete Estimate?</div>
            <div style={{ color: '#4b5563', fontSize: 13 }}>
              This will permanently delete this estimate and all saved inputs for{' '}
              <strong>{confirmingDelete.job_title ?? 'this job'}</strong>.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setConfirmingDelete(null)}
                disabled={Boolean(deletingId)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#111',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void deleteEstimate()}
                disabled={Boolean(deletingId)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: '1px solid #dc2626',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: deletingId ? 0.7 : 1,
                }}
              >
                {deletingId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
