import type {
  CustomerEstimateDocument,
  CustomerEstimateQuoteRow,
  CustomerEstimateTermsSection,
} from '@/lib/customer-estimates/types'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LINE_GAP = 4

type PdfFont = 'regular' | 'bold'

type PdfPage = {
  commands: string[]
}

type PdfCursor = {
  page: PdfPage
  y: number
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sanitizePdfText(value: string) {
  return value
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapePdfString(value: string) {
  return sanitizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return ''
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function textWidth(text: string, fontSize: number) {
  return sanitizePdfText(text).length * fontSize * 0.52
}

function wrapText(text: string, fontSize: number, maxWidth: number) {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (textWidth(candidate, fontSize) <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function addTextCommand(page: PdfPage, text: string, x: number, y: number, size: number, font: PdfFont) {
  const fontName = font === 'bold' ? 'F2' : 'F1'
  page.commands.push(`BT /${fontName} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfString(text)}) Tj ET`)
}

function addLineCommand(page: PdfPage, x1: number, y1: number, x2: number, y2: number) {
  page.commands.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`)
}

function createPage(pages: PdfPage[]) {
  const page: PdfPage = { commands: [] }
  pages.push(page)
  return page
}

function ensureSpace(cursor: PdfCursor, pages: PdfPage[], needed: number) {
  if (cursor.y - needed >= MARGIN) return
  cursor.page = createPage(pages)
  cursor.y = PAGE_HEIGHT - MARGIN
}

function addFlowText(
  cursor: PdfCursor,
  pages: PdfPage[],
  text: string,
  options: {
    x?: number
    maxWidth?: number
    size?: number
    font?: PdfFont
    gapAfter?: number
  } = {}
) {
  const x = options.x ?? MARGIN
  const size = options.size ?? 11
  const font = options.font ?? 'regular'
  const maxWidth = options.maxWidth ?? CONTENT_WIDTH
  const gapAfter = options.gapAfter ?? 0
  const lineHeight = size + LINE_GAP
  const lines = wrapText(text, size, maxWidth)

  for (const line of lines) {
    ensureSpace(cursor, pages, lineHeight)
    addTextCommand(cursor.page, line, x, cursor.y, size, font)
    cursor.y -= lineHeight
  }
  cursor.y -= gapAfter
}

function addSectionHeading(
  cursor: PdfCursor,
  pages: PdfPage[],
  text: string,
  options: { size?: number; gapAfter?: number } = {}
) {
  const size = options.size ?? 13
  ensureSpace(cursor, pages, size + LINE_GAP + (options.gapAfter ?? 2))
  addFlowText(cursor, pages, text, { size, font: 'bold', gapAfter: options.gapAfter ?? 2 })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isQuoteRow(value: unknown): value is CustomerEstimateQuoteRow {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.label === 'string' &&
    typeof value.description === 'string' &&
    typeof value.price === 'number' &&
    Number.isFinite(value.price)
  )
}

function isTermsSection(value: unknown): value is CustomerEstimateTermsSection {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.title === 'string' &&
    isStringArray(value.paragraphs)
  )
}

export function readCustomerSendPdfDocument(value: unknown): CustomerEstimateDocument | null {
  if (!isRecord(value)) return null
  if (!isRecord(value.meta) || typeof value.meta.estimate_id !== 'string') return null
  if (!isRecord(value.company) || typeof value.company.business_name !== 'string') return null
  if (!isRecord(value.customer) || typeof value.customer.address !== 'string') return null
  if (!isRecord(value.header) || !isStringArray(value.header.contact_lines)) return null
  if (
    !isRecord(value.customer_block) ||
    !isStringArray(value.customer_block.lines) ||
    !isRecord(value.pricing_block) ||
    !Array.isArray(value.pricing_block.rows) ||
    !value.pricing_block.rows.every(isQuoteRow) ||
    !isRecord(value.terms_page) ||
    !Array.isArray(value.terms_page.sections) ||
    !value.terms_page.sections.every(isTermsSection)
  ) {
    return null
  }

  return value as CustomerEstimateDocument
}

function normalizeQuoteRows(rows: CustomerEstimateQuoteRow[]): CustomerEstimateQuoteRow[] {
  return rows
    .map((row) => ({
      key: row.key,
      label: asText(row.label),
      description: asText(row.description),
      price: asNumber(row.price) ?? 0,
    }))
    .filter((row) => !!row.label)
}

function normalizeTermsSections(sections: CustomerEstimateTermsSection[]): CustomerEstimateTermsSection[] {
  return sections
    .map((section) => ({
      key: asText(section.key),
      title: asText(section.title),
      paragraphs: section.paragraphs.map((paragraph) => asText(paragraph)).filter(Boolean),
    }))
    .filter((section) => !!section.title)
}

function addQuotePage(cursor: PdfCursor, pages: PdfPage[], document: CustomerEstimateDocument) {
  const companyName = asText(document.header.company_name) || asText(document.company.business_name)
  addFlowText(cursor, pages, companyName, { size: 12, font: 'bold', maxWidth: CONTENT_WIDTH * 0.62 })
  for (const line of document.header.contact_lines ?? []) {
    addFlowText(cursor, pages, line, { size: 10, maxWidth: CONTENT_WIDTH * 0.62 })
  }
  cursor.y = Math.min(cursor.y, PAGE_HEIGHT - MARGIN - 62)
  addLineCommand(cursor.page, MARGIN, cursor.y, MARGIN + CONTENT_WIDTH, cursor.y)
  cursor.y -= 28

  addFlowText(cursor, pages, buildDocumentTitle(document), {
    size: 22,
    font: 'bold',
    gapAfter: 4,
  })
  addFlowText(cursor, pages, `Date: ${asText(document.header.quote_date_label) || '-'}`, {
    size: 10,
    gapAfter: 16,
  })

  addSectionHeading(cursor, pages, 'Customer:', { size: 10.5, gapAfter: 2 })
  for (const line of document.customer_block.lines ?? []) {
    addFlowText(cursor, pages, line, { size: 11, font: 'bold' })
  }
  cursor.y -= 18

  ensureSpace(cursor, pages, 34)
  addTextCommand(cursor.page, 'SCOPE', MARGIN, cursor.y, 9, 'bold')
  addTextCommand(cursor.page, 'DESCRIPTION', MARGIN + 92, cursor.y, 9, 'bold')
  addTextCommand(cursor.page, 'PRICE', MARGIN + CONTENT_WIDTH - 26, cursor.y, 9, 'bold')
  cursor.y -= 12
  addLineCommand(cursor.page, MARGIN, cursor.y, MARGIN + CONTENT_WIDTH, cursor.y)
  cursor.y -= 15

  const rows = normalizeQuoteRows(document.pricing_block.rows)
  for (const row of rows) {
    const descriptionLines = wrapText(row.description, 10.5, CONTENT_WIDTH - 178)
    const rowHeight = Math.max(34, descriptionLines.length * 15 + 18)
    ensureSpace(cursor, pages, rowHeight)
    const rowTop = cursor.y
    addTextCommand(cursor.page, row.label, MARGIN, rowTop, 10.5, 'bold')
    descriptionLines.forEach((line, index) => {
      addTextCommand(cursor.page, line, MARGIN + 92, rowTop - index * 15, 10.5, 'regular')
    })
    addTextCommand(
      cursor.page,
      formatCurrency(row.price),
      MARGIN + CONTENT_WIDTH - 64,
      rowTop,
      10.5,
      'bold'
    )
    cursor.y = rowTop - rowHeight + 8
    addLineCommand(cursor.page, MARGIN, cursor.y, MARGIN + CONTENT_WIDTH, cursor.y)
    cursor.y -= 16
  }

  ensureSpace(cursor, pages, 72)
  addLineCommand(cursor.page, MARGIN, cursor.y, MARGIN + CONTENT_WIDTH, cursor.y)
  cursor.y -= 24
  addTextCommand(cursor.page, 'TOTAL', MARGIN, cursor.y, 12, 'bold')
  addTextCommand(
    cursor.page,
    formatCurrency(document.pricing_block.total),
    MARGIN + CONTENT_WIDTH - 72,
    cursor.y,
    12,
    'bold'
  )
  cursor.y -= 26
  addFlowText(cursor, pages, document.pricing_block.footer_note, { size: 10.5 })
}

function addTermsPage(cursor: PdfCursor, pages: PdfPage[], document: CustomerEstimateDocument) {
  cursor.page = createPage(pages)
  cursor.y = PAGE_HEIGHT - MARGIN
  addFlowText(cursor, pages, asText(document.terms_page.title) || 'Terms', {
    size: 17,
    font: 'bold',
    gapAfter: 12,
  })

  for (const section of normalizeTermsSections(document.terms_page.sections)) {
    addSectionHeading(cursor, pages, section.title, { size: 12.5, gapAfter: 1 })
    for (const paragraph of section.paragraphs) {
      addFlowText(cursor, pages, paragraph, { size: 9.8, gapAfter: 3 })
    }
    cursor.y -= 3
  }
}

function buildPdfBuffer(pages: PdfPage[]) {
  const objects: string[] = []
  const addObject = (body: string) => {
    objects.push(body)
    return objects.length
  }

  const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>')
  const pagesId = addObject('')
  const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
  const pageIds: number[] = []

  for (const page of pages) {
    const stream = page.commands.join('\n')
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`)
    const pageId = addObject(
      [
        '<< /Type /Page',
        `/Parent ${pagesId} 0 R`,
        `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
        `/Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >>`,
        `/Contents ${contentId} 0 R`,
        '>>',
      ].join(' ')
    )
    pageIds.push(pageId)
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let output = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output, 'ascii'))
    output += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(output, 'ascii')
  output += `xref\n0 ${objects.length + 1}\n`
  output += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i += 1) {
    output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(output, 'ascii')
}

function sanitizeFilenamePart(value: string) {
  return sanitizePdfText(value)
    .replace(/[^a-z0-9._ -]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
    .replace(/^-|-$/g, '')
}

function normalizeDateForFilename(value: string) {
  const cleaned = sanitizePdfText(value)
  if (!cleaned) return ''

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(cleaned)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const short = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(cleaned)
  if (!short) return sanitizeFilenamePart(cleaned)

  const month = String(short[1]).padStart(2, '0')
  const day = String(short[2]).padStart(2, '0')
  const rawYear = short[3] ?? ''
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
  return `${year}-${month}-${day}`
}

function buildDocumentTitle(document: CustomerEstimateDocument) {
  const label = asText(document.header.document_label) || 'QUOTE'
  const quoteName = asText(document.meta.title)
  return quoteName ? `${label} - ${quoteName}` : label
}

function buildCustomerSendPdfFilename(document: CustomerEstimateDocument) {
  const company = sanitizeFilenamePart(asText(document.company.business_name) || asText(document.header.company_name))
  const street = sanitizeFilenamePart(asText(document.customer.street) || asText(document.customer.address))
  const date = normalizeDateForFilename(
    asText(document.meta.quote_date) || asText(document.header.quote_date_label)
  )
  const version = sanitizeFilenamePart(asText(document.meta.title) || asText(document.meta.version_name))

  const parts = [company, street, date, version]
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index)

  return `${(parts.length ? parts : ['Quote']).join('_')}.pdf`
}

export function buildCustomerSendPdfAttachment(document: CustomerEstimateDocument) {
  const pages: PdfPage[] = []
  const firstPage = createPage(pages)
  const cursor: PdfCursor = {
    page: firstPage,
    y: PAGE_HEIGHT - MARGIN,
  }

  addQuotePage(cursor, pages, document)
  addTermsPage(cursor, pages, document)

  return {
    filename: buildCustomerSendPdfFilename(document),
    contentType: 'application/pdf',
    data: buildPdfBuffer(pages),
  }
}
