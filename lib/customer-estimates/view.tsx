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
  const logoUrl = getBrandLogoUrl(document.header.logo_url)
  const companyName = document.header.company_name
  return (
    <header style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 14, alignItems: 'start' }}>
        <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          <div style={{ fontWeight: 800 }}>{companyName}</div>
          {document.header.contact_lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <LogoMark logoUrl={logoUrl} alt={companyName} />
      </div>
      <div style={{ borderTop: `1px solid ${C.rule}` }} />
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.08em' }}>
          {document.header.document_label}
        </div>
        <div style={{ fontSize: 13, color: C.text }}>Date: {document.header.quote_date_label}</div>
      </div>
    </header>
  )
}

function CustomerBlock({ document }: { document: CustomerEstimateDocument }) {
  const lines = document.customer_block.lines
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

function TermsPage({ document }: { document: CustomerEstimateDocument }) {
  return (
    <div style={pageStyle()}>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.06em' }}>
          {document.terms_page.title}
        </div>

        {document.terms_page.sections.map((section) => (
          <TermsSection key={section.key} title={section.title}>
            <div style={{ display: 'grid', gap: 6 }}>
              {section.paragraphs.map((paragraph) => (
                <div key={paragraph}>{paragraph}</div>
              ))}
            </div>
          </TermsSection>
        ))}
      </div>
    </div>
  )
}

function DocumentPage({ document }: { document: CustomerEstimateDocument }) {
  const rows = document.pricing_block.rows
  return (
    <div style={pageStyle()}>
      <Header document={document} />
      <CustomerBlock document={document} />
      <ScopeTable rows={rows} />
      <TotalRow total={document.pricing_block.total} />
      <div style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: -2 }}>
        {document.pricing_block.footer_note}
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
