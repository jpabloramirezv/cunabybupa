import { desc, isNull } from 'drizzle-orm'
import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord } from '@/lib/db/schema'
import { getBookFields } from '@/lib/server/book'

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/**
 * Valores ya escritos en una columna de tipo "sugerencias" (por ejemplo la matrona del equipo quirúrgico),
 * del más usado al menos usado, para elegir el nombre existente en vez de duplicarlo con otra escritura.
 */
export const GET = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canBook) throw new HttpError(403, 'Tu rol no permite abrir el libro.')
  const key = new URL(req.url).searchParams.get('key') ?? ''
  const fields = await getBookFields()
  const field = fields.find((f) => f.key === key && f.type === 'suggest')
  if (!field) throw new HttpError(400, 'Esta columna no tiene sugerencias.')

  const rows = await db
    .select({ data: birthRecord.data })
    .from(birthRecord)
    .where(isNull(birthRecord.deletedAt))
    .orderBy(desc(birthRecord.updatedAt))
    .limit(3000)

  const seen = new Map<string, { value: string; count: number }>()
  for (const r of rows) {
    const raw = ((r.data ?? {}) as Record<string, unknown>)[key]
    const value = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : ''
    if (!value) continue
    const k = fold(value)
    const hit = seen.get(k)
    if (hit) hit.count += 1
    else seen.set(k, { value, count: 1 })
  }
  const values = [...seen.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'))
    .map((v) => v.value)
  return Response.json({ values })
})
