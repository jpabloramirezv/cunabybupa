import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { assertEpisodeId, handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord, episode } from '@/lib/db/schema'
import { canonicalizeBookDoctors, getBookFields, sanitizeData } from '@/lib/server/book'
import { getRecord, listRecords, withDefaults } from '@/lib/server/book-records'

export const GET = handle(async () => {
  const ctx = await requireCtx()
  if (!ctx.canBook) throw new HttpError(403, 'Tu rol no permite abrir el libro.')
  const fields = await getBookFields()
  const records = await listRecords(fields)
  return Response.json({ fields, records })
})

export const POST = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canBook) throw new HttpError(403, 'Tu rol no permite crear registros del libro.')
  const b = await readJson<{ data?: unknown; episodeId?: unknown }>(req)
  const fields = await getBookFields()
  const { data, errors } = sanitizeData(b.data, fields, {
    materno: ctx.canEditMaternity,
    neonatal: ctx.canEditNeonatal,
  })
  if (errors.length) throw new HttpError(422, errors[0])
  await canonicalizeBookDoctors(data, fields)

  let episodeId: string | null = null
  if (typeof b.episodeId === 'string' && b.episodeId) {
    assertEpisodeId(b.episodeId)
    const [ep] = await db.select({ id: episode.id }).from(episode).where(eq(episode.id, b.episodeId)).limit(1)
    if (!ep) throw new HttpError(404, 'No encontramos ese ingreso de UPC.')
    episodeId = ep.id
    const [dup] = await db
      .select({ id: birthRecord.id })
      .from(birthRecord)
      .where(and(eq(birthRecord.episodeId, ep.id), isNull(birthRecord.deletedAt)))
      .limit(1)
    if (dup) throw new HttpError(409, 'Este recién nacido ya tiene una fila en el libro. Ábrela para completarla en vez de crear otra.')
  }

  const touchedNeonatal = fields.some((f) => f.section === 'neonatal' && f.key in data)
  const id = randomUUID()
  await db.insert(birthRecord).values({
    id,
    episodeId,
    data: withDefaults(data, fields, ctx, touchedNeonatal),
    createdBy: ctx.staffId,
    createdByName: ctx.name,
    updatedByName: ctx.name,
  })
  await audit(ctx, 'crear', 'libro', episodeId, `Registro ${id.slice(0, 8)}`)
  return Response.json({ id, record: await getRecord(id, fields) })
})
