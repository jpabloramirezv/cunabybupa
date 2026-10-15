import ExcelJS from 'exceljs'
import { handle, HttpError } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { BOOK_SECTION_LABEL } from '@/lib/book-fields'
import { getBookFields, type BookFieldRow } from '@/lib/server/book'
import { listRecords } from '@/lib/server/book-records'

export const runtime = 'nodejs'

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Evita que Excel interprete texto como fórmula (inyección de fórmulas). */
const safeText = (s: string) => (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s)

const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/
const timeRe = /^(\d{1,2}):(\d{2})$/

/** Valor tipado para la celda: fechas y números reales para poder filtrar y ordenar como en una BBDD. */
function typedValue(f: BookFieldRow, raw: string): ExcelJS.CellValue {
  const v = raw.trim()
  if (!v) return null
  if (f.type === 'date') {
    const m = isoDate.exec(v)
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  }
  if (f.type === 'time') {
    const m = timeRe.exec(v)
    if (m) return (+m[1] * 60 + +m[2]) / 1440
  }
  if (f.type === 'number' || f.type === 'decimal') {
    const n = Number(v.replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return safeText(v)
}

function numFmt(f: BookFieldRow) {
  if (f.type === 'date') return 'dd-mm-yyyy'
  if (f.type === 'time') return 'hh:mm'
  if (f.type === 'decimal') return '0.00'
  if (f.type === 'number') return '0'
  return undefined
}

const SECTION_FILL: Record<string, string> = { materno: 'FFB4236B', neonatal: 'FF0F6B8A' }
const SECTION_LIGHT: Record<string, string> = { materno: 'FFFBE4EF', neonatal: 'FFDDF0F6' }

/**
 * Excel del Libro de Partos y Abortos.
 * Hoja "Libro": mismas columnas y orden que el libro, con sección y grupo arriba.
 * Hoja "Base de datos": una sola fila de encabezado, lista para filtrar, ordenar o importar.
 */
export const GET = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canAdmin) throw new HttpError(403, 'Solo Jefatura puede descargar datos del libro.')
  const params = new URL(req.url).searchParams
  const year = params.get('year')
  const format = params.get('format') === 'csv' ? 'csv' : 'xlsx'
  const fields = await getBookFields()
  const records = (await listRecords(fields)).filter(
    (r) => !year || (r.values.fecha || r.createdAt).slice(0, 4) === year,
  )
  const suffix = year ? `-${year}` : ''
  await audit(ctx, 'exportar', 'libro', null, `${records.length} filas${year ? ` (${year})` : ''} · ${format}`)

  if (format === 'csv') {
    const lines = [
      ['N°', ...fields.map((f) => f.label)].map(csvCell).join(';'),
      ...records.map((r) => [r.n, ...fields.map((f) => r.values[f.key] ?? '')].map(csvCell).join(';')),
    ]
    return new Response('\uFEFF' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="libro-partos-y-abortos${suffix}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cuna by Bupa'
  wb.created = new Date()

  const borderThin = { style: 'thin' as const, color: { argb: 'FFB8C2CC' } }
  const border = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin }
  const head = (cell: ExcelJS.Cell, argb: string, font = 'FFFFFFFF') => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
    cell.font = { bold: true, color: { argb: font } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = border
  }

  // Hoja 1: estructura del libro (sección > grupo > columna)
  const ws = wb.addWorksheet('Libro', { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] })
  const cols = fields.length + 1
  ws.getRow(1).height = 24
  ws.getRow(2).height = 22
  ws.getRow(3).height = 34
  ws.getCell(1, 1).value = 'N°'
  ws.mergeCells(1, 1, 3, 1)
  head(ws.getCell(1, 1), 'FF2D3748')

  const spans = (pick: (f: BookFieldRow) => string) => {
    const out: { label: string; from: number; to: number; section: string }[] = []
    fields.forEach((f, i) => {
      const label = pick(f)
      const last = out[out.length - 1]
      if (last && last.label === label && last.section === f.section) last.to = i + 2
      else out.push({ label, from: i + 2, to: i + 2, section: f.section })
    })
    return out
  }
  for (const s of spans((f) => BOOK_SECTION_LABEL[f.section])) {
    ws.getCell(1, s.from).value = s.label.toUpperCase()
    if (s.to > s.from) ws.mergeCells(1, s.from, 1, s.to)
    head(ws.getCell(1, s.from), SECTION_FILL[s.section])
  }
  for (const g of spans((f) => `${f.section}|${f.group}`)) {
    ws.getCell(2, g.from).value = g.label.split('|')[1]
    if (g.to > g.from) ws.mergeCells(2, g.from, 2, g.to)
    head(ws.getCell(2, g.from), SECTION_LIGHT[g.section], 'FF1A202C')
  }
  fields.forEach((f, i) => {
    const c = ws.getCell(3, i + 2)
    c.value = f.label
    head(c, SECTION_LIGHT[f.section], 'FF1A202C')
  })

  records.forEach((r) => {
    const row = ws.addRow([r.n, ...fields.map((f) => typedValue(f, r.values[f.key] ?? ''))])
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = border
      cell.alignment = { vertical: 'top', wrapText: true }
      if (col > 1) {
        const f = fields[col - 2]
        const fmt = numFmt(f)
        if (fmt) cell.numFmt = fmt
      }
    })
  })

  ws.getColumn(1).width = 7
  fields.forEach((f, i) => {
    const longest = records.reduce((m, r) => Math.max(m, (r.values[f.key] ?? '').length), 0)
    ws.getColumn(i + 2).width = Math.min(34, Math.max(10, f.label.length + 2, Math.min(longest, 34) + 2))
  })
  if (cols > 1) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: cols } }
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

  // Hoja 2: base de datos plana
  const db = wb.addWorksheet('Base de datos', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] })
  const dbHead = ['N°', ...fields.map((f) => f.label)]
  const hr = db.addRow(dbHead)
  hr.height = 30
  hr.eachCell((cell, col) => head(cell, col === 1 ? 'FF2D3748' : SECTION_FILL[fields[col - 2].section]))
  records.forEach((r) => {
    const row = db.addRow([r.n, ...fields.map((f) => typedValue(f, r.values[f.key] ?? ''))])
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > 1) {
        const fmt = numFmt(fields[col - 2])
        if (fmt) cell.numFmt = fmt
      }
    })
  })
  db.getColumn(1).width = 7
  fields.forEach((f, i) => {
    db.getColumn(i + 2).width = Math.min(30, Math.max(12, f.label.length + 2))
  })
  db.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols } }

  const buf = await wb.xlsx.writeBuffer()
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="libro-partos-y-abortos${suffix}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
})
