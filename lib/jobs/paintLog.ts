export type PaintLogRow = {
  id?: string
  sort_order?: number
  where_used: string
  paint_product: string
  sheen: string
  color: string
  notes: string
}

type PaintLogSource = Partial<PaintLogRow> | null | undefined

export function createDefaultPaintLogRow(): PaintLogRow {
  return {
    where_used: '',
    paint_product: '',
    sheen: '',
    color: '',
    notes: '',
  }
}

export function mapPaintLogRow(row: PaintLogSource): PaintLogRow {
  return {
    id: row?.id,
    sort_order: row?.sort_order,
    where_used: row?.where_used ?? '',
    paint_product: row?.paint_product ?? '',
    sheen: row?.sheen ?? '',
    color: row?.color ?? '',
    notes: row?.notes ?? '',
  }
}
