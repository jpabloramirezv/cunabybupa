import { and, gte, isNull, lt, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { catalogItem, diagnosis, episode } from '@/lib/db/schema'
import { DELIVERY_OPTIONS, FEEDING_OPTIONS, SCREENING_KINDS, SEX_OPTIONS } from '@/lib/config'
import {
  BASIS_OPTIONS,
  DIMS,
  GA_GROUPS,
  KPI_OPTIONS,
  MAX_RANGE_DAYS,
  SECTIONS,
  WEIGHT_GROUPS,
  defaultConfig,
  emptyFilters,
  type AttentionCase,
  type Bar,
  type Box,
  type ContingencyTable,
  type DataRow,
  type DimKey,
  type Granularity,
  type Heat,
  type Hist,
  type InsightConfig,
  type InsightReport,
  type Kpi,
  type KpiKey,
  type SectionKey,
  type SeriesPoint,
  type StackedBar,
} from '@/lib/insights'
import {
  INGRESO_OPTIONAL,
  INGRESO_REQUIRED,
  STATUS_LABEL,
  missingIngresoRequired,
  type EpisodeStatus,
} from '@/lib/rules'
import {
  boxStats,
  chiSquare,
  fmtNum,
  fmtP,
  fmtPct,
  histogram,
  kruskalWallis,
  niceWidth,
  pct,
  spearman,
  summarize,
  wilson,
} from '@/lib/stats'
import { addDaysYmd, endOfDay, fmtYmd, shiftOf, startOfDay, zonedParts } from '@/lib/time'
import { buildDetails, type EpisodeRow } from '@/lib/server/episodes'
import type { EpisodeDetail } from '@/lib/types'

const H = 3600_000
const D = 86400_000

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const BLOCKS = ['00–03 h', '03–06 h', '06–09 h', '09–12 h', '12–15 h', '15–18 h', '18–21 h', '21–24 h']

const pad = (n: number) => String(n).padStart(2, '0')
const ymdOf = (d: Date) => {
  const p = zonedParts(d)
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`
}
const dowMon0 = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

// --- Validación de la configuración -------------------------------------------

const arr = <T,>(v: unknown, ok: (x: unknown) => x is T): T[] =>
  Array.isArray(v) ? v.filter(ok) : []
const isStr = (x: unknown): x is string => typeof x === 'string'
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isYmd = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)

export function sanitizeConfig(raw: unknown): InsightConfig | null {
  const base = defaultConfig()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const f = (r.filters ?? {}) as Record<string, unknown>
  const sectionKeys = SECTIONS.map((s) => s.key) as string[]
  const kpiKeys = KPI_OPTIONS.map((k) => k.key) as string[]
  const dimKeys = DIMS.map((d) => d.key) as string[]
  const cont = (r.contingency ?? {}) as Record<string, unknown>
  const cfg: InsightConfig = {
    title: (isStr(r.title) ? r.title : base.title).slice(0, 120),
    subtitle: (isStr(r.subtitle) ? r.subtitle : base.subtitle).slice(0, 160),
    notes: (isStr(r.notes) ? r.notes : '').slice(0, 1500),
    from: isYmd(r.from) ? r.from : base.from,
    to: isYmd(r.to) ? r.to : base.to,
    basis: r.basis === 'egresos' || r.basis === 'activos' ? r.basis : 'ingresos',
    granularity: (['dia', 'semana', 'mes'] as string[]).includes(r.granularity as string)
      ? (r.granularity as Granularity)
      : 'auto',
    sections: arr(r.sections, isStr).filter((s): s is SectionKey => sectionKeys.includes(s)),
    kpis: arr(r.kpis, isStr).filter((k): k is KpiKey => kpiKeys.includes(k)),
    contingency: {
      row: dimKeys.includes(cont.row as string) ? (cont.row as DimKey) : base.contingency.row,
      col: dimKeys.includes(cont.col as string) ? (cont.col as DimKey) : base.contingency.col,
    },
    filters: {
      ...emptyFilters(),
      sex: arr(f.sex, isStr),
      delivery: arr(f.delivery, isStr),
      gaGroup: arr(f.gaGroup, isStr),
      weightGroup: arr(f.weightGroup, isStr),
      previsionId: arr(f.previsionId, isNum),
      procedimientoId: arr(f.procedimientoId, isNum),
      destinoId: arr(f.destinoId, isNum),
      status: arr(f.status, isStr),
      hyperbili: f.hyperbili === 'si' || f.hyperbili === 'no' ? f.hyperbili : '',
      readmission: f.readmission === 'si' || f.readmission === 'no' ? f.readmission : '',
      shift: f.shift === 'D' || f.shift === 'N' ? f.shift : '',
    },
  }
  const a = startOfDay(cfg.from)
  const b = endOfDay(cfg.to)
  if (!a || !b || a >= b) return null
  if ((b.getTime() - a.getTime()) / D > MAX_RANGE_DAYS) return null
  return cfg
}

// --- Clasificadores -----------------------------------------------------------

const gaGroupOf = (w: number | null) =>
  w === null ? null : w < 28 ? 'extremo' : w < 32 ? 'muy' : w < 37 ? 'moderado' : 'termino'
const weightGroupOf = (g: number | null) =>
  g === null ? null : g < 1000 ? 'eblw' : g < 1500 ? 'vlbw' : g < 2500 ? 'lbw' : 'nbw'

const gaLabel = (k: string | null) => GA_GROUPS.find((g) => g.value === k)?.label ?? null
const weightLabel = (k: string | null) => WEIGHT_GROUPS.find((g) => g.value === k)?.label ?? null

const stayStart = (r: EpisodeRow) => r.birthAt ?? r.createdAt

type Lookups = {
  item: (id: number | null) => string | null
  dx: (id: number | null) => string | null
}

function dimOf(key: DimKey, r: EpisodeRow, L: Lookups): string | null {
  switch (key) {
    case 'sexo':
      return SEX_OPTIONS.find((o) => o.value === r.sex)?.label ?? null
    case 'parto':
      return DELIVERY_OPTIONS.find((o) => o.value === r.deliveryType)?.label ?? null
    case 'eg':
      return gaLabel(gaGroupOf(r.gaWeeks))
    case 'peso':
      return weightLabel(weightGroupOf(r.birthWeightG))
    case 'apgar5':
      return r.apgar5 === null ? null : r.apgar5 < 4 ? 'Grave (0 a 3)' : r.apgar5 < 7 ? 'Moderado (4 a 6)' : 'Normal (7 a 10)'
    case 'prevision':
      return L.item(r.previsionId)
    case 'procedimiento':
      return L.item(r.procedimientoId)
    case 'destino':
      return L.item(r.destinoId)
    case 'alimentacion':
      return FEEDING_OPTIONS.find((o) => o.value === r.feedingDischarge)?.label ?? null
    case 'hiperbili':
      return r.hyperbili === null ? null : r.hyperbili ? 'Con hiperbilirrubinemia' : 'Sin hiperbilirrubinemia'
    case 'reingreso':
      return r.readmissionOf ? 'Reingreso' : 'Ingreso nuevo'
    case 'turno':
      return shiftOf(r.createdAt).kind === 'D' ? 'Turno de día' : 'Turno de noche'
    case 'estado':
      return STATUS_LABEL[r.status as EpisodeStatus] ?? r.status
  }
}

const FIXED_ORDER: Partial<Record<DimKey, string[]>> = {
  eg: GA_GROUPS.map((g) => g.label),
  peso: WEIGHT_GROUPS.map((g) => g.label),
  apgar5: ['Grave (0 a 3)', 'Moderado (4 a 6)', 'Normal (7 a 10)'],
  turno: ['Turno de día', 'Turno de noche'],
  reingreso: ['Ingreso nuevo', 'Reingreso'],
  hiperbili: ['Sin hiperbilirrubinemia', 'Con hiperbilirrubinemia'],
}

// --- Auxiliares de agregación -------------------------------------------------

function barsFrom(values: (string | null)[], order?: string[], top = 8): Bar[] {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  let entries = [...counts.entries()]
  if (order) {
    entries = order.filter((o) => counts.has(o)).map((o) => [o, counts.get(o)!] as [string, number])
  } else {
    entries.sort((a, b) => b[1] - a[1])
    if (entries.length > top) {
      const rest = entries.slice(top).reduce((a, e) => a + e[1], 0)
      entries = [...entries.slice(0, top), ['Otros', rest]]
    }
  }
  return entries.map(([label, n]) => ({ label, n, pct: pct(n, total) }))
}

function makeHist(title: string, unit: string, values: number[], width?: number): Hist {
  const v = values.filter((x) => Number.isFinite(x))
  return { title, unit, n: v.length, bins: histogram(v, width), summary: summarize(v) }
}

const fmtDays = (d: number | null | undefined) =>
  d === null || d === undefined ? '—' : `${fmtNum(d, d >= 10 ? 0 : 1)} d`
const fmtHours = (h: number | null | undefined) =>
  h === null || h === undefined ? '—' : h >= 48 ? `${fmtNum(h / 24, 1)} d` : `${fmtNum(h, 1)} h`

function buildContingency(
  rowKey: DimKey,
  colKey: DimKey,
  rows: EpisodeRow[],
  L: Lookups,
): ContingencyTable {
  const rowLabel = DIMS.find((d) => d.key === rowKey)!.label
  const colLabel = DIMS.find((d) => d.key === colKey)!.label
  const pairs: [string, string][] = []
  let excluded = 0
  for (const r of rows) {
    const a = dimOf(rowKey, r, L)
    const b = dimOf(colKey, r, L)
    if (a && b) pairs.push([a, b])
    else excluded++
  }
  const categories = (idx: 0 | 1, key: DimKey) => {
    const counts = new Map<string, number>()
    for (const p of pairs) counts.set(p[idx], (counts.get(p[idx]) ?? 0) + 1)
    const fixed = FIXED_ORDER[key]
    if (fixed) return fixed.filter((l) => counts.has(l))
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])
    return sorted.length > 7 ? [...sorted.slice(0, 7), 'Otros'] : sorted
  }
  const rowsCat = categories(0, rowKey)
  const colsCat = categories(1, colKey)
  const idx = (cats: string[], v: string) => (cats.includes(v) ? cats.indexOf(v) : cats.indexOf('Otros'))
  const cells = rowsCat.map(() => colsCat.map(() => 0))
  for (const [a, b] of pairs) {
    const i = idx(rowsCat, a)
    const j = idx(colsCat, b)
    if (i >= 0 && j >= 0) cells[i][j]++
  }
  return {
    title: `${rowLabel} según ${colLabel.toLowerCase()}`,
    rowLabel,
    colLabel,
    rows: rowsCat,
    cols: colsCat,
    cells,
    n: pairs.length,
    excluded,
    test: chiSquare(cells),
  }
}

// --- Serie temporal -----------------------------------------------------------

type Bucket = { key: string; label: string; start: Date; end: Date; from: string }

function buildBuckets(fromYmd: string, toYmd: string, gran: Exclude<Granularity, 'auto'>) {
  const days: string[] = []
  for (let y = fromYmd; y <= toYmd; y = addDaysYmd(y, 1)) days.push(y)
  const keyOf = (y: string) =>
    gran === 'dia' ? y : gran === 'mes' ? y.slice(0, 7) : addDaysYmd(y, -dowMon0(y))
  const groups: string[][] = []
  let lastKey = ''
  for (const y of days) {
    const k = keyOf(y)
    if (k !== lastKey) {
      groups.push([])
      lastKey = k
    }
    groups[groups.length - 1].push(y)
  }
  const dayIndex = new Map<string, number>()
  const buckets: Bucket[] = groups.map((g, i) => {
    for (const y of g) dayIndex.set(y, i)
    const first = g[0]
    const label = gran === 'mes' ? fmtYmd(first).slice(3) : fmtYmd(first).slice(0, 6)
    return {
      key: keyOf(first),
      label: gran === 'semana' ? `Sem. ${label}` : label,
      start: startOfDay(first)!,
      end: endOfDay(g[g.length - 1])!,
      from: first,
    }
  })
  return { buckets, dayIndex }
}

// --- Cálculo principal --------------------------------------------------------

export async function computeInsights(
  cfg: InsightConfig,
  generatedBy: string,
): Promise<{ report: InsightReport; rows: DataRow[] }> {
  const from = startOfDay(cfg.from)!
  const to = endOfDay(cfg.to)!
  const now = new Date()
  const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / D))
  const refEnd = new Date(Math.min(now.getTime(), to.getTime()))

  const [base, items, dxs] = await Promise.all([
    db
      .select()
      .from(episode)
      .where(
        and(
          lt(episode.createdAt, to),
          or(isNull(episode.dischargeAt), gte(episode.dischargeAt, from), gte(episode.createdAt, from)),
        ),
      ),
    db.select().from(catalogItem),
    db.select().from(diagnosis),
  ])
  const L: Lookups = {
    item: (id) => (id === null ? null : (items.find((i) => i.id === id)?.label ?? null)),
    dx: (id) => {
      if (id === null) return null
      const d = dxs.find((x) => x.id === id)
      return d ? `${d.code} · ${d.name}` : null
    },
  }

  // Filtros de atributos (no temporales)
  const F = cfg.filters
  const passes = (r: EpisodeRow) => {
    if (F.sex.length && !F.sex.includes(r.sex ?? '')) return false
    if (F.delivery.length && !F.delivery.includes(r.deliveryType ?? '')) return false
    if (F.gaGroup.length && !F.gaGroup.includes(gaGroupOf(r.gaWeeks) ?? '')) return false
    if (F.weightGroup.length && !F.weightGroup.includes(weightGroupOf(r.birthWeightG) ?? '')) return false
    if (F.previsionId.length && !F.previsionId.includes(r.previsionId ?? -1)) return false
    if (F.procedimientoId.length && !F.procedimientoId.includes(r.procedimientoId ?? -1)) return false
    if (F.destinoId.length && !F.destinoId.includes(r.destinoId ?? -1)) return false
    if (F.status.length && !F.status.includes(r.status)) return false
    if (F.hyperbili === 'si' && r.hyperbili !== true) return false
    if (F.hyperbili === 'no' && r.hyperbili !== false) return false
    if (F.readmission === 'si' && !r.readmissionOf) return false
    if (F.readmission === 'no' && r.readmissionOf) return false
    if (F.shift && shiftOf(r.createdAt).kind !== F.shift) return false
    return true
  }
  const inRange = (d: Date | null) => !!d && d >= from && d < to

  const byBasis = (r: EpisodeRow) =>
    cfg.basis === 'ingresos'
      ? inRange(r.createdAt)
      : cfg.basis === 'egresos'
        ? inRange(r.dischargeAt)
        : r.createdAt < to && (!r.dischargeAt || r.dischargeAt >= from)

  const cohortBefore = base.filter(byBasis)
  const pool = base.filter(passes)
  const cohort = pool.filter(byBasis)
  const n = cohort.length

  // Hospitalizados al cierre (para atención y KPIs)
  const openNow = pool.filter(
    (r) => r.createdAt <= refEnd && (!r.dischargeAt || r.dischargeAt > refEnd) && !r.altaConfirmedAt,
  )
  const detailRows = [...new Map([...cohort, ...openNow].map((r) => [r.id, r])).values()]
  const details = await buildDetails(detailRows)
  const D_BY_ID = new Map<string, EpisodeDetail>(details.map((d) => [d.id, d]))
  const rowOf = new Map(detailRows.map((r) => [r.id, r]))

  // Estadía
  const losOf = (r: EpisodeRow) =>
    r.dischargeAt ? (r.dischargeAt.getTime() - stayStart(r).getTime()) / D : null
  const discharged = cohort.filter((r) => r.dischargeAt)
  const losEntries = discharged
    .map((r) => ({ r, los: losOf(r) }))
    .filter((x): x is { r: EpisodeRow; los: number } => x.los !== null && x.los >= 0)
  const losAll = losEntries.map((x) => x.los)
  const losSummary = summarize(losAll)

  const losBy = (label: string, test: (r: EpisodeRow) => boolean): Box => ({
    label,
    stats: boxStats(losEntries.filter((x) => test(x.r)).map((x) => x.los)),
  })
  const byGa = GA_GROUPS.map((g) => losBy(g.label, (r) => gaGroupOf(r.gaWeeks) === g.value))
  const byWeight = WEIGHT_GROUPS.map((g) => losBy(g.label, (r) => weightGroupOf(r.birthWeightG) === g.value))
  const byDelivery = DELIVERY_OPTIONS.map((o) => losBy(o.label, (r) => r.deliveryType === o.value))
  const groupVals = (test: (r: EpisodeRow) => boolean) => losEntries.filter((x) => test(x.r)).map((x) => x.los)

  const gaPairs = losEntries.filter((x) => x.r.gaWeeks !== null)
  const wPairs = losEntries.filter((x) => x.r.birthWeightG !== null)

  // Series de tiempo
  const spanDays = Math.round((to.getTime() - from.getTime()) / D)
  const gran: Exclude<Granularity, 'auto'> =
    cfg.granularity === 'auto'
      ? spanDays <= 45 ? 'dia' : spanDays <= 200 ? 'semana' : 'mes'
      : cfg.granularity === 'dia' && spanDays > 120
        ? 'semana'
        : cfg.granularity
  const { buckets, dayIndex } = buildBuckets(cfg.from, cfg.to, gran)
  const points: SeriesPoint[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    from: b.from,
    ingresos: 0,
    egresos: 0,
    abiertos: 0,
  }))
  for (const r of pool) {
    if (inRange(r.createdAt)) {
      const i = dayIndex.get(ymdOf(r.createdAt))
      if (i !== undefined) points[i].ingresos++
    }
    if (inRange(r.dischargeAt)) {
      const i = dayIndex.get(ymdOf(r.dischargeAt!))
      if (i !== undefined) points[i].egresos++
    }
    const s = stayStart(r).getTime()
    buckets.forEach((b, i) => {
      const end = Math.min(b.end.getTime(), now.getTime())
      if (s < end && (!r.dischargeAt || r.dischargeAt.getTime() >= end)) points[i].abiertos++
    })
  }

  // Días cama y censo
  const censusEnd = refEnd.getTime()
  const censusDays = Math.max(1, (censusEnd - from.getTime()) / D)
  let bedDays = 0
  for (const r of pool) {
    const a = Math.max(stayStart(r).getTime(), from.getTime())
    const b = Math.min(r.dischargeAt ? r.dischargeAt.getTime() : censusEnd, censusEnd)
    if (b > a) bedDays += (b - a) / D
  }

  // Perfil
  const withGa = cohort.filter((r) => r.gaWeeks !== null)
  const withWeight = cohort.filter((r) => r.birthWeightG !== null)
  const weights = withWeight.map((r) => r.birthWeightG!)
  const weightWidth = weights.length && Math.max(...weights) - Math.min(...weights) > 3500 ? 500 : 250
  const gaCount = (test: (w: number) => boolean) => withGa.filter((r) => test(r.gaWeeks!)).length
  const wtCount = (test: (g: number) => boolean) => withWeight.filter((r) => test(r.birthWeightG!)).length

  // Bilirrubina
  const biliKnown = cohort.filter((r) => r.hyperbili !== null)
  const withBili = biliKnown.filter((r) => r.hyperbili)
  const photoHours = withBili
    .filter((r) => r.phototherapyAt)
    .map((r) => (r.phototherapyAt!.getTime() - stayStart(r).getTime()) / H)
    .filter((h) => h >= 0)
  const photoSummary = summarize(photoHours)

  // Tamizajes
  const screeningDetails = cohort.map((r) => D_BY_ID.get(r.id)!).filter(Boolean)
  const byKind: StackedBar[] = SCREENING_KINDS.map((k) => {
    const st = screeningDetails.map((d) => d.screenings.find((s) => s.kind === k.key)?.status ?? 'pendiente')
    const c = (s: string) => st.filter((x) => x === s).length
    return {
      label: k.label,
      total: st.length,
      parts: [
        { key: 'realizado', label: 'Realizado', n: c('realizado') },
        { key: 'rechazado', label: 'Rechazado', n: c('rechazado') },
        { key: 'pendiente', label: 'Pendiente', n: c('pendiente') },
        { key: 'no_aplica', label: 'No aplica', n: c('no_aplica') },
      ],
    }
  })
  const scrApplicable = byKind.reduce((a, k) => a + k.total - k.parts[3].n, 0)
  const scrResolved = byKind.reduce((a, k) => a + k.parts[0].n + k.parts[1].n, 0)
  const scrPct = pct(scrResolved, scrApplicable)

  // Alta
  const fed = discharged.filter((r) => r.feedingDischarge)
  const exclusive = fed.filter((r) => r.feedingDischarge === 'exclusiva').length
  const weightChange = discharged
    .filter((r) => r.dischargeWeightG && r.birthWeightG)
    .map((r) => ((r.dischargeWeightG! - r.birthWeightG!) / r.birthWeightG!) * 100)

  // Calidad
  const lagEntries = cohort
    .filter((r) => r.completedAt)
    .map((r) => ({ r, h: (r.completedAt!.getTime() - r.createdAt.getTime()) / H }))
    .filter((x) => x.h >= 0)
  const lagSummary = summarize(lagEntries.map((x) => x.h))
  const sameShift = lagEntries.filter((x) => x.r.createdShift && x.r.createdShift === x.r.completedShift).length
  const sameShiftPct = pct(sameShift, lagEntries.length)
  const detailsCohort = cohort.map((r) => D_BY_ID.get(r.id)!).filter(Boolean)
  const completeness: Bar[] = [
    ...[...INGRESO_REQUIRED, ...INGRESO_OPTIONAL].map(([, label]) => {
      const ok = detailsCohort.filter((d) => !d.missing.includes(label)).length
      return { label, n: ok, pct: pct(ok, detailsCohort.length) }
    }),
    ...(() => {
      const alta = discharged.map((r) => D_BY_ID.get(r.id)!).filter(Boolean)
      const labels = [...new Set(alta.flatMap((d) => d.altaMissing))]
      const all = ['Fecha del alta', 'Peso al alta', 'Diagnóstico de egreso', 'Destino', 'Alimentación al alta']
      return all.concat(labels.filter((l) => !all.includes(l))).map((label) => {
        const ok = alta.filter((d) => !d.altaMissing.includes(label)).length
        return { label: `Alta: ${label}`, n: ok, pct: pct(ok, alta.length) }
      })
    })(),
  ]

  // Atención
  const refTime = refEnd.getTime()
  const openInfo = openNow.map((r) => {
    const d = D_BY_ID.get(r.id)!
    const days = (refTime - stayStart(r).getTime()) / D
    const reasons: string[] = []
    if (missingIngresoRequired(d).length) reasons.push('Faltan datos obligatorios del ingreso')
    else if (d.missing.length) reasons.push('Faltan datos complementarios de la ficha')
    if (d.altaStarted && !d.altaConfirmedAt) reasons.push('Alta iniciada sin confirmar')
    if (d.pendingKinds.length) reasons.push('Tamizajes o vacunas pendientes')
    if (d.warnings.length) reasons.push('Datos con avisos por revisar')
    if (days > 30) reasons.push('Hospitalización prolongada (más de 30 días)')
    if (d.readmissionOf) reasons.push('Reingreso')
    return { r, d, days, reasons }
  })
  const attentionCases = openInfo.filter((x) => x.reasons.length > 0)
  const reasonCounts = new Map<string, number>()
  for (const x of attentionCases) for (const re of x.reasons) reasonCounts.set(re, (reasonCounts.get(re) ?? 0) + 1)
  const bands: [string, (d: number) => boolean][] = [
    ['0 a 3 días', (d) => d <= 3],
    ['4 a 7 días', (d) => d > 3 && d <= 7],
    ['8 a 14 días', (d) => d > 7 && d <= 14],
    ['15 a 30 días', (d) => d > 14 && d <= 30],
    ['31 a 60 días', (d) => d > 30 && d <= 60],
    ['Más de 60 días', (d) => d > 60],
  ]
  const prolonged = openInfo.filter((x) => x.days > 30).length

  // Turnos
  const heat = (title: string, dates: Date[]): Heat => {
    const cells = WEEKDAYS.map(() => BLOCKS.map(() => 0))
    for (const dt of dates) {
      const p = zonedParts(dt)
      cells[dowMon0(`${p.y}-${pad(p.mo)}-${pad(p.d)}`)][Math.floor(p.h / 3)]++
    }
    return { title, rows: WEEKDAYS, cols: BLOCKS, cells, max: Math.max(0, ...cells.flat()) }
  }
  const ingDates = pool.filter((r) => inRange(r.createdAt)).map((r) => r.createdAt)
  const egrDates = pool.filter((r) => inRange(r.dischargeAt)).map((r) => r.dischargeAt!)
  const shiftBars = (dates: Date[]): Bar[] =>
    barsFrom(dates.map((d) => (shiftOf(d).kind === 'D' ? 'Turno de día (08:00–20:00)' : 'Turno de noche (20:00–08:00)')), [
      'Turno de día (08:00–20:00)',
      'Turno de noche (20:00–08:00)',
    ])

  // KPIs
  const prem = pct(gaCount((w) => w < 37), withGa.length)
  const vprem = pct(gaCount((w) => w < 32), withGa.length)
  const lbw = pct(wtCount((g) => g < 2500), withWeight.length)
  const vlbw = pct(wtCount((g) => g < 1500), withWeight.length)
  const apgarKnown = cohort.filter((r) => r.apgar5 !== null)
  const apgarLow = pct(apgarKnown.filter((r) => r.apgar5! < 7).length, apgarKnown.length)
  const delKnown = cohort.filter((r) => r.deliveryType)
  const cesarea = pct(delKnown.filter((r) => r.deliveryType === 'cesarea').length, delKnown.length)
  const biliPct = pct(withBili.length, biliKnown.length)
  const readm = pct(cohort.filter((r) => r.readmissionOf).length, n)
  const nonEmpty = (v: number | null) => v !== null

  const kpiAll: Record<KpiKey, Omit<Kpi, 'key' | 'label'>> = {
    cohorte: { value: fmtNum(n, 0), sub: BASIS_OPTIONS.find((b) => b.value === cfg.basis)!.label },
    ingresos: { value: fmtNum(pool.filter((r) => inRange(r.createdAt)).length, 0), sub: 'en el período' },
    egresos: { value: fmtNum(pool.filter((r) => inRange(r.dischargeAt)).length, 0), sub: 'en el período' },
    abiertos: { value: fmtNum(openNow.length, 0), sub: `al ${fmtYmd(ymdOf(new Date(refEnd.getTime() - 1)))}` },
    censo: { value: fmtNum(bedDays / censusDays, 1), sub: 'RN por día en promedio' },
    diasCama: { value: fmtNum(bedDays, 0), sub: 'días de hospitalización' },
    estadiaMediana: { value: fmtDays(losSummary?.median), sub: `RIC ${fmtDays(losSummary?.q1)} a ${fmtDays(losSummary?.q3)}` },
    estadiaP90: { value: fmtDays(losSummary?.p90), sub: '90 % se va antes de este tiempo' },
    estadiaMax: { value: fmtDays(losSummary?.max), sub: `${losSummary?.n ?? 0} egresos` },
    prematuros: { value: fmtPct(prem), sub: `${gaCount((w) => w < 37)} de ${withGa.length} con EG` },
    muyPrematuros: { value: fmtPct(vprem), sub: `${gaCount((w) => w < 32)} de ${withGa.length}` },
    bajoPeso: { value: fmtPct(lbw), sub: `${wtCount((g) => g < 2500)} de ${withWeight.length} con peso` },
    muyBajoPeso: { value: fmtPct(vlbw), sub: `${wtCount((g) => g < 1500)} de ${withWeight.length}` },
    apgarBajo: { value: fmtPct(apgarLow), sub: `${apgarKnown.filter((r) => r.apgar5! < 7).length} de ${apgarKnown.length}` },
    cesarea: { value: fmtPct(cesarea), sub: `${delKnown.filter((r) => r.deliveryType === 'cesarea').length} de ${delKnown.length}` },
    hiperbili: { value: fmtPct(biliPct), sub: `${withBili.length} de ${biliKnown.length} RN` },
    fototerapia: { value: fmtHours(photoSummary?.median), sub: `${photoHours.length} con fototerapia` },
    lactancia: { value: fmtPct(pct(exclusive, fed.length)), sub: `${exclusive} de ${fed.length} altas` },
    reingreso: { value: fmtPct(readm), sub: `${cohort.filter((r) => r.readmissionOf).length} de ${n}` },
    tamizajes: { value: fmtPct(scrPct), sub: `${scrResolved} de ${scrApplicable} aplicables` },
    oportunidad: { value: fmtHours(lagSummary?.median), sub: `${lagEntries.length} fichas completas` },
    mismoTurno: { value: fmtPct(sameShiftPct), sub: `${sameShift} de ${lagEntries.length}` },
    atencion: { value: fmtNum(attentionCases.length, 0), sub: `de ${openNow.length} hospitalizados` },
    prolongadas: { value: fmtNum(prolonged, 0), sub: 'aún hospitalizados' },
  }
  const kpis: Kpi[] = KPI_OPTIONS.filter((k) => cfg.kpis.includes(k.key)).map((k) => ({
    key: k.key,
    label: k.label,
    ...kpiAll[k.key],
  }))

  // Contingencia
  const contTables: ContingencyTable[] = []
  const customKey = `${cfg.contingency.row}|${cfg.contingency.col}`
  contTables.push(buildContingency(cfg.contingency.row, cfg.contingency.col, cohort, L))
  const defaults: [DimKey, DimKey][] = [
    ['sexo', 'parto'],
    ['eg', 'hiperbili'],
    ['eg', 'destino'],
    ['turno', 'estado'],
  ]
  for (const [a, b] of defaults) {
    if (`${a}|${b}` === customKey || a === b) continue
    contTables.push(buildContingency(a, b, cohort, L))
  }
  if (cfg.contingency.row === cfg.contingency.col) contTables.shift()

  // Hallazgos automáticos
  const kwGa = kruskalWallis(GA_GROUPS.map((g) => groupVals((r) => gaGroupOf(r.gaWeeks) === g.value)))
  const kwWt = kruskalWallis(WEIGHT_GROUPS.map((g) => groupVals((r) => weightGroupOf(r.birthWeightG) === g.value)))
  const spGa = spearman(
    gaPairs.map((x) => x.r.gaWeeks! + (x.r.gaDays ?? 0) / 7),
    gaPairs.map((x) => x.los),
  )
  const spWt = spearman(
    wPairs.map((x) => x.r.birthWeightG!),
    wPairs.map((x) => x.los),
  )
  const headline: string[] = []
  const basisText = BASIS_OPTIONS.find((b) => b.value === cfg.basis)!.label.toLowerCase()
  headline.push(
    `Entre el ${fmtYmd(cfg.from)} y el ${fmtYmd(cfg.to)} se analizaron ${n} RN (${basisText})${
      cohortBefore.length !== n ? `, de ${cohortBefore.length} antes de aplicar los filtros` : ''
    }.`,
  )
  if (n === 0) {
    headline.push('No hay registros con estas condiciones. Amplía el período o quita filtros.')
  } else {
    const peak = [...points].sort((a, b) => b.ingresos - a.ingresos)[0]
    if (peak && peak.ingresos > 0) headline.push(`El mayor número de ingresos fue en ${peak.label.toLowerCase()} (${peak.ingresos}).`)
    if (nonEmpty(prem)) {
      const ci = wilson(gaCount((w) => w < 37), withGa.length)
      headline.push(`${fmtPct(prem)} de los RN fueron prematuros${ci ? ` (IC 95 %: ${fmtNum(ci[0])} a ${fmtNum(ci[1])} %)` : ''} y ${fmtPct(lbw)} tuvo bajo peso al nacer.`)
    }
    if (losSummary) {
      headline.push(
        `La estadía mediana fue ${fmtDays(losSummary.median)} (RIC ${fmtDays(losSummary.q1)} a ${fmtDays(losSummary.q3)}), con un máximo de ${fmtDays(losSummary.max)}.`,
      )
      if (kwGa && kwGa.p !== null && kwGa.p < 0.05)
        headline.push(`La estadía difiere significativamente según edad gestacional (Kruskal-Wallis, ${fmtP(kwGa.p)}).`)
      if (spGa && spGa.p !== null && spGa.p < 0.05)
        headline.push(
          `A menor edad gestacional, ${spGa.rho < 0 ? 'mayor' : 'menor'} estadía (Spearman rho = ${fmtNum(spGa.rho, 2)}, ${fmtP(spGa.p)}).`,
        )
    }
    if (nonEmpty(biliPct)) headline.push(`${fmtPct(biliPct)} presentó hiperbilirrubinemia${photoSummary ? `; la fototerapia comenzó a una mediana de ${fmtHours(photoSummary.median)}` : ''}.`)
    if (fed.length) headline.push(`${fmtPct(pct(exclusive, fed.length))} de las altas fue con lactancia exclusiva.`)
    if (nonEmpty(scrPct)) {
      const worst = [...byKind].filter((k) => k.total - k.parts[3].n > 0).sort(
        (a, b) =>
          (a.parts[0].n + a.parts[1].n) / (a.total - a.parts[3].n) -
          (b.parts[0].n + b.parts[1].n) / (b.total - b.parts[3].n),
      )[0]
      headline.push(`${fmtPct(scrPct)} de los tamizajes y vacunas aplicables están resueltos${worst ? `; el más rezagado es ${worst.label}` : ''}.`)
    }
    const custom = contTables[0]
    if (custom?.test?.p !== null && custom?.test && custom.test.p! < 0.05)
      headline.push(
        `Hay asociación entre ${custom.rowLabel.toLowerCase()} y ${custom.colLabel.toLowerCase()} (chi-cuadrado, ${fmtP(custom.test.p)}; V de Cramér ${fmtNum(custom.test.cramersV, 2)}).`,
      )
  }
  if (openNow.length) {
    headline.push(
      `${attentionCases.length} de ${openNow.length} RN hospitalizados siguen abiertos con algo por resolver${prolonged ? `, y ${prolonged} llevan más de 30 días` : ''}.`,
    )
  }

  const filterNotes: string[] = []
  const names = (ids: number[]) => ids.map((i) => L.item(i) ?? `#${i}`).join(', ')
  if (F.sex.length) filterNotes.push(`Sexo: ${F.sex.map((s) => SEX_OPTIONS.find((o) => o.value === s)?.label ?? s).join(', ')}`)
  if (F.delivery.length) filterNotes.push(`Parto: ${F.delivery.map((s) => DELIVERY_OPTIONS.find((o) => o.value === s)?.label ?? s).join(', ')}`)
  if (F.gaGroup.length) filterNotes.push(`Edad gestacional: ${F.gaGroup.map((g) => gaLabel(g) ?? g).join(', ')}`)
  if (F.weightGroup.length) filterNotes.push(`Peso: ${F.weightGroup.map((g) => weightLabel(g) ?? g).join(', ')}`)
  if (F.previsionId.length) filterNotes.push(`Previsión: ${names(F.previsionId)}`)
  if (F.procedimientoId.length) filterNotes.push(`Procedimiento: ${names(F.procedimientoId)}`)
  if (F.destinoId.length) filterNotes.push(`Destino: ${names(F.destinoId)}`)
  if (F.status.length) filterNotes.push(`Estado: ${F.status.map((s) => STATUS_LABEL[s as EpisodeStatus] ?? s).join(', ')}`)
  if (F.hyperbili) filterNotes.push(`Hiperbilirrubinemia: ${F.hyperbili === 'si' ? 'con' : 'sin'}`)
  if (F.readmission) filterNotes.push(`Reingreso: ${F.readmission === 'si' ? 'solo reingresos' : 'solo ingresos nuevos'}`)
  if (F.shift) filterNotes.push(`Turno de ingreso: ${F.shift === 'D' ? 'día' : 'noche'}`)

  const has = (k: SectionKey) => cfg.sections.includes(k)

  const report: InsightReport = {
    generatedAt: now.toISOString(),
    generatedBy,
    config: cfg,
    period: { from: from.toISOString(), to: to.toISOString(), days: periodDays },
    basisLabel: BASIS_OPTIONS.find((b) => b.value === cfg.basis)!.label,
    cohort: { n, beforeFilters: cohortBefore.length },
    filterNotes,
    headline,
    kpis,
  }

  if (has('flujo')) report.flow = { granularity: gran, points }

  if (has('estadia'))
    report.los = {
      summary: losSummary,
      openCount: cohort.filter((r) => !r.dischargeAt).length,
      hist: makeHist('Distribución de la estadía', 'días', losAll),
      byGa,
      byWeight,
      byDelivery,
      groupTable: [
        { label: 'Todos los egresos', summary: losSummary },
        ...GA_GROUPS.map((g) => ({ label: g.label, summary: summarize(groupVals((r) => gaGroupOf(r.gaWeeks) === g.value)) })),
        ...WEIGHT_GROUPS.map((g) => ({ label: g.label, summary: summarize(groupVals((r) => weightGroupOf(r.birthWeightG) === g.value)) })),
      ],
      kruskalGa: kwGa,
      kruskalWeight: kwWt,
      spearmanGa: spGa,
      spearmanWeight: spWt,
    }

  if (has('perfil'))
    report.profile = {
      gaHist: makeHist('Edad gestacional', 'semanas', withGa.map((r) => r.gaWeeks!), 1),
      weightHist: makeHist('Peso al nacer', 'g', weights, weightWidth),
      apgar5: barsFrom(cohort.map((r) => (r.apgar5 === null ? null : String(r.apgar5))), Array.from({ length: 11 }, (_, i) => String(i))),
      sex: barsFrom(cohort.map((r) => dimOf('sexo', r, L))),
      delivery: barsFrom(cohort.map((r) => dimOf('parto', r, L))),
      gaGroups: barsFrom(cohort.map((r) => dimOf('eg', r, L)), FIXED_ORDER.eg),
      weightGroups: barsFrom(cohort.map((r) => dimOf('peso', r, L)), FIXED_ORDER.peso),
      prevision: barsFrom(cohort.map((r) => dimOf('prevision', r, L))),
      procedimiento: barsFrom(cohort.map((r) => dimOf('procedimiento', r, L))),
      dxIngreso: barsFrom(
        cohort.flatMap((r) =>
          (r.dxIngresoIds?.length ? r.dxIngresoIds : [r.dxIngresoId]).map((x) => L.dx(x)),
        ),
      ),
    }

  if (has('contingencia')) report.contingency = contTables

  if (has('tamizajes')) report.screening = { overallPct: scrPct, byKind }

  if (has('bilirrubina'))
    report.bili = {
      known: biliKnown.length,
      withBili: withBili.length,
      pct: biliPct,
      ci: wilson(withBili.length, biliKnown.length),
      phototherapyN: photoHours.length,
      hist: makeHist('Horas desde el nacimiento hasta la fototerapia', 'horas', photoHours),
      byGa: GA_GROUPS.map((g) => {
        const grp = biliKnown.filter((r) => gaGroupOf(r.gaWeeks) === g.value)
        const w = grp.filter((r) => r.hyperbili).length
        return { label: `${g.label} (n = ${grp.length})`, n: w, pct: pct(w, grp.length) }
      }).filter((b) => b.pct !== null),
    }

  if (has('alta'))
    report.discharge = {
      n: discharged.length,
      destino: barsFrom(discharged.map((r) => dimOf('destino', r, L))),
      feeding: barsFrom(discharged.map((r) => dimOf('alimentacion', r, L))),
      dxEgreso: barsFrom(
        discharged.flatMap((r) =>
          (r.dxEgresoIds?.length ? r.dxEgresoIds : [r.dxEgresoId]).map((x) => L.dx(x)),
        ),
      ),
      weightChange: makeHist('Variación de peso entre nacimiento y alta', '%', weightChange),
    }

  if (has('turnos'))
    report.shifts = {
      ingresosByShift: shiftBars(ingDates),
      egresosByShift: shiftBars(egrDates),
      heatIngresos: heat('Ingresos por día y bloque horario', ingDates),
      heatEgresos: heat('Egresos por día y bloque horario', egrDates),
    }

  if (has('atencion'))
    report.attention = {
      open: openNow.length,
      reasons: [...reasonCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, c]) => ({ label, n: c, pct: pct(c, openNow.length) })),
      stayBands: bands.map(([label, test]) => {
        const c = openInfo.filter((x) => test(x.days)).length
        return { label, n: c, pct: pct(c, openInfo.length) }
      }),
      longest: [...openInfo]
        .sort((a, b) => b.days - a.days)
        .slice(0, 10)
        .map(
          (x): AttentionCase => ({
            id: x.r.id,
            code: x.d.code,
            days: Math.round(x.days * 10) / 10,
            gaWeeks: x.r.gaWeeks,
            weightG: x.r.birthWeightG,
            reasons: x.reasons,
          }),
        ),
    }

  if (has('calidad'))
    report.quality = {
      completeness,
      lagHist: makeHist('Horas hasta completar la ficha', 'horas', lagEntries.map((x) => x.h)),
      lagByShift: (['D', 'N'] as const).map((k) => ({
        label: k === 'D' ? 'Ingreso en turno de día' : 'Ingreso en turno de noche',
        stats: boxStats(lagEntries.filter((x) => shiftOf(x.r.createdAt).kind === k).map((x) => x.h)),
      })),
      sameShiftPct,
    }

  // Datos anonimizados para la hoja de cálculo
  const rows: DataRow[] = cohort.map((r) => {
    const d = D_BY_ID.get(r.id)
    const los = losOf(r)
    const row: DataRow = {
      Código: d?.code ?? r.id,
      Estado: STATUS_LABEL[r.status as EpisodeStatus] ?? r.status,
      Ingreso: r.createdAt.toISOString(),
      'Turno de ingreso': shiftOf(r.createdAt).kind === 'D' ? 'Día' : 'Noche',
      Nacimiento: r.birthAt?.toISOString() ?? null,
      'EG (semanas)': r.gaWeeks,
      'EG (días)': r.gaDays,
      'Grupo EG': gaLabel(gaGroupOf(r.gaWeeks)),
      'Peso al nacer (g)': r.birthWeightG,
      'Grupo de peso': weightLabel(weightGroupOf(r.birthWeightG)),
      'APGAR 1': r.apgar1,
      'APGAR 5': r.apgar5,
      Sexo: dimOf('sexo', r, L),
      Parto: dimOf('parto', r, L),
      Previsión: L.item(r.previsionId),
      Procedimiento: L.item(r.procedimientoId),
      'Dx ingreso':
        (r.dxIngresoIds?.length ? r.dxIngresoIds : [r.dxIngresoId])
          .map((x) => L.dx(x))
          .filter(Boolean)
          .join(' | ') || null,
      Hiperbilirrubinemia: r.hyperbili === null ? null : r.hyperbili ? 'Sí' : 'No',
      Fototerapia: r.phototherapyAt?.toISOString() ?? null,
      Egreso: r.dischargeAt?.toISOString() ?? null,
      'Estadía (días)': los !== null && los >= 0 ? Math.round(los * 100) / 100 : null,
      'Peso al alta (g)': r.dischargeWeightG,
      'Dx egreso':
        (r.dxEgresoIds?.length ? r.dxEgresoIds : [r.dxEgresoId])
          .map((x) => L.dx(x))
          .filter(Boolean)
          .join(' | ') || null,
      Destino: L.item(r.destinoId),
      'Alimentación al alta': dimOf('alimentacion', r, L),
      Reingreso: r.readmissionOf ? 'Sí' : 'No',
    }
    for (const k of SCREENING_KINDS)
      row[`Tamizaje ${k.label}`] = d?.screenings.find((s) => s.kind === k.key)?.status ?? null
    return row
  })
  void rowOf

  return { report, rows }
}
