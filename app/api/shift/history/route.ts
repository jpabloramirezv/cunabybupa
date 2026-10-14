import { and, gte, inArray, lt, or } from 'drizzle-orm'
import { handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode, episodeBlock, episodeIdentity, shiftClosure, staff } from '@/lib/db/schema'
import { episodeCode } from '@/lib/rules'
import { addDaysYmd, endOfDay, previousShift, shiftOf, startOfDay, todayYmd, zonedParts, type ShiftInfo } from '@/lib/time'
import type { ShiftEvent, ShiftHistoryEntry, ShiftHistoryPayload } from '@/lib/types'

const pad = (n: number) => String(n).padStart(2, '0')

export const GET = handle(async (req) => {
  const ctx = await requireCtx('clinical')
  const url = new URL(req.url)
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 14, 1), 60)
  const mine = url.searchParams.get('mine') === '1'

  const ymdOf = (s: ShiftInfo) => {
    const p = zonedParts(s.start)
    return `${p.y}-${pad(p.mo)}-${pad(p.d)}`
  }
  const isYmd = (v: string | null): v is string => !!v && startOfDay(v) !== null
  const rawFrom = url.searchParams.get('from')
  const rawTo = url.searchParams.get('to')

  const current = shiftOf(new Date())
  const shifts: ShiftInfo[] = []
  let rangeFrom: string | null = null
  let rangeTo: string | null = null
  if (isYmd(rawFrom) || isYmd(rawTo)) {
    const today = todayYmd()
    let a = isYmd(rawFrom) ? rawFrom : (rawTo as string)
    let b = isYmd(rawTo) ? rawTo : a
    if (a > b) [a, b] = [b, a]
    if (b > today) b = today
    if (a > b) a = b
    const maxSpan = addDaysYmd(b, -89)
    if (a < maxSpan) a = maxSpan
    rangeFrom = a
    rangeTo = b
    let s = shiftOf(new Date(endOfDay(b)!.getTime() - 1))
    while (ymdOf(s) >= a) {
      shifts.push(s)
      s = previousShift(s)
    }
  } else {
    shifts.push(current)
    while (shifts.length < days * 2) shifts.push(previousShift(shifts[shifts.length - 1]))
  }
  if (!shifts.length) shifts.push(current)
  const from = shifts[shifts.length - 1].start
  const to = shifts[0].end > current.end ? current.end : shifts[0].end

  const created = await db
    .select({ id: episode.id, seq: episode.seq, createdAt: episode.createdAt, createdBy: episode.createdBy })
    .from(episode)
    .where(and(gte(episode.createdAt, from), lt(episode.createdAt, to)))
  const discharged = await db
    .select({ id: episode.id, seq: episode.seq, at: episode.altaConfirmedAt })
    .from(episode)
    .where(and(gte(episode.altaConfirmedAt, from), lt(episode.altaConfirmedAt, to)))
  const relatedIds = [...new Set([...created.map((c) => c.id), ...discharged.map((d) => d.id)])]

  const blocks = await db
    .select()
    .from(episodeBlock)
    .where(
      relatedIds.length
        ? or(
            and(gte(episodeBlock.updatedAt, from), lt(episodeBlock.updatedAt, to)),
            inArray(episodeBlock.episodeId, relatedIds),
          )
        : and(gte(episodeBlock.updatedAt, from), lt(episodeBlock.updatedAt, to)),
    )

  const seqRows = new Map<string, number>([...created, ...discharged].map((r) => [r.id, r.seq]))
  const editedOnly = [...new Set(blocks.map((b) => b.episodeId))].filter((id) => !seqRows.has(id))
  if (editedOnly.length) {
    const more = await db.select({ id: episode.id, seq: episode.seq }).from(episode).where(inArray(episode.id, editedOnly))
    for (const m of more) seqRows.set(m.id, m.seq)
  }

  const staffRows = await db.select({ id: staff.id, name: staff.name }).from(staff)
  const staffName = new Map(staffRows.map((s) => [s.id, s.name]))

  const keys = shifts.map((s) => s.key)
  const closureRows = await db.select().from(shiftClosure).where(inArray(shiftClosure.shiftKey, keys))

  const blockStaff = (episodeId: string, block: string) => {
    const b = blocks.find((x) => x.episodeId === episodeId && x.block === block)
    return b ? { id: b.staffId, name: b.staffName } : null
  }

  const eventsByShift = new Map<string, ShiftEvent[]>()
  const push = (ev: ShiftEvent) => {
    const k = shiftOf(new Date(ev.at)).key
    const list = eventsByShift.get(k) ?? []
    list.push(ev)
    eventsByShift.set(k, list)
  }

  for (const c of created) {
    const s = c.createdBy != null ? { id: c.createdBy, name: staffName.get(c.createdBy) ?? null } : blockStaff(c.id, 'ingreso')
    push({
      episodeId: c.id,
      code: episodeCode(c.seq),
      kind: 'ingreso',
      at: c.createdAt.toISOString(),
      staffId: s?.id ?? null,
      staffName: s?.name ?? null,
    })
  }
  for (const d of discharged) {
    if (!d.at) continue
    const s = blockStaff(d.id, 'alta')
    push({
      episodeId: d.id,
      code: episodeCode(d.seq),
      kind: 'egreso',
      at: d.at.toISOString(),
      staffId: s?.id ?? null,
      staffName: s?.name ?? null,
    })
  }

  const seen = new Set<string>()
  for (const b of blocks) {
    if (b.updatedAt < from || b.updatedAt >= to) continue
    const shiftKey = shiftOf(b.updatedAt).key
    const list = eventsByShift.get(shiftKey) ?? []
    const covered = list.some((e) => e.episodeId === b.episodeId && e.staffId === b.staffId && e.kind !== 'edicion')
    const dedupe = `${shiftKey}|${b.episodeId}|${b.staffId}`
    if (covered || seen.has(dedupe)) continue
    seen.add(dedupe)
    const seq = seqRows.get(b.episodeId)
    if (seq == null) continue
    push({
      episodeId: b.episodeId,
      code: episodeCode(seq),
      kind: 'edicion',
      at: b.updatedAt.toISOString(),
      staffId: b.staffId,
      staffName: b.staffName,
    })
  }

  if (ctx.canIdentity) {
    const ids = [...new Set([...eventsByShift.values()].flat().map((e) => e.episodeId))]
    if (ids.length) {
      const idRows = await db
        .select({ id: episodeIdentity.episodeId, name: episodeIdentity.patientName })
        .from(episodeIdentity)
        .where(inArray(episodeIdentity.episodeId, ids))
      const names = new Map(idRows.map((r) => [r.id, r.name]))
      for (const list of eventsByShift.values()) for (const e of list) e.patientName = names.get(e.episodeId) ?? null
    }
  }

  const entries: ShiftHistoryEntry[] = []
  for (const s of shifts) {
    let events = (eventsByShift.get(s.key) ?? []).sort((a, b) => b.at.localeCompare(a.at))
    let closures = closureRows
      .filter((c) => c.shiftKey === s.key)
      .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime())
    if (mine) {
      events = events.filter((e) => e.staffId === ctx.staffId)
      closures = closures.filter((c) => c.staffId === ctx.staffId)
    }
    const isCurrent = s.key === current.key
    if (!events.length && !closures.length && !(isCurrent && !mine)) continue

    const people = new Map<number, ShiftHistoryEntry['people'][number]>()
    for (const e of events) {
      if (e.staffId == null) continue
      const p = people.get(e.staffId) ?? {
        staffId: e.staffId,
        name: e.staffName ?? 'Sin nombre',
        ingresos: 0,
        egresos: 0,
        ediciones: 0,
      }
      if (e.kind === 'ingreso') p.ingresos++
      else if (e.kind === 'egreso') p.egresos++
      else p.ediciones++
      people.set(e.staffId, p)
    }

    const sp = zonedParts(s.start)
    entries.push({
      key: s.key,
      kind: s.kind,
      label: s.label,
      ymd: `${sp.y}-${pad(sp.mo)}-${pad(sp.d)}`,
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      isCurrent,
      ingresos: events.filter((e) => e.kind === 'ingreso').length,
      egresos: events.filter((e) => e.kind === 'egreso').length,
      ediciones: events.filter((e) => e.kind === 'edicion').length,
      people: [...people.values()].sort((a, b) => b.ingresos + b.egresos + b.ediciones - (a.ingresos + a.egresos + a.ediciones)),
      closures: closures.map((c) => ({
        staffId: c.staffId,
        staffName: c.staffName,
        closedAt: c.closedAt.toISOString(),
        episodeCount: c.episodeCount,
        pendingCount: c.pendingCount,
      })),
      events,
    })
  }

  const payload: ShiftHistoryPayload = {
    me: { staffId: ctx.staffId, name: ctx.name },
    mine,
    days,
    range: rangeFrom && rangeTo ? { from: rangeFrom, to: rangeTo } : null,
    shifts: entries,
  }
  return Response.json(payload)
})
