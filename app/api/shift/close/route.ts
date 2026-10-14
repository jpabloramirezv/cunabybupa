import { and, gte, inArray, lt } from 'drizzle-orm'
import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx, verifyStaffPin } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode, episodeBlock, shiftClosure } from '@/lib/db/schema'
import { buildDetails } from '@/lib/server/episodes'
import { shiftFromKey } from '@/lib/time'

/** Confirma el cierre del turno con el PIN de la persona que tiene la sesión. */
export const POST = handle(async (req) => {
  const ctx = await requireCtx('write')
  const body = await readJson<{ key?: string; pin?: unknown }>(req)
  const shift = body.key ? shiftFromKey(body.key) : null
  if (!shift) throw new HttpError(400, 'Turno no válido.')
  if (shift.start.getTime() > Date.now()) throw new HttpError(400, 'Este turno aún no comienza.')
  await verifyStaffPin(ctx.staffId, body.pin)

  const touched = await db
    .selectDistinct({ id: episodeBlock.episodeId })
    .from(episodeBlock)
    .where(and(gte(episodeBlock.updatedAt, shift.start), lt(episodeBlock.updatedAt, shift.end)))
  const ids = touched.map((t) => t.id)
  const rows = ids.length ? await db.select().from(episode).where(inArray(episode.id, ids)) : []
  const details = await buildDetails(rows)
  const pendingCount = details.filter(
    (d) => d.missing.length > 0 || d.overdueKinds.length > 0,
  ).length

  await db.insert(shiftClosure).values({
    shiftKey: shift.key,
    staffId: ctx.staffId,
    staffName: ctx.name,
    episodeCount: details.length,
    pendingCount,
  })
  await audit(ctx, 'modificar', 'turno', null, `Cierre ${shift.key}: ${details.length} RN, ${pendingCount} con pendientes`)
  return Response.json({ ok: true, episodeCount: details.length, pendingCount })
})
