import { randomUUID } from 'node:crypto'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { assertEpisodeId, handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
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
  const b = await readJson<{ episodeId?: unknown }>(req)
  if (typeof b.episodeId !== 'string' || !b.episodeId) throw new HttpError(400, 'Falta el registro a enviar.')
  assertEpisodeId(b.episodeId)

  const [ep] = await db.select({ id: episode.id }).from(episode).where(eq(episode.id, b.episodeId)).limit(1)
  if (!ep) throw new HttpError(404, 'No encontramos ese ingreso.')

  const [dup] = await db
    .select({ id: birthRecord.id })
    .from(birthRecord)
    .where(and(eq(birthRecord.episodeId, ep.id), isNull(birthRecord.deletedAt)))
    .limit(1)
  if (dup) return Response.json({ id: dup.id, already: true })

  const fields = await getBookFields()
  const id = randomUUID()
  await db.insert(birthRecord).values({
    id,
    episodeId: ep.id,
    data: withDefaults({}, fields, ctx, true),
    createdBy: ctx.staffId,
    createdByName: ctx.name,
    updatedByName: ctx.name,
  })
  await audit(ctx, 'crear', 'libro', ep.id, `Enviado desde Neonatología ${id.slice(0, 8)}`)
  return Response.json({ id, already: false })
})
