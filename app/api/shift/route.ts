import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode, episodeBlock, shiftClosure } from '@/lib/db/schema'
import { attachIdentity, buildDetails } from '@/lib/server/episodes'
import type { ShiftPayload } from '@/lib/types'
import { nextShift, previousShift, shiftFromKey, shiftOf } from '@/lib/time'

export const GET = handle(async (req) => {
  const ctx = await requireCtx('clinical')
  const key = new URL(req.url).searchParams.get('key')
  const current = shiftOf(new Date())
  const shift = key ? shiftFromKey(key) : current
  if (!shift) throw new HttpError(400, 'Turno no válido.')

  const touched = await db
    .selectDistinct({ id: episodeBlock.episodeId })
    .from(episodeBlock)
    .where(and(gte(episodeBlock.updatedAt, shift.start), lt(episodeBlock.updatedAt, shift.end)))
  const created = await db
    .select({ id: episode.id })
    .from(episode)
    .where(and(gte(episode.createdAt, shift.start), lt(episode.createdAt, shift.end)))
  const ids = [...new Set([...touched.map((t) => t.id), ...created.map((c) => c.id)])]
  const unidad = new URL(req.url).searchParams.get('unidad')
  const byUnit = unidad === 'todos' ? undefined : eq(episode.unit, unidad === 'nursery' ? 'nursery' : 'uci')
  const rows = ids.length
    ? await db
        .select()
        .from(episode)
        .where(and(inArray(episode.id, ids), byUnit))
        .orderBy(desc(episode.createdAt))
    : []
  const closures = await db
    .select()
    .from(shiftClosure)
    .where(eq(shiftClosure.shiftKey, shift.key))
    .orderBy(desc(shiftClosure.closedAt))

  const next = nextShift(shift)
  const payload: ShiftPayload = {
    shift: {
      key: shift.key,
      label: shift.label,
      start: shift.start.toISOString(),
      end: shift.end.toISOString(),
      prevKey: previousShift(shift).key,
      nextKey: next.start.getTime() > Date.now() ? null : next.key,
      isCurrent: shift.key === current.key,
    },
    episodes: ctx.canIdentity ? await attachIdentity(await buildDetails(rows)) : await buildDetails(rows),
    closures: closures.map((c) => ({
      staffName: c.staffName,
      closedAt: c.closedAt.toISOString(),
      episodeCount: c.episodeCount,
      pendingCount: c.pendingCount,
    })),
  }
  return Response.json(payload)
})
