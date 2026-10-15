import { randomUUID } from 'node:crypto'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { assertEpisodeId, handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { linkCode } from '@/lib/book-flow'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord, episode } from '@/lib/db/schema'
import { getBookFields } from '@/lib/server/book'
import { withDefaults } from '@/lib/server/book-records'

/** Ingresos de la Pizarra que ya tienen una fila activa en el libro: id del ingreso -> id de la fila. */
export const GET = handle(async () => {
  const ctx = await requireCtx()
  if (!ctx.canBook) throw new HttpError(403, 'Tu rol no permite abrir el libro.')
  const rows = await db
    .select({ episodeId: birthRecord.episodeId, id: birthRecord.id })
    .from(birthRecord)
    .where(and(isNotNull(birthRecord.episodeId), isNull(birthRecord.deletedAt)))
  const sent: Record<string, string> = {}
  for (const r of rows) if (r.episodeId) sent[r.episodeId] = r.id
  return Response.json({ sent })
})

/**
 * Envía un ingreso de Neonatología al libro con un solo gesto: crea la fila vinculada y los datos
 * clínicos llegan solos. Si ya estaba en el libro, devuelve esa fila en vez de duplicarla.
 */
export const POST = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canBook || !ctx.canEditNeonatal) throw new HttpError(403, 'Tu perfil no puede enviar registros al libro.')
  const b = await readJson<{ episodeId?: unknown; recordId?: unknown }>(req)
  if (typeof b.episodeId !== 'string' || !b.episodeId) throw new HttpError(400, 'Falta el registro a enviar.')
  assertEpisodeId(b.episodeId)
  const recordId = typeof b.recordId === 'string' && b.recordId ? b.recordId : null

  const [ep] = await db.select({ id: episode.id }).from(episode).where(eq(episode.id, b.episodeId)).limit(1)
  if (!ep) throw new HttpError(404, 'No encontramos ese ingreso.')

  const [dup] = await db
    .select({ id: birthRecord.id, seq: birthRecord.seq })
    .from(birthRecord)
    .where(and(eq(birthRecord.episodeId, ep.id), isNull(birthRecord.deletedAt)))
    .limit(1)
  if (dup) return Response.json({ id: dup.id, code: linkCode(dup.seq), already: true, mode: 'existing' })

  const fields = await getBookFields()

  if (recordId) {
    const [row] = await db
      .select()
      .from(birthRecord)
      .where(and(eq(birthRecord.id, recordId), isNull(birthRecord.deletedAt)))
      .limit(1)
    if (!row) throw new HttpError(404, 'Esa fila del libro ya no está disponible.')
    if (row.episodeId) throw new HttpError(409, 'Esa fila del libro ya está vinculada a otro ingreso.')
    await db
      .update(birthRecord)
      .set({
        episodeId: ep.id,
        data: withDefaults((row.data ?? {}) as Record<string, string>, fields, ctx, true),
        updatedAt: new Date(),
        updatedByName: ctx.name,
      })
      .where(eq(birthRecord.id, row.id))
    await audit(ctx, 'modificar', 'libro', ep.id, `Ingreso incorporado a fila existente ${row.id.slice(0, 8)}`)
    return Response.json({ id: row.id, code: linkCode(row.seq), already: false, mode: 'linked' })
  }

  const id = randomUUID()
  const [created] = await db
    .insert(birthRecord)
    .values({
      id,
      episodeId: ep.id,
      data: withDefaults({}, fields, ctx, true),
      createdBy: ctx.staffId,
      createdByName: ctx.name,
      updatedByName: ctx.name,
    })
    .returning({ seq: birthRecord.seq })
  await audit(ctx, 'crear', 'libro', ep.id, `Enviado desde Neonatología ${id.slice(0, 8)}`)
  return Response.json({ id, code: linkCode(created.seq), already: false, mode: 'new' })
})
