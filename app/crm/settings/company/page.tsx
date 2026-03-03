'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { authedFetch } from '@/lib/auth/authedFetch'
import { ArrowLeft, Building2, Mail, Phone, Save } from 'lucide-react'

type CompanyProfile = {
  business_name: string
  timezone: string
  main_phone: string
  business_email: string
  address: string
  website: string
  sender_signature: string
  logo_url: string
}

type Supported = Record<keyof CompanyProfile, boolean>

const emptyProfile: CompanyProfile = {
  business_name: '',
  timezone: 'America/Chicago',
  main_phone: '',
  business_email: '',
  address: '',
  website: '',
  sender_signature: '',
  logo_url: '',
}

const emptySupported: Supported = {
  business_name: true,
  timezone: true,
  main_phone: false,
  business_email: false,
  address: false,
  website: false,
  sender_signature: false,
  logo_url: false,
}

export default function CompanyProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [profile, setProfile] = useState<CompanyProfile>(emptyProfile)
  const [supported, setSupported] = useState<Supported>(emptySupported)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const res = await authedFetch('/api/settings/company', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? 'Failed to load company profile')
        setLoading(false)
        return
      }
      setProfile({ ...emptyProfile, ...(payload?.profile ?? {}) })
      setSupported({ ...emptySupported, ...(payload?.supported ?? {}) })
      setLoading(false)
    }
    void load()
  }, [])

  const unsupportedCount = useMemo(
    () => Object.values(supported).filter((v) => !v).length,
    [supported]
  )

  const save = async () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    const res = await authedFetch('/api/settings/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(payload?.error ?? 'Failed to save company profile')
      return
    }
    setNotice('Company profile saved')
  }

  const field = (
    key: keyof CompanyProfile,
    label: string,
    placeholder: string,
    multiline = false
  ) => {
    const disabled = !supported[key]
    if (multiline) {
      return (
        <label className="grid gap-1.5">
          <span className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">{label}</span>
          <textarea
            value={profile[key]}
            onChange={(e) => setProfile((prev) => ({ ...prev, [key]: e.target.value }))}
            placeholder={placeholder}
            rows={4}
            disabled={disabled || loading || saving}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-black/70 placeholder:text-gray-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100"
          />
          {disabled && <span className="text-xs text-gray-400">Not available in current schema.</span>}
        </label>
      )
    }
    return (
      <label className="grid gap-1.5">
        <span className="text-xs font-extrabold tracking-wide text-gray-500 uppercase">{label}</span>
        <input
          value={profile[key]}
          onChange={(e) => setProfile((prev) => ({ ...prev, [key]: e.target.value }))}
          placeholder={placeholder}
          disabled={disabled || loading || saving}
          className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none ring-black/70 placeholder:text-gray-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100"
        />
        {disabled && <span className="text-xs text-gray-400">Not available in current schema.</span>}
      </label>
    )
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 to-gray-200 py-4 md:py-6">
      <div className="mx-auto grid max-w-4xl gap-4 px-4 md:px-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wide text-gray-500 uppercase">
            <Building2 size={16} aria-hidden="true" />
            Company profile
          </div>
          <h1 className="mt-2 text-2xl font-black text-gray-900">Company Profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            Set your business identity and outbound defaults used across CRM workflows.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {notice && <div className="mb-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</div>}

          {unsupportedCount > 0 && (
            <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Some fields are read-only until matching org columns are added in your database.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {field('business_name', 'Business name', 'ACE Painting')}
            {field('timezone', 'Timezone', 'America/Chicago')}
            {field('main_phone', 'Main phone', '(812) 555-1234')}
            {field('business_email', 'Business email', 'hello@acepainting.com')}
            {field('website', 'Website', 'https://acepainting.com')}
            {field('logo_url', 'Logo URL', 'https://...')}
          </div>

          <div className="mt-3 grid gap-3">
            {field('address', 'Address', '123 Main St, Newburgh, IN 47630')}
            {field('sender_signature', 'Default sender signature', 'Thanks,\nACE Painting Team', true)}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void save()}
              disabled={loading || saving}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-black bg-black px-3 text-sm font-semibold text-white transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-black/80 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Save size={16} aria-hidden="true" />
              <span>{saving ? 'Saving...' : 'Save changes'}</span>
            </button>
            <div className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <Mail size={14} aria-hidden="true" />
              <Phone size={14} aria-hidden="true" />
              <span>Used by customer-facing emails and scheduling flows.</span>
            </div>
          </div>
        </div>

        <Link
          href="/crm/settings"
          className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-black bg-black px-3 py-2 text-sm font-semibold text-white no-underline transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-black/80"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to settings</span>
        </Link>
      </div>
    </div>
  )
}
