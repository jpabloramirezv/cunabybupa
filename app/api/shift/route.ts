import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord, episode, episodeBlock, shiftClosure } from '@/lib/db/schema'
import { attachIdentity, buildDetails } from '@/lib/server/episodes'
import type { ShiftBalance, ShiftBalanceUnit, ShiftPayload, ShiftUnitFilter } from '@/lib/types'
import { nextShift, previousShift, shiftFromKey, shiftOf } from '@/lib/time'

const emptyUnit = (): ShiftBalanceUnit => ({ censoInicio: 0, ingresos: 0, egresos: 0, censoFin: 0 })

async function computeBalance(start: Date, end: Date, unit: ShiftUnitFilter): Promise<ShiftBalance> {
  const rows = await db
    .select({ unit: episode.unit, createdAt: episode.createdAt, alta: episode.altaConfirmedAt })
    .from(episode)
    .where(and(lt(episode.createdAt, end), or(isNull(episode.altaConfirmedAt), gte(episode.altaConfirmedAt, start))))

  const byUnit = { uci: emptyUnit(), nursery: emptyUnit() }
  for (const r of rows) {
    const b = r.unit === 'nursery' ? byUnit.nursery : byUnit.uci
    const createdInShift = r.createdAt >= start
    const leftInShift = !!r.alta && r.alta >= start && r.alta < end
    if (createdInShift) b.ingresos++
    else b.censoInicio++
    if (leftInShift) b.egresos++
  }
  for (const b of [byUnit.uci, byUnit.nursery]) b.censoFin = b.censoInicio + b.ingresos - b.egresos

  const total = emptyUnit()
  for (const k of unit === 'todos' ? (['uci', 'nursery'] as const) : ([unit] as const)) {
    total.censoInicio += byUnit[k].censoInicio
    total.ingresos += byUnit[k].ingresos
    total.egresos += byUnit[k].egresos
    total.censoFin += byUnit[k].censoFin
  }

  const open = await db
    .select({ unit: episode.unit, n: sql<number>`count(*)::int` })
    .from(episode)
    .where(isNull(episode.altaConfirmedAt))
    .groupBy(episode.unit)
  const censoActual = { uci: 0, nursery: 0, total: 0 }
  for (const o of open) {
    if (o.unit === 'nursery') censoActual.nursery += o.n
    else censoActual.uci += o.n
  }
  censoActual.total = unit === 'todos' ? censoActual.uci + censoActual.nursery : censoActual[unit]

  const [libro] = await db
    .select({
      creados: sql<number>`count(*) filter (where ${birthRecord.createdAt} >= ${start} and ${birthRecord.createdAt} < ${end})::int`,
      editados: sql<number>`count(*) filter (where ${birthRecord.createdAt} < ${start} and ${birthRecord.updatedAt} >= ${start} and ${birthRecord.updatedAt} < ${end})::int`,
    })
    .from(birthRecord)
    .where(isNull(birthRecord.deletedAt))

  return {
    unit,
    total,
    byUnit,
    censoActual,
    libro: { creados: libro?.creados ?? 0, editados: libro?.editados ?? 0 },
  }
}

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
  const unitFilter: ShiftUnitFilter = unidad === 'todos' || unidad === 'nursery' ? unidad : 'uci'
  const byUnit = unitFilter === 'todos' ? undefined : eq(episode.unit, unitFilter)
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
    balance: await computeBalance(shift.start, shift.end, unitFilter),
  }
  return Response.json(payload)
})
