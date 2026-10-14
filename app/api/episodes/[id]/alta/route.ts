import { eq } from 'drizzle-orm'
import { assertEpisodeId, handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode, episodeBlock } from '@/lib/db/schema'
import { buildDetails } from '@/lib/server/episodes'
import { recordChanges } from '@/lib/server/revisions'

type Params = { params: Promise<{ id: string }> }

/** Confirma el alta. Solo cierra el registro si están todos los obligatorios. */
export const POST = handle<Params>(async (req, { params }) => {
  const ctx = await requireCtx('write')
  const { id } = await params
  assertEpisodeId(id)
  const body = await readJson<{ ackPending?: boolean }>(req)
  const [row] = await db.select().from(episode).where(eq(episode.id, id)).limit(1)
  if (!row) throw new HttpError(404, 'No encontramos este registro.')
  const [detail] = await buildDetails([row])

  if (detail.altaMissing.length > 0) {
    return Response.json(
      { error: 'Faltan datos obligatorios del alta.', missing: detail.altaMissing },
      { status: 422 },
    )
  }
  if (detail.pendingKinds.length > 0 && !body.ackPending) {
    return Response.json(
      {
        error: 'Hay tamizajes pendientes.',
        needsAck: true,
        pending: detail.pendingKinds,
      },
      { status: 409 },
    )
  }

  const now = new Date()
  await db
    .update(episode)
    .set({ altaConfirmedAt: row.altaConfirmedAt ?? now, status: 'cerrado', updatedAt: now })
    .where(eq(episode.id, id))
  await db
    .insert(episodeBlock)
    .values({ episodeId: id, block: 'alta', staffId: ctx.staffId, staffName: ctx.name, updatedAt: now })
    .onConflictDoUpdate({
      target: [episodeBlock.episodeId, episodeBlock.block],
      set: { staffId: ctx.staffId, staffName: ctx.name, updatedAt: now },
    })
  if (!row.altaConfirmedAt) {
    await recordChanges(ctx, id, [
      {
        block: 'alta',
        field: 'alta',
        oldValue: null,
        newValue: detail.pendingKinds.length
          ? `Alta confirmada con pendientes: ${detail.pendingKinds.join(', ')}`
          : 'Alta confirmada',
      },
    ])
  }
  await audit(
    ctx,
    'modificar',
    'alta',
    id,
    detail.pendingKinds.length ? `Alta confirmada con pendientes: ${detail.pendingKinds.join(', ')}` : 'Alta confirmada',
  )
  return Response.json({ ok: true })
})
