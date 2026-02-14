'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

function safeReturnPath(value: string | null, id: string | undefined) {
  if (!value) return id ? `/crm/customers/${id}` : '/crm/customers'
  if (!value.startsWith('/')) return id ? `/crm/customers/${id}` : '/crm/customers'
  return value
}

export default function EditCustomerPage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnPath = useMemo(
    () => safeReturnPath(searchParams.get('returnTo'), id),
    [searchParams, id]
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")

  useEffect(() => {
    let ignore = false

    async function load() {
      if (!id || typeof id !== 'string') {
        setErr('Missing customer id.')
        setLoading(false)
        return
      }

      setErr(null)
      setLoading(true)
      const res = await authedFetch(`/api/customers/${id}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        if (!ignore) {
          setErr(payload?.error ?? 'Failed to load customer.')
          setLoading(false)
        }
        return
      }

      const customer = payload?.customer ?? null
      if (!ignore) {
        setName(customer?.name ?? '')
        setPhone(customer?.phone ?? '')
        setEmail(customer?.email ?? '')
        setAddress(customer?.address ?? '')
        setLoading(false)
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)

    if (!id || typeof id !== 'string') {
      setErr('Missing customer id.')
      return
    }
    if (!name.trim()) {
      setErr('Name is required.')
      return
    }

    try {
      setSaving(true)
      const res = await authedFetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'Failed to update customer.')

      router.push(returnPath)
      router.refresh()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to update customer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Edit customer</h1>

      {err && <div className="text-red-600">{err}</div>}
      {loading && <div className="text-sm text-gray-600">Loading customer...</div>}

      {!loading && (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm">Name *</label>
            <input className="border rounded-md w-full p-2" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Phone</label>
              <input className="border rounded-md w-full p-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Email</label>
              <input className="border rounded-md w-full p-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm">Address</label>
            <input className="border rounded-md w-full p-2" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push(returnPath)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
