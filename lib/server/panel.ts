import { and, eq, gte, lt, or, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { episode, screening } from '@/lib/db/schema'
import { SCREENING_KINDS } from '@/lib/config'
import type { PanelPayload, Stat } from '@/lib/types'

type Row = typeof episode.$inferSelect

const H = 3600_000
const D = 86400_000

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

const round = (n: number | null, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d)
const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 1000) / 10)

function stat(label: string, values: number[]): Stat {
  const s = [...values].sort((a, b) => a - b)
  return { label, n: s.length, median: round(quantile(s, 0.5)), p90: round(quantile(s, 0.9)) }
}

const GA_BINS = [
  { label: '< 28 semanas', test: (w: number) => w < 28 },
  { label: '28 a 31 semanas', test: (w: number) => w >= 28 && w < 32 },
  { label: '32 a 36 semanas', test: (w: number) => w >= 32 && w < 37 },
  { label: '37 semanas o más', test: (w: number) => w >= 37 },
]

export const WEIGHT_BINS = [
  { key: 'elbw', label: 'Menos de 1.000 g', test: (g: number) => g < 1000 },
  { key: 'vlbw', label: '1.000 a 1.499 g', test: (g: number) => g >= 1000 && g < 1500 },
  { key: 'lbw', label: '1.500 a 2.499 g', test: (g: number) => g >= 1500 && g < 2500 },
  { key: 'nbw', label: '2.500 g o más', test: (g: number) => g >= 2500 },
]

export type PanelUnit = 'uci' | 'nursery' | 'todos'

export const parsePanelUnit = (v: string | null): PanelUnit =>
  v === 'nursery' || v === 'todos' ? v : 'uci'

export async function computePanel(from: Date, to: Date, unit: PanelUnit = 'uci'): Promise<PanelPayload> {
  const rows: Row[] = await db
    .select()
    .from(episode)
    .where(
      and(
        unit === 'todos' ? undefined : eq(episode.unit, unit),
        or(
          and(gte(episode.createdAt, from), lt(episode.createdAt, to)),
          and(isNotNull(episode.dischargeAt), gte(episode.dischargeAt, from), lt(episode.dischargeAt, to)),
        ),
      ),
    )

  const admitted = rows.filter((r) => r.createdAt >= from && r.createdAt < to)
  const discharged = rows.filter((r) => r.dischargeAt && r.dischargeAt >= from && r.dischargeAt < to)
  const open = rows.filter((r) => r.status !== 'cerrado').length

  const losOf = (r: Row) =>
    r.dischargeAt ? (r.dischargeAt.getTime() - (r.birthAt ?? r.createdAt).getTime()) / D : null
  const withLos = discharged.map((r) => ({ r, los: losOf(r) })).filter((x): x is { r: Row; los: number } => x.los !== null && x.los >= 0)

  const los = {
    overall: stat('Todos los egresos', withLos.map((x) => x.los)),
    byGa: GA_BINS.map((b) =>
      stat(b.label, withLos.filter((x) => x.r.gaWeeks !== null && b.test(x.r.gaWeeks)).map((x) => x.los)),
    ),
    byWeight: WEIGHT_BINS.map((b) =>
      stat(b.label, withLos.filter((x) => x.r.birthWeightG !== null && b.test(x.r.birthWeightG)).map((x) => x.los)),
    ),
  }

  const weighed = admitted.filter((r) => r.birthWeightG !== null)
  const weightDist = WEIGHT_BINS.map((b) => {
    const n = weighed.filter((r) => b.test(r.birthWeightG!)).length
    return { key: b.key, label: b.label, n, pct: pct(n, weighed.length) ?? 0 }
  })

  const dischargedIds = discharged.map((r) => r.id)
  const scr = dischargedIds.length
    ? await db.select().from(screening).where(inArray(screening.episodeId, dischargedIds))
    : []
  const byKind = SCREENING_KINDS.map((k) => {
    const mine = scr.filter((s) => s.kind === k.key && s.status !== 'no_aplica')
    const done = mine.filter((s) => s.status === 'realizado').length
    const refused = mine.filter((s) => s.status === 'rechazado').length
    return { kind: k.key, label: k.label, done, refused, total: mine.length, pct: pct(done + refused, mine.length) }
  })
  const totalAll = byKind.reduce((a, k) => a + k.total, 0)
  const doneAll = byKind.reduce((a, k) => a + k.done + k.refused, 0)

  const biliKnown = admitted.filter((r) => r.hyperbili !== null)
  const withBili = biliKnown.filter((r) => r.hyperbili)
  const photo = withBili
    .filter((r) => r.phototherapyAt)
    .map((r) => (r.phototherapyAt!.getTime() - (r.birthAt ?? r.createdAt).getTime()) / H)
    .filter((h) => h >= 0)
    .sort((a, b) => a - b)

  const fed = discharged.filter((r) => r.feedingDischarge)
  const exclusive = fed.filter((r) => r.feedingDischarge === 'exclusiva').length

  const readmittedIds = new Set(rows.map((r) => r.readmissionOf).filter(Boolean))
  const allReadmissions = discharged.length
    ? await db
        .select({ of: episode.readmissionOf })
        .from(episode)
        .where(isNotNull(episode.readmissionOf))
    : []
  for (const r of allReadmissions) if (r.of) readmittedIds.add(r.of)
  const readmitted = discharged.filter((r) => readmittedIds.has(r.id)).length

  const timed = admitted.filter((r) => r.completedAt)
  const lag = timed
    .map((r) => (r.completedAt!.getTime() - r.createdAt.getTime()) / H)
    .sort((a, b) => a - b)
  const sameShift = timed.filter((r) => r.createdShift && r.createdShift === r.completedShift).length

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    totals: { admitted: admitted.length, discharged: discharged.length, open },
    los,
    weightDist,
    screening: { n: discharged.length, overallPct: pct(doneAll, totalAll), byKind },
    bili: {
      n: biliKnown.length,
      withBili: withBili.length,
      pct: pct(withBili.length, biliKnown.length),
      phototherapyN: photo.length,
      medianHours: round(quantile(photo, 0.5)),
      p90Hours: round(quantile(photo, 0.9)),
    },
    feeding: { n: fed.length, exclusive, pct: pct(exclusive, fed.length) },
    readmission: { n: discharged.length, readmitted, pct: pct(readmitted, discharged.length) },
    timeliness: {
      n: timed.length,
      medianHours: round(quantile(lag, 0.5)),
      p90Hours: round(quantile(lag, 0.9)),
      sameShiftPct: pct(sameShift, timed.length),
    },
  }
}

export function parsePeriod(params: URLSearchParams) {
  const toRaw = params.get('to')
  const fromRaw = params.get('from')
  const to = toRaw ? new Date(toRaw) : new Date(Date.now() + D)
  const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - 31 * D)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return null
  return { from, to }
}
