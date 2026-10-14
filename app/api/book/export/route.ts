import { handle, HttpError } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { getBookFields } from '@/lib/server/book'
import { listRecords } from '@/lib/server/book-records'

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV con el mismo orden de columnas del Libro de Partos y Abortos, listo para abrir en Excel. */
export const GET = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canBook) throw new HttpError(403, 'Tu rol no permite exportar el libro.')
  const year = new URL(req.url).searchParams.get('year')
  const fields = await getBookFields()
  const records = (await listRecords(fields)).filter(
    (r) => !year || (r.values.fecha || r.createdAt).slice(0, 4) === year,
  )
  const lines = [
    ['N°', ...fields.map((f) => f.label)].map(cell).join(';'),
    ...records.map((r) => [r.n, ...fields.map((f) => r.values[f.key] ?? '')].map(cell).join(';')),
  ]
  await audit(ctx, 'exportar', 'libro', null, `${records.length} filas${year ? ` (${year})` : ''}`)
  return new Response('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="libro-partos-y-abortos${year ? `-${year}` : ''}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
})
