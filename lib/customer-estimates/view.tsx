'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { getBrandLogoUrl } from '@/lib/brand/logo'
import type { CustomerEstimateDocument, CustomerEstimateQuoteRow } from './types'

const C = {
  page: '#ffffff',
  text: '#111111',
  muted: '#5a5a5a',
  rule: '#d7d7d7',
  soft: '#f6f6f6',
}

const DEFAULT_COMPANY_INFO = {
  name: 'ACE Painting LLC',
  phone: '812-228-8803',
  email: 'austin@newburghacepainting.com',
} as const
// TODO: Replace these fallbacks with the org profile feature once company settings are fully wired.

function fmtCurrency(value: number | null | undefined) {
  if (value == null) return ''
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function normalizeText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s+-\s+/g, ' - ')
    .trim()
}

function stripLeadingLabel(label: string, text: string) {
  const raw = normalizeText(text)
  if (!raw) return ''
  const cleanLabel = normalizeText(label).toLowerCase()
  const lower = raw.toLowerCase()
  if (lower.startsWith(`${cleanLabel} - `)) return raw.slice(label.length + 3).trim()
  if (lower.startsWith(`${cleanLabel}: `)) return raw.slice(label.length + 2).trim()
  if (lower.startsWith(`${cleanLabel} `)) return raw.slice(label.length).trim()
  return raw
}

function pageStyle(): CSSProperties {
  return {
    width: '100%',
    background: C.page,
    color: C.text,
    border: `1px solid ${C.rule}`,
    boxShadow: '0 1px 0 rgba(0,0,0,0.03)',
    padding: '34px 40px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  }
}

function sectionTitleStyle(): CSSProperties {
  return {
    fontSize: 11.5,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: C.muted,
  }
}

function LogoMark({ logoUrl, alt }: { logoUrl: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || !logoUrl) return null
  return (
    <span
      style={{
        width: 96,
        height: 72,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Image
        src={logoUrl}
        alt={alt}
        onError={() => setFailed(true)}
        width={96}
        height={72}
        unoptimized
        style={{ width: 96, height: 72, objectFit: 'contain' }}
      />
    </span>
  )
}

function Header({ document }: { document: CustomerEstimateDocument }) {
  const logoUrl = getBrandLogoUrl(document.company.logo_url)
  const companyName = document.company.business_name || DEFAULT_COMPANY_INFO.name
  const phone = document.company.main_phone || DEFAULT_COMPANY_INFO.phone
  const email = document.company.business_email || DEFAULT_COMPANY_INFO.email
  return (
    <header style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 14, alignItems: 'start' }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          <div style={{ fontWeight: 800 }}>{companyName}</div>
          <div>{phone}</div>
          <div>{email}</div>
        </div>
        <LogoMark logoUrl={logoUrl} alt={companyName} />
      </div>
      <div style={{ borderTop: `1px solid ${C.rule}` }} />
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.08em' }}>QUOTE</div>
        <div style={{ fontSize: 13, color: C.text }}>Date: {document.meta.quote_date || '-'}</div>
      </div>
    </header>
  )
}

function formatCustomerLines(document: CustomerEstimateDocument) {
  const lines: string[] = []
  const customer = document.customer
  if (customer.name) lines.push(customer.name)
  if (customer.address) {
    lines.push(...customer.address.split('\n').map((line) => line.trim()).filter(Boolean))
  } else {
    const line1 = [customer.street].filter(Boolean).join(' ').trim()
    const line2 = [customer.city, [customer.state, customer.zip].filter(Boolean).join(' ').trim()]
      .filter(Boolean)
      .join(', ')
    if (line1) lines.push(line1)
    if (line2) lines.push(line2)
  }
  return lines
}

function CustomerBlock({ document }: { document: CustomerEstimateDocument }) {
  const lines = formatCustomerLines(document)
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <div style={sectionTitleStyle()}>Customer:</div>
      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45 }}>
        {lines.length > 0 ? lines.map((line) => <div key={line}>{line}</div>) : <div>-</div>}
      </div>
    </section>
  )
}

function ScopeTable({ rows }: { rows: CustomerEstimateQuoteRow[] }) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '16%' }} />
          <col style={{ width: '66%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.rule}` }}>
            <th style={{ textAlign: 'left', padding: '8px 10px 10px 0', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Scope</th>
            <th style={{ textAlign: 'left', padding: '8px 10px 10px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Description</th>
            <th style={{ textAlign: 'right', padding: '8px 0 10px 10px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: `1px solid rgba(0,0,0,0.05)` }}>
              <td style={{ padding: '12px 10px 12px 0', fontSize: 13.2, fontWeight: 800, verticalAlign: 'top' }}>{row.label}</td>
              <td style={{ padding: '12px 10px', fontSize: 13.2, lineHeight: 1.6, verticalAlign: 'top' }}>
                {stripLeadingLabel(row.label, row.description)}
              </td>
              <td style={{ padding: '12px 0 12px 10px', fontSize: 13.2, fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                {fmtCurrency(row.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function getQuoteRows(document: CustomerEstimateDocument) {
  if (document.quote_rows?.length) return document.quote_rows
  return document.scopes
    .filter((section) => section.price != null && section.text.trim())
    .map((section) => ({
      key: section.key,
      label: section.label,
      description: section.text.trim(),
      price: section.price ?? 0,
    }))
}

function TotalRow({ total }: { total: number | null }) {
  return (
    <div
      style={{
        marginTop: 4,
        borderTop: `2px solid ${C.rule}`,
        paddingTop: 10,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'baseline',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 900, letterSpacing: '0.05em' }}>TOTAL</div>
      <div style={{ fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap' }}>{fmtCurrency(total) || '-'}</div>
    </div>
  )
}

function TermsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 14.5, fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 12.9, lineHeight: 1.72 }}>{children}</div>
    </section>
  )
}

function IncludedPreparation() {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <div style={sectionTitleStyle()}>Included Preparation</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Walls:</div>
          <div style={{ fontSize: 12.8, lineHeight: 1.65 }}>
            Fill minor nail holes, patch minor surface imperfections, sand patched areas, and spot-prime repairs as needed.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Ceilings:</div>
          <div style={{ fontSize: 12.8, lineHeight: 1.65 }}>
            Fill minor surface imperfections, sand patched areas, and spot-prime repairs as needed.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Trim:</div>
          <div style={{ fontSize: 12.8, lineHeight: 1.65 }}>
            Clean and degrease, caulk gaps, fill minor holes, sand, and spot-prime bare or repaired areas as needed.
          </div>
        </div>
      </div>
    </section>
  )
}

function TermsPage({ document }: { document: CustomerEstimateDocument }) {
  return (
    <div style={pageStyle()}>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.06em' }}>QUOTE TERMS</div>

        <IncludedPreparation />

        <TermsSection title="Customer Responsibilities">
          Customer is responsible for removing fragile, valuable, or small personal items from work areas prior to the start of work.
          Customer is also responsible for removing wall hangings, artwork, televisions, curtains, and other mounted or decorative items unless otherwise agreed.
          Moving heavy furniture is not included unless specifically stated in this quote.
        </TermsSection>

        <TermsSection title="Exclusions">
          This quote includes only the specific walls, ceilings, trim, doors, closets, and other areas identified in the scope above.
          Any items or areas not specifically listed are excluded unless otherwise noted.
          Major drywall or plaster repair, water-damage repair, and wallpaper removal are not included unless specifically stated.
        </TermsSection>

        <TermsSection title="Changes to Scope">
          Any work requested outside the scope of this quote will be discussed and approved before the work is performed.
          Additional labor and materials will be billed separately.
          Additional colors beyond the original scope may affect price.
        </TermsSection>

        <TermsSection title="Pricing & Payment Terms">
          <div>Make all checks payable to ACE Painting LLC.</div>
          <div style={{ marginTop: 6 }}>This quote includes labor and all materials and supplies unless otherwise noted.</div>
          <div>Pricing is valid for {document.quote_validity_days} days from the date of this quote.</div>
          <div>A 1/3 deposit may be required for scheduling or special-order materials. The remaining balance is due upon completion unless otherwise agreed in writing.</div>
          <div>Credit card payments are subject to a 2.9% processing fee.</div>
        </TermsSection>

        <TermsSection title="Insurance">
          ACE Painting LLC is fully insured. Certificate of Insurance available upon request.
        </TermsSection>

        <TermsSection title="Thank you">
          Thank you for the opportunity to earn your business.
        </TermsSection>
      </div>
    </div>
  )
}

function DocumentPage({ document }: { document: CustomerEstimateDocument }) {
  const rows = getQuoteRows(document)
  return (
    <div style={pageStyle()}>
      <Header document={document} />
      <CustomerBlock document={document} />
      <ScopeTable rows={rows} />
      <TotalRow total={document.total} />
      <div style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: -2 }}>
        This quote is subject to the terms and conditions on page 2.
      </div>
    </div>
  )
}

export function CustomerEstimateDocumentView({
  document,
  showShell = true,
}: {
  document: CustomerEstimateDocument
  showShell?: boolean
}) {
  const pages = (
    <div style={{ display: 'grid', gap: 24 }}>
      <DocumentPage document={document} />
      <TermsPage document={document} />
    </div>
  )

  if (!showShell) return pages

  return (
    <div style={{ background: '#f3f3f3', padding: 18 }}>
      {pages}
    </div>
  )
}

export function PublicChrome({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#f3f3f3', color: C.text, fontFamily: "'Arial', sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, fontWeight: 700 }}>
              Customer Quote
            </div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{title}</div>
            {subtitle ? <div style={{ fontSize: 13, color: C.muted }}>{subtitle}</div> : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{children}</div>
        </div>
      </div>
    </div>
  )
}
