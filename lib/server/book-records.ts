import { and, asc, eq, isNull } from 'drizzle-orm'
import { TZ } from '@/lib/config'
import type { Ctx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord, episode } from '@/lib/db/schema'
import { episodeCode } from '@/lib/rules'
import {
  effectiveValues,
  resolveLinked,
  type BookFieldRow,
  type BookRecordOut,
} from '@/lib/server/book'

const nowParts = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
  return { date: `${p('year')}-${p('month')}-${p('day')}`, time: `${p('hour')}:${p('minute')}` }
}

/** Valores iniciales: fecha y hora actuales, y la matrona neonatal que crea el registro. */
export function withDefaults(
  data: Record<string, string>,
  fields: BookFieldRow[],
  ctx: Ctx,
  touchedNeonatal: boolean,
) {
  const out = { ...data }
  const now = nowParts()
  if (!out.fecha) out.fecha = now.date
  if (!out.hora) out.hora = now.time
  // La matrona neo ATI no se escribe a mano: la fija el sistema con quien registra, para no duplicar nombres.
  if (ctx.canEditNeonatal && (touchedNeonatal || Object.keys(out).some((k) => k !== 'fecha' && k !== 'hora'))) {
    for (const f of fields) {
      if (f.source === 'user' && f.section === 'neonatal' && !out[f.key]) out[f.key] = ctx.name
    }
  }
  return out
}

export async function listRecords(fields: BookFieldRow[]): Promise<BookRecordOut[]> {
  const rows = await db
    .select({ r: birthRecord, epSeq: episode.seq })
    .from(birthRecord)
    .leftJoin(episode, eq(episode.id, birthRecord.episodeId))
    .where(isNull(birthRecord.deletedAt))
    .orderBy(asc(birthRecord.createdAt))
  const linked = await resolveLinked(
    rows.map((x) => x.r.episodeId),
    fields,
  )
  const ymd = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

  const built = rows.map(({ r, epSeq }) => {
    const code = epSeq != null ? episodeCode(epSeq) : null
    const l = (r.episodeId && linked.get(r.episodeId)) || {}
    const data = r.data ?? {}
    const values = effectiveValues(data, l)
    return {
      id: r.id,
      seq: r.seq,
      episodeId: r.episodeId,
      episodeCode: code ?? null,
      data,
      linked: l,
      values,
      createdByName: r.createdByName,
      updatedByName: r.updatedByName,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      sortKey: `${values.fecha || ymd(r.createdAt)} ${values.hora || '00:00'} ${String(r.seq).padStart(8, '0')}`,
      year: (values.fecha || ymd(r.createdAt)).slice(0, 4),
    }
  })
  built.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  const counters = new Map<string, number>()
  return built.map(({ sortKey: _s, year, ...rest }) => {
    const n = (counters.get(year) ?? 0) + 1
    counters.set(year, n)
    return { ...rest, n }
  })
}

export async function getRecord(id: string, fields: BookFieldRow[]) {
  const all = await listRecords(fields)
  return all.find((r) => r.id === id) ?? null
}

export const activeRecord = (id: string) => and(eq(birthRecord.id, id), isNull(birthRecord.deletedAt))
