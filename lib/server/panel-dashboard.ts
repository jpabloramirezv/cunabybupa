import { and, eq, gte, isNull, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appSetting, episode } from '@/lib/db/schema'
import { CARE_LEVEL_OPTIONS } from '@/lib/config'
import { sectionProgress, segmentOf, type BookSegment } from '@/lib/book-flow'
import { getBookFields, type BookRecordOut } from '@/lib/server/book'
import { listRecords } from '@/lib/server/book-records'
import { computeBinomio, numOf, type Cross, type Item } from '@/lib/server/book-stats'
import { computePanel } from '@/lib/server/panel'
import {
  ALERTS,
  inScope,
  parseTargets,
  type DashScope,
  type IndicatorValue,
  type PanelPeriod,
  type Targets,
} from '@/lib/panel-indicators'
import { addDaysYmd, startOfDay, todayYmd, ymdInSantiago } from '@/lib/time'
import type { PanelPayload } from '@/lib/types'

export const TARGETS_KEY = 'panel_targets'

const H24 = 24 * 3600_000
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 1000) / 10)

export type DashPeriod = { key: PanelPeriod; from: string; to: string; prevFrom: string; prevTo: string; days: number }

export function resolvePeriod(key: PanelPeriod, today = todayYmd()): DashPeriod {
  const from =
    key === 'hoy'
      ? today
      : key === '7'
        ? addDaysYmd(today, -6)
        : key === 'mes'
          ? `${today.slice(0, 8)}01`
          : key === '365'
            ? addDaysYmd(today, -364)
            : addDaysYmd(today, -29)
  const days = Math.round((Date.parse(today) - Date.parse(from)) / 86400000) + 1
  const prevTo = addDaysYmd(from, -1)
  return { key, from, to: today, prevFrom: addDaysYmd(prevTo, -(days - 1)), prevTo, days }
}

export type DashAlert = { id: string; label: string; detail: string; severity: 'alta' | 'media' | 'info'; n: number }

export type QualityRow = { id: string; current: IndicatorValue; previous: IndicatorValue }

export type RobsonRow = {
  group: string
  n: number
  pctTotal: number | null
  cesareas: number
  cesareaRate: number | null
  contribution: number | null
}

export type GaRow = {
  label: string
  born: number
  hospitalized: number
  hospitalizedPct: number | null
  losN: number
  losMedian: number | null
  losP90: number | null
}

export type DashboardPayload = {
  scope: DashScope
  period: DashPeriod
  generatedAt: string
  today: {
    census: { total: number; byLevel: { label: string; n: number }[] } | null
    births24h: { births: number; abortions: number }
    upc24h: { admitted: number; discharged: number } | null
    pending: { maternity: number; neonatal: number; maternityOld: number; neonatalOld: number }
    nurseryDischarge: { today: number; missingScreening: number } | null
  }
  alerts: DashAlert[]
  quality: QualityRow[]
  targets: Targets
  activity: {
    series: { key: string; label: string; nursery: number; uci: number }[]
    granularity: 'dia' | 'mes'
    average: number
    deliveryType: { label: string; n: number; pct: number }[]
    robson: { rows: RobsonRow[]; classified: number; unclassified: number; cesareaRate: number | null }
    upcByGa: GaRow[] | null
  }
  crosses: Cross[]
}

const CROSS_IDS = new Set(['edad-prematuridad', 'control-prematuridad', 'parto-apego', 'parto-lactancia', 'parto-apgar', 'parto-uci'])
const isCesarea = (r: BookRecordOut) => (r.values.tipo_parto ?? '').toUpperCase().includes('CESÁREA')

const GA_ROWS = [
  { label: 'Menos de 28 semanas', test: (w: number) => w < 28 },
  { label: '28 a 31 semanas', test: (w: number) => w >= 28 && w < 32 },
  { label: '32 a 36 semanas', test: (w: number) => w >= 32 && w < 37 },
  { label: '37 semanas o más', test: (w: number) => w >= 37 },
]

const val = (num: number | null, den: number): IndicatorValue => ({ num, den, value: num === null ? null : pct(num, den) })
const hours = (value: number | null, den: number): IndicatorValue => ({ num: null, den, value })

/** Indicadores que se calculan desde el Libro de Partos para un período. */
function libroIndicators(
  fields: Awaited<ReturnType<typeof getBookFields>>,
  scope: DashScope,
  births: Item[],
  mothers: Item[],
): Record<string, IndicatorValue> {
  const rows = births.map((x) => x.r)
  const yes = (list: BookRecordOut[], key: string) => {
    const answered = list.filter((r) => r.values[key] === 'SI' || r.values[key] === 'NO')
    return val(answered.filter((r) => r.values[key] === 'SI').length, answered.length)
  }
  const withDelivery = rows.filter((r) => r.values.tipo_parto)
  const apgar = rows.map((r) => numOf(r.values.apgar5)).filter((n): n is number => n !== null)
  const sgb = mothers.filter((x) => x.r.values.sgb_res === 'POSITIVO')
  const rpm = mothers.filter((x) => x.r.values.rpm === 'SI')
  const nursery = births.filter((x) => x.seg === 'nursery').map((x) => x.r)
  const complete = mothers.filter(
    (x) =>
      sectionProgress(fields, x.r.values, 'materno').state === 'completo' &&
      (x.seg === 'aborto' || sectionProgress(fields, x.r.values, 'neonatal').state === 'completo'),
  ).length

  const out: Record<string, IndicatorValue> = {
    cesarea: val(withDelivery.filter(isCesarea).length, withDelivery.length),
    induccion: yes(rows, 'induccion'),
    control_prenatal: yes(mothers.map((x) => x.r), 'control_prenatal'),
    apego: yes(rows, 'apego'),
    lm_1h: yes(rows, 'lm_1h'),
    apgar5_bajo: val(apgar.filter((a) => a < 7).length, apgar.length),
    malformacion: yes(rows, 'malformacion'),
    vhb: yes(rows, 'vhb'),
    bcg: yes(rows, 'bcg'),
    nirsevimab: yes(rows, 'nirsevimab'),
    prof_sgb: val(sgb.filter((x) => x.r.values.prof_sgb === 'COMPLETA').length, sgb.length),
    prof_rpm: val(rpm.filter((x) => x.r.values.profilaxis_rpm === 'COMPLETA').length, rpm.length),
    binomio_completo: val(complete, mothers.length),
  }
  // Los tamizajes de Nursery salen del Libro; los de UPC, de la Pizarra (se suman en computeDashboard).
  if (scope !== 'uci') {
    out.tamiz_metabolico = yes(nursery, 'tsh_pku')
    out.tamiz_auditivo = yes(nursery, 'peat')
    out.tamiz_cardio = yes(nursery, 'ic_cardiologia')
  }
  return out
}

function pizarraIndicators(p: PanelPayload): Record<string, IndicatorValue> {
  const kind = (k: string) => p.screening.byKind.find((x) => x.kind === k)
  const tamiz = (k: string) => {
    const x = kind(k)
    return val(x ? x.done + x.refused : 0, x?.total ?? 0)
  }
  return {
    tamiz_metabolico: tamiz('METABOLICO'),
    tamiz_auditivo: tamiz('PEA'),
    tamiz_cardio: tamiz('CARDIO'),
    reingreso: val(p.readmission.readmitted, p.readmission.n),
    lme_alta: val(p.feeding.exclusive, p.feeding.n),
    foto_mediana: hours(p.bili.medianHours, p.bili.phototherapyN),
    foto_p90: hours(p.bili.p90Hours, p.bili.phototherapyN),
    registro_turno: val(Math.round(((p.timeliness.sameShiftPct ?? 0) * p.timeliness.n) / 100), p.timeliness.n),
    registro_horas: hours(p.timeliness.medianHours, p.timeliness.n),
  }
}

function mergeScreening(a: IndicatorValue | undefined, b: IndicatorValue | undefined): IndicatorValue {
  const num = (a?.num ?? 0) + (b?.num ?? 0)
  const den = (a?.den ?? 0) + (b?.den ?? 0)
  return val(num, den)
}

async function readTargets(): Promise<Targets> {
  const [row] = await db.select().from(appSetting).where(eq(appSetting.key, TARGETS_KEY)).limit(1)
  return parseTargets(row?.value)
}

export async function computeDashboard(scope: DashScope, periodKey: PanelPeriod): Promise<DashboardPayload> {
  const period = resolvePeriod(periodKey)
  const now = Date.now()
  const today = todayYmd()
  const needsPizarra = scope !== 'nursery'
  const range = (from: string, to: string) => [startOfDay(from)!, startOfDay(addDaysYmd(to, 1))!] as const

  const [fields, all, targets, pizCur, pizPrev] = await Promise.all([
    getBookFields(),
    listRecords(await getBookFields()),
    readTargets(),
    needsPizarra ? computePanel(...range(period.from, period.to), 'uci') : Promise.resolve(null),
    needsPizarra ? computePanel(...range(period.prevFrom, period.prevTo), 'uci') : Promise.resolve(null),
  ])

  const dateOf = (r: BookRecordOut) => r.values.fecha || ymdInSantiago(r.createdAt)
  const items: Item[] = all.map((r) => ({ r, seg: segmentOf(r.values, r.episodeId) as BookSegment }))
  const between = (list: Item[], from: string, to: string) =>
    list.filter((x) => {
      const d = dateOf(x.r)
      return d >= from && d <= to
    })
  const scoped = items.filter((x) => inScope(x.seg, scope))
  const birthsOnly = (list: Item[]) => list.filter((x) => x.seg !== 'aborto')

  const build = (from: string, to: string, piz: PanelPayload | null) => {
    const mothers = between(scoped, from, to)
    const base = libroIndicators(fields, scope, birthsOnly(mothers), mothers)
    if (!piz) return base
    const fromPiz = pizarraIndicators(piz)
    for (const id of ['tamiz_metabolico', 'tamiz_auditivo', 'tamiz_cardio']) {
      base[id] = mergeScreening(fromPiz[id], scope === 'todos' ? base[id] : undefined)
      delete fromPiz[id]
    }
    return { ...base, ...fromPiz }
  }
  const current = build(period.from, period.to, pizCur)
  const previous = build(period.prevFrom, period.prevTo, pizPrev)
  const empty: IndicatorValue = { num: null, den: 0, value: null }
  const quality: QualityRow[] = Object.keys(current).map((id) => ({
    id,
    current: current[id] ?? empty,
    previous: previous[id] ?? empty,
  }))

  const periodMothers = between(scoped, period.from, period.to)
  const periodBirths = birthsOnly(periodMothers)

  // Hoy en la unidad
  const cutoff = now - H24
  const recent = scoped.filter((x) => new Date(x.r.createdAt).getTime() >= cutoff)
  const pendingState = (x: Item) => ({
    mat: sectionProgress(fields, x.r.values, 'materno').state !== 'completo',
    neo: x.seg !== 'aborto' && sectionProgress(fields, x.r.values, 'neonatal').state !== 'completo',
  })
  const pend = scoped.map((x) => ({ x, ...pendingState(x) }))
  const isOld = (x: Item) => now - new Date(x.r.createdAt).getTime() > H24
  const nurseryToday = scope === 'uci' ? [] : items.filter((x) => x.seg === 'nursery' && x.r.values.fecha_alta_rn === today)

  let census: DashboardPayload['today']['census'] = null
  let upc24h: DashboardPayload['today']['upc24h'] = null
  if (needsPizarra) {
    const open = await db
      .select({ level: episode.careLevel })
      .from(episode)
      .where(and(eq(episode.unit, 'uci'), isNull(episode.dischargeAt), ne(episode.status, 'cerrado')))
    const byLevel: { label: string; n: number }[] = CARE_LEVEL_OPTIONS.map((o) => ({
      label: o.label,
      n: open.filter((e) => e.level === o.value).length,
    }))
    const known = byLevel.reduce((a, b) => a + b.n, 0)
    if (open.length > known) byLevel.push({ label: 'Sin nivel', n: open.length - known })
    census = { total: open.length, byLevel: byLevel.filter((l) => l.n > 0) }
    const since = new Date(cutoff)
    const [adm, dis] = await Promise.all([
      db.select({ id: episode.id }).from(episode).where(and(eq(episode.unit, 'uci'), gte(episode.createdAt, since))),
      db.select({ id: episode.id }).from(episode).where(and(eq(episode.unit, 'uci'), gte(episode.dischargeAt, since))),
    ])
    upc24h = { admitted: adm.length, discharged: dis.length }
  }

  // Alertas (los casos del período; los incompletos se miran sin período)
  const alerts: DashAlert[] = ALERTS.map((a) => {
    const pool = a.id === 'incompleto-24h' ? pend : periodMothers.map((x) => ({ x, ...pendingState(x) }))
    const n = pool.filter((p) =>
      a.match({
        values: p.x.r.values,
        isAbortion: p.x.seg === 'aborto',
        createdAt: p.x.r.createdAt,
        matDone: !p.mat,
        neoDone: !p.neo,
      }),
    ).length
    return { id: a.id, label: a.label, detail: a.detail, severity: a.severity, n }
  }).filter((a) => a.n > 0)

  // Actividad
  const days = period.days
  const seriesFrom = days >= 7 ? period.from : addDaysYmd(period.to, -6)
  const seriesDays = Math.round((Date.parse(period.to) - Date.parse(seriesFrom)) / 86400000) + 1
  const granularity: 'dia' | 'mes' = seriesDays <= 62 ? 'dia' : 'mes'
  const buckets = new Map<string, { key: string; label: string; nursery: number; uci: number }>()
  if (granularity === 'dia') {
    for (let i = 0; i < seriesDays; i++) {
      const d = addDaysYmd(seriesFrom, i)
      buckets.set(d, { key: d, label: `${d.slice(8, 10)}/${d.slice(5, 7)}`, nursery: 0, uci: 0 })
    }
  }
  for (const x of birthsOnly(between(scoped, seriesFrom, period.to))) {
    const d = dateOf(x.r)
    const key = granularity === 'dia' ? d : d.slice(0, 7)
    let b = buckets.get(key)
    if (!b) {
      b = { key, label: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`, nursery: 0, uci: 0 }
      buckets.set(key, b)
    }
    b[x.seg === 'uci' ? 'uci' : 'nursery']++
  }
  const series = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
  const totalBirths = series.reduce((a, s) => a + s.nursery + s.uci, 0)

  const tipos = new Map<string, number>()
  for (const x of periodMothers) {
    const t = x.r.values.tipo_parto
    if (t) tipos.set(t, (tipos.get(t) ?? 0) + 1)
  }
  const tiposTotal = [...tipos.values()].reduce((a, b) => a + b, 0)
  const deliveryType = [...tipos.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => ({ label, n, pct: pct(n, tiposTotal) ?? 0 }))

  const robsonItems = periodBirths.filter((x) => /^(10|[1-9])$/.test(x.r.values.robson ?? ''))
  const robsonRows: RobsonRow[] = Array.from({ length: 10 }, (_, i) => {
    const g = String(i + 1)
    const mine = robsonItems.filter((x) => x.r.values.robson === g)
    const ces = mine.filter((x) => isCesarea(x.r)).length
    return {
      group: g,
      n: mine.length,
      pctTotal: pct(mine.length, robsonItems.length),
      cesareas: ces,
      cesareaRate: pct(ces, mine.length),
      contribution: pct(ces, robsonItems.length),
    }
  })
  const robsonCes = robsonItems.filter((x) => isCesarea(x.r)).length

  let upcByGa: GaRow[] | null = null
  if (needsPizarra && pizCur) {
    const allBirths = birthsOnly(between(items, period.from, period.to))
    upcByGa = GA_ROWS.map((g, i) => {
      const mine = allBirths.filter((x) => {
        const w = numOf(x.r.values.eg)
        return w !== null && g.test(w)
      })
      const hosp = mine.filter((x) => x.seg === 'uci').length
      const los = pizCur.los.byGa[i]
      return {
        label: g.label,
        born: mine.length,
        hospitalized: hosp,
        hospitalizedPct: pct(hosp, mine.length),
        losN: los?.n ?? 0,
        losMedian: los?.median ?? null,
        losP90: los?.p90 ?? null,
      }
    })
  }

  const crosses = computeBinomio(fields, periodBirths, scope).crosses.filter((c) => CROSS_IDS.has(c.id))

  return {
    scope,
    period,
    generatedAt: new Date().toISOString(),
    today: {
      census,
      births24h: {
        births: recent.filter((x) => x.seg !== 'aborto').length,
        abortions: recent.filter((x) => x.seg === 'aborto').length,
      },
      upc24h,
      pending: {
        maternity: pend.filter((p) => p.mat).length,
        neonatal: pend.filter((p) => p.neo).length,
        maternityOld: pend.filter((p) => p.mat && isOld(p.x)).length,
        neonatalOld: pend.filter((p) => p.neo && isOld(p.x)).length,
      },
      nurseryDischarge:
        scope === 'uci'
          ? null
          : {
              today: nurseryToday.length,
              missingScreening: nurseryToday.filter((x) => !x.r.values.tsh_pku || !x.r.values.peat).length,
            },
    },
    alerts,
    quality,
    targets,
    activity: {
      series,
      granularity,
      average: Math.round((totalBirths / Math.max(1, series.length)) * 10) / 10,
      deliveryType,
      robson: {
        rows: robsonRows,
        classified: robsonItems.length,
        unclassified: periodBirths.length - robsonItems.length,
        cesareaRate: pct(robsonCes, robsonItems.length),
      },
      upcByGa,
    },
    crosses,
  }
}
