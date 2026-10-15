import { getBookFields, type BookFieldRow } from '@/lib/server/book'
import { listRecords } from '@/lib/server/book-records'
import { isFieldVisible, segmentOf, type BookSegment } from '@/lib/book-flow'
import { addDaysYmd, fmtYmd, ymdInSantiago } from '@/lib/time'
import { kindOf, makeCat, type ColumnKind } from '@/lib/server/book-report'
import {
  AGE_ORDER,
  BMI_ORDER,
  GA_ORDER,
  WEIGHT_ORDER,
  ageBin,
  bmiBin,
  gaBin,
  numOf,
  weightBin,
} from '@/lib/server/book-stats'
import { boxStats, chiSquare, fmtNum, fmtPct, histogram, kruskalWallis, pct, summarize, wilson, type KruskalResult } from '@/lib/stats'
import type { Bar, Box, ContingencyTable, Heat, Hist } from '@/lib/insights'
import {
  DEFAULT_LIBRO_KPIS,
  DEFAULT_LIBRO_SECTIONS,
  LIBRO_BASIS,
  LIBRO_GRANULARITY,
  LIBRO_KPIS,
  LIBRO_SCOPES,
  LIBRO_SECTIONS,
  type LibroColumnBlock,
  type LibroConfig,
  type LibroKpi,
  type LibroKpiKey,
  type LibroRate,
  type LibroReport,
  type LibroSectionKey,
} from '@/lib/book-insights'

type Rec = Awaited<ReturnType<typeof listRecords>>[number]
type Item = { r: Rec; seg: BookSegment; date: string; event: string }
type Acc = { label: string; of: (x: Item) => string; order: string[] }

const YMD = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 1830
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const BANDS = ['00 a 05 h', '06 a 11 h', '12 a 17 h', '18 a 23 h']
const APGAR_BANDS = ['0 a 3', '4 a 6', '7 a 10']
const RANGE: Record<string, [number, number]> = {
  edad: [10, 60],
  imc: [10, 70],
  eg: [20, 45],
  peso: [200, 7000],
  peso_alta: [200, 9000],
  apgar1: [0, 10],
  apgar5: [0, 10],
}

const round1 = (n: number) => Math.round(n * 10) / 10
const dateMs = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
const daysBetween = (a: string, b: string) => Math.round((dateMs(b) - dateMs(a)) / 86_400_000)
const weekdayIdx = (ymd: string) => (new Date(dateMs(ymd)).getUTCDay() + 6) % 7
const mondayOf = (ymd: string) => addDaysYmd(ymd, -weekdayIdx(ymd))

const cleanText = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Valida la configuración recibida del navegador; devuelve null si el período no es usable. */
export function sanitizeLibroConfig(raw: unknown): LibroConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const from = typeof o.from === 'string' && YMD.test(o.from) ? o.from : ''
  const to = typeof o.to === 'string' && YMD.test(o.to) ? o.to : ''
  if (!from || !to || from > to || daysBetween(from, to) + 1 > MAX_DAYS) return null

  const scope = LIBRO_SCOPES.find((s) => s.value === o.scope)?.value ?? 'todos'
  const basis = LIBRO_BASIS.find((s) => s.value === o.basis)?.value ?? 'registro'
  const granularity = LIBRO_GRANULARITY.find((s) => s.value === o.granularity)?.value ?? 'auto'

  const kpiKeys = new Set(LIBRO_KPIS.map((k) => k.key))
  const kpis = Array.isArray(o.kpis)
    ? ([...new Set(o.kpis)].filter((k): k is LibroKpiKey => typeof k === 'string' && kpiKeys.has(k as LibroKpiKey)) as LibroKpiKey[])
    : DEFAULT_LIBRO_KPIS
  const sectionKeys = new Set(LIBRO_SECTIONS.map((s) => s.key))
  const sections = Array.isArray(o.sections)
    ? ([...new Set(o.sections)].filter((s): s is LibroSectionKey => typeof s === 'string' && sectionKeys.has(s as LibroSectionKey)) as LibroSectionKey[])
    : DEFAULT_LIBRO_SECTIONS

  const filters = Array.isArray(o.filters)
    ? o.filters
        .slice(0, 6)
        .map((f) => {
          const fo = f as Record<string, unknown>
          const key = cleanText(fo?.key, 60)
          const values = Array.isArray(fo?.values) ? fo.values.slice(0, 30).map((v) => cleanText(v, 80)).filter(Boolean) : []
          return { key, values }
        })
        .filter((f) => f.key && f.values.length > 0)
    : []

  const columns = Array.isArray(o.columns) ? [...new Set(o.columns.map((c) => cleanText(c, 60)).filter(Boolean))].slice(0, 12) : []
  const co = o.cross as Record<string, unknown> | null | undefined
  const cross = co && cleanText(co.row, 60) && cleanText(co.col, 60) ? { row: cleanText(co.row, 60), col: cleanText(co.col, 60) } : null

  return {
    title: cleanText(o.title, 120) || 'Informe estadístico del Libro de Partos',
    subtitle: cleanText(o.subtitle, 160),
    notes: typeof o.notes === 'string' ? o.notes.trim().slice(0, 1200) : '',
    from,
    to,
    scope,
    basis,
    granularity,
    kpis,
    sections,
    filters,
    columns,
    by: cleanText(o.by, 60),
    cross,
  }
}

function bars(vals: string[], order?: string[], limit = 12): Bar[] {
  const counts = new Map<string, number>()
  let total = 0
  for (const v of vals) {
    if (!v) continue
    counts.set(v, (counts.get(v) ?? 0) + 1)
    total++
  }
  if (!total) return []
  const byCount = (a: string, b: string) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
  const keys = order
    ? [...order.filter((k) => counts.has(k)), ...[...counts.keys()].filter((k) => !order.includes(k)).sort(byCount)]
    : [...counts.keys()].sort(byCount)
  let out = keys.map((label) => ({ label, n: counts.get(label) ?? 0 }))
  if (out.length > limit) {
    const rest = out.slice(limit - 1).reduce((a, b) => a + b.n, 0)
    out = [...out.slice(0, limit - 1), { label: 'Otros', n: rest }]
  }
  return out.map((o) => ({ ...o, pct: round1((o.n / total) * 100) }))
}

function hist(title: string, unit: string, values: number[], width?: number): Hist {
  return { title, unit, n: values.length, bins: histogram(values, width), summary: summarize(values) }
}

function makeRate(label: string, pool: Item[], pred: (x: Item) => boolean | null, note?: string): LibroRate {
  let n = 0
  let total = 0
  for (const x of pool) {
    const p = pred(x)
    if (p === null) continue
    total++
    if (p) n++
  }
  return { label, n, total, pct: pct(n, total), ci: wilson(n, total), note }
}

function groupRate(pool: Item[], groupOf: (x: Item) => string, pred: (x: Item) => boolean | null, order?: string[], limit = 6): Bar[] {
  const g = new Map<string, { n: number; h: number }>()
  for (const x of pool) {
    const k = groupOf(x)
    const p = pred(x)
    if (!k || p === null) continue
    const e = g.get(k) ?? { n: 0, h: 0 }
    e.n++
    if (p) e.h++
    g.set(k, e)
  }
  const keys = order ? order.filter((k) => g.has(k)) : [...g.keys()].sort((a, b) => (g.get(b)?.n ?? 0) - (g.get(a)?.n ?? 0)).slice(0, limit)
  return keys.map((k) => ({ label: k, n: g.get(k)!.n, pct: round1((g.get(k)!.h / g.get(k)!.n) * 100) }))
}

/** Cohorte base del período, alcance y criterio de fecha; las columnas de filtro se aplican después. */
async function loadCohort(cfg: Pick<LibroConfig, 'from' | 'to' | 'scope' | 'basis'>) {
  const fields = (await getBookFields()).filter((f) => f.active !== false)
  const all = await listRecords(fields)
  const items: Item[] = []
  for (const r of all) {
    const seg = segmentOf(r.values, r.episodeId)
    const date = r.values.fecha || ymdInSantiago(r.createdAt)
    const event = cfg.basis === 'alta' ? (r.values.fecha_alta_rn ?? '') : date
    if (cfg.basis === 'alta' && seg === 'aborto') continue
    if (!YMD.test(event) || event < cfg.from || event > cfg.to) continue
    if (cfg.scope === 'nacimientos' ? seg === 'aborto' : cfg.scope !== 'todos' && seg !== cfg.scope) continue
    items.push({ r, seg, date, event })
  }
  const eligible = fields
    .map((f) => ({ f, kind: kindOf(f) }))
    .filter((x): x is { f: BookFieldRow; kind: ColumnKind } => x.kind !== null)
  return { fields, items, byKey: new Map(eligible.map((x) => [x.f.key, x])), eligible }
}

const val = (x: Item, k: string) => (x.r.values[k] ?? '').trim()
const up = (x: Item, k: string) => val(x, k).toUpperCase()
const yes = (x: Item, k: string): boolean | null => {
  const v = up(x, k)
  return v === 'SI' ? true : v === 'NO' ? false : null
}
const num = (x: Item, k: string): number | null => {
  const n = numOf(val(x, k))
  if (n === null) return null
  const r = RANGE[k]
  return r && (n < r[0] || n > r[1]) ? null : n
}
const nums = (pool: Item[], k: string) => pool.map((x) => num(x, k)).filter((n): n is number => n !== null)
const isCes = (x: Item) => up(x, 'tipo_parto').startsWith('CES')
const tipoKnown = (x: Item) => up(x, 'tipo_parto') !== '' && up(x, 'tipo_parto') !== 'ABORTO'
const segLabel = (s: BookSegment) => (s === 'uci' ? 'UCI Neonatal' : s === 'nursery' ? 'Nursery' : 'Aborto')

export async function libroFacet(cfg: Pick<LibroConfig, 'from' | 'to' | 'scope' | 'basis'>, key: string) {
  const { items, byKey } = await loadCohort(cfg)
  const def = byKey.get(key)
  if (!def) return null
  const cat = makeCat(def.f, def.kind, items.map((x) => val(x, key)).filter(Boolean), 12)
  const counts = new Map<string, number>()
  for (const x of items) {
    const v = val(x, key)
    const c = v ? cat.of(v) : ''
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return {
    key,
    label: def.f.label,
    values: cat.order.filter((c) => counts.has(c)).map((c) => ({ label: c, n: counts.get(c) ?? 0 })),
  }
}

export async function computeLibroReport(cfg: LibroConfig, generatedBy: string) {
  const { fields, items: base, byKey, eligible } = await loadCohort(cfg)

  const accOf = (key: string, pool: Item[], limit: number): Acc | null => {
    const def = byKey.get(key)
    if (!def) return null
    const cat = makeCat(def.f, def.kind, pool.map((x) => val(x, key)).filter(Boolean), limit)
    return {
      label: def.f.label,
      of: (x) => {
        const v = val(x, key)
        return v ? cat.of(v) : ''
      },
      order: cat.order,
    }
  }

  const applied: { label: string; values: string[] }[] = []
  let rows = base
  for (const f of cfg.filters) {
    const acc = accOf(f.key, base, 12)
    if (!acc) continue
    const set = new Set(f.values)
    rows = rows.filter((x) => set.has(acc.of(x)))
    applied.push({ label: acc.label, values: f.values })
  }

  const births = rows.filter((x) => x.seg !== 'aborto')
  const aborts = rows.length - births.length
  const days = daysBetween(cfg.from, cfg.to) + 1
  const has = (s: LibroSectionKey) => cfg.sections.includes(s)

  const cross = (title: string, a: Acc | null, b: Acc | null, pool: Item[]): ContingencyTable | null => {
    if (!a || !b) return null
    const m = new Map<string, Map<string, number>>()
    let n = 0
    let excluded = 0
    for (const x of pool) {
      const ra = a.of(x)
      const cb = b.of(x)
      if (!ra || !cb) {
        excluded++
        continue
      }
      n++
      const line = m.get(ra) ?? new Map<string, number>()
      line.set(cb, (line.get(cb) ?? 0) + 1)
      m.set(ra, line)
    }
    const seen = new Set<string>()
    for (const line of m.values()) for (const c of line.keys()) seen.add(c)
    const rowLabels = a.order.filter((r) => m.has(r))
    const colLabels = b.order.filter((c) => seen.has(c))
    if (rowLabels.length < 2 || colLabels.length < 2) return null
    const cells = rowLabels.map((r) => colLabels.map((c) => m.get(r)?.get(c) ?? 0))
    return { title, rowLabel: a.label, colLabel: b.label, rows: rowLabels, cols: colLabels, cells, n, excluded, test: chiSquare(cells) }
  }

  const boxesBy = (pool: Item[], key: string, group: Acc | null) => {
    if (!group) return { boxes: [] as Box[], groups: [] as number[][] }
    const g = new Map<string, number[]>()
    for (const x of pool) {
      const k = group.of(x)
      const v = num(x, key)
      if (!k || v === null) continue
      g.set(k, [...(g.get(k) ?? []), v])
    }
    const labels = group.order.filter((k) => g.has(k))
    return {
      boxes: labels.map((l) => ({ label: l, stats: boxStats(g.get(l) ?? []) })),
      groups: labels.map((l) => g.get(l) ?? []),
    }
  }

  const stayOf = (x: Item): number | null => {
    const a = val(x, 'fecha')
    const b = val(x, 'fecha_alta_rn')
    if (!YMD.test(a) || !YMD.test(b)) return null
    const d = daysBetween(a, b)
    return d >= 0 && d <= 365 ? d : null
  }

  const tipoAcc: Acc = {
    label: 'Tipo de parto',
    of: (x) => (tipoKnown(x) ? up(x, 'tipo_parto') : ''),
    order: ['PARTO VAGINAL', 'PARTO INSTRUMENTAL', 'CESÁREA ELECTIVA', 'CESÁREA DE URGENCIA'],
  }
  const segAcc: Acc = { label: 'Unidad del recién nacido', of: (x) => (x.seg === 'aborto' ? '' : segLabel(x.seg)), order: ['Nursery', 'UCI Neonatal'] }

  const mSec = fields.find((f) => f.key === 'fecha')?.section
  const nSec = fields.find((f) => f.key === 'eg')?.section
  const completeness = (pool: Item[], section: string | undefined) => {
    const list = fields.filter((f) => f.section === section)
    const perField = new Map<string, { answered: number; total: number }>()
    let complete = 0
    for (const x of pool) {
      let ok = true
      for (const f of list) {
        if (!isFieldVisible(f.key, x.r.values)) continue
        const e = perField.get(f.key) ?? { answered: 0, total: 0 }
        e.total++
        if (val(x, f.key)) e.answered++
        else ok = false
        perField.set(f.key, e)
      }
      if (ok) complete++
    }
    return { complete, perField, list }
  }
  const mComp = completeness(rows, mSec)
  const nComp = completeness(births, nSec)
  const completeRows = rows.filter((x) => {
    const mOk = fields.filter((f) => f.section === mSec).every((f) => !isFieldVisible(f.key, x.r.values) || val(x, f.key))
    if (x.seg === 'aborto') return mOk
    return mOk && fields.filter((f) => f.section === nSec).every((f) => !isFieldVisible(f.key, x.r.values) || val(x, f.key))
  })

  // --- Indicadores -----------------------------------------------------------
  const cesRate = makeRate('Cesárea', births, (x) => (tipoKnown(x) ? isCes(x) : null))
  const ratio = (r: LibroRate): { value: string; sub?: string } => ({
    value: r.pct === null ? '—' : fmtPct(r.pct),
    sub: r.total ? `${r.n} de ${r.total} con dato` : 'Sin datos',
  })
  const stayDays = births.map(stayOf).filter((n): n is number => n !== null)
  const kpiValue: Record<LibroKpiKey, () => { value: string; sub?: string }> = {
    registros: () => ({ value: fmtNum(rows.length, 0), sub: `${fmtNum(births.length, 0)} nacimientos y ${fmtNum(aborts, 0)} abortos` }),
    partos: () => ({ value: fmtNum(births.length, 0) }),
    abortos: () => ({ value: fmtNum(aborts, 0), sub: rows.length ? `${fmtPct(pct(aborts, rows.length))} de los registros` : undefined }),
    nursery: () => ({ value: fmtNum(births.filter((x) => x.seg === 'nursery').length, 0) }),
    uci: () => ({ value: fmtNum(births.filter((x) => x.seg === 'uci').length, 0) }),
    uciPct: () => ratio(makeRate('', births, (x) => x.seg === 'uci')),
    promedioDia: () => ({ value: fmtNum(births.length / days, 1), sub: `en ${days} días` }),
    cesarea: () => ratio(cesRate),
    cesareaUrgencia: () => ratio(makeRate('', births, (x) => (tipoKnown(x) ? up(x, 'tipo_parto').includes('URGENCIA') : null))),
    vaginal: () => ratio(makeRate('', births, (x) => (tipoKnown(x) ? up(x, 'tipo_parto') === 'PARTO VAGINAL' : null))),
    instrumental: () => ratio(makeRate('', births, (x) => (tipoKnown(x) ? up(x, 'tipo_parto') === 'PARTO INSTRUMENTAL' : null))),
    induccion: () => ratio(makeRate('', births, (x) => yes(x, 'induccion'))),
    rpm: () => ratio(makeRate('', births, (x) => yes(x, 'rpm'))),
    primigesta: () => ratio(makeRate('', rows, (x) => (up(x, 'paridad') ? up(x, 'paridad') === 'PRIMIGESTA' : null))),
    edadMediana: () => {
      const s = summarize(nums(rows, 'edad'))
      return { value: s ? `${fmtNum(s.median, 0)} años` : '—', sub: s ? `Rango ${fmtNum(s.q1, 0)} a ${fmtNum(s.q3, 0)}` : undefined }
    },
    madre35: () => ratio(makeRate('', rows, (x) => (num(x, 'edad') === null ? null : (num(x, 'edad') as number) >= 35))),
    madreAdolescente: () => ratio(makeRate('', rows, (x) => (num(x, 'edad') === null ? null : (num(x, 'edad') as number) < 20))),
    obesidad: () => ratio(makeRate('', rows, (x) => (num(x, 'imc') === null ? null : (num(x, 'imc') as number) >= 30))),
    controlPrenatal: () => ratio(makeRate('', rows, (x) => yes(x, 'control_prenatal'))),
    prematuros: () => ratio(makeRate('', births, (x) => (num(x, 'eg') === null ? null : (num(x, 'eg') as number) < 37))),
    bajoPeso: () => ratio(makeRate('', births, (x) => (num(x, 'peso') === null ? null : (num(x, 'peso') as number) < 2500))),
    macrosomia: () => ratio(makeRate('', births, (x) => (num(x, 'peso') === null ? null : (num(x, 'peso') as number) >= 4000))),
    apgarBajo: () => ratio(makeRate('', births, (x) => (num(x, 'apgar5') === null ? null : (num(x, 'apgar5') as number) < 7))),
    apego: () => ratio(makeRate('', births, (x) => yes(x, 'apego'))),
    lactancia1h: () => ratio(makeRate('', births, (x) => yes(x, 'lm_1h'))),
    malformacion: () => ratio(makeRate('', births, (x) => yes(x, 'malformacion'))),
    altas: () => {
      const n = births.filter((x) => YMD.test(val(x, 'fecha_alta_rn'))).length
      return { value: fmtNum(n, 0), sub: births.length ? `${fmtPct(pct(n, births.length))} de los nacimientos` : undefined }
    },
    estadia: () => {
      const s = summarize(stayDays)
      return { value: s ? `${fmtNum(s.median, 0)} días` : '—', sub: s ? `Rango ${fmtNum(s.q1, 0)} a ${fmtNum(s.q3, 0)} · ${s.n} altas` : undefined }
    },
    lactanciaExclusiva: () => ratio(makeRate('', births, (x) => (up(x, 'alimentacion_alta') ? up(x, 'alimentacion_alta') === 'LACTANCIA EXCLUSIVA' : null))),
    vhb: () => ratio(makeRate('', births, (x) => yes(x, 'vhb'))),
    tamizaje: () => ratio(makeRate('', births, (x) => yes(x, 'tsh_pku'))),
    completitud: () => ({
      value: rows.length ? fmtPct(pct(completeRows.length, rows.length)) : '—',
      sub: `${completeRows.length} de ${rows.length} registros sin vacíos`,
    }),
  }
  const kpiLabel = new Map(LIBRO_KPIS.map((k) => [k.key, k.label]))
  const kpis: LibroKpi[] = cfg.kpis.map((key) => ({ key, label: kpiLabel.get(key) ?? key, ...kpiValue[key]() }))

  // --- Hallazgos automáticos --------------------------------------------------
  const cesByAge = groupRate(births, (x) => ageBin(val(x, 'edad')), (x) => (tipoKnown(x) ? isCes(x) : null), AGE_ORDER)
  const cesByParity = groupRate(births, (x) => up(x, 'paridad'), (x) => (tipoKnown(x) ? isCes(x) : null), ['PRIMIGESTA', 'MULTÍPARA'])
  const prem = makeRate('', births, (x) => (num(x, 'eg') === null ? null : (num(x, 'eg') as number) < 37))
  const lowW = makeRate('', births, (x) => (num(x, 'peso') === null ? null : (num(x, 'peso') as number) < 2500))
  const uciRate = makeRate('', births, (x) => x.seg === 'uci')
  const highlights: string[] = []
  highlights.push(
    `Se analizaron ${fmtNum(rows.length, 0)} registros entre el ${fmtYmd(cfg.from)} y el ${fmtYmd(cfg.to)}: ${fmtNum(births.length, 0)} nacimientos y ${fmtNum(aborts, 0)} abortos.`,
  )
  if (cesRate.total) {
    highlights.push(
      `La tasa de cesárea fue ${fmtPct(cesRate.pct)}${cesRate.ci ? ` (IC 95 %: ${fmtNum(cesRate.ci[0])} a ${fmtNum(cesRate.ci[1])} %)` : ''}.`,
    )
  }
  const topCes = [...cesByAge, ...cesByParity].filter((b) => b.n >= 10).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0]
  if (topCes && cesRate.total) highlights.push(`La mayor proporción de cesáreas se observó en «${topCes.label}»: ${fmtPct(topCes.pct)} de ${topCes.n} partos.`)
  if (prem.total) highlights.push(`${fmtPct(prem.pct)} de los recién nacidos fue prematuro y ${fmtPct(lowW.pct)} tuvo bajo peso al nacer.`)
  if (uciRate.total) highlights.push(`${fmtPct(uciRate.pct)} de los recién nacidos fue hospitalizado en UCI Neonatal.`)
  if (rows.length && completeRows.length / rows.length < 0.9) {
    highlights.push(`Solo ${fmtPct(pct(completeRows.length, rows.length))} de los registros está completo: interpreta las cifras considerando los datos faltantes.`)
  }

  const report: LibroReport = {
    meta: {
      title: cfg.title,
      subtitle: cfg.subtitle,
      notes: cfg.notes,
      generatedAt: new Date().toISOString(),
      generatedBy,
      from: cfg.from,
      to: cfg.to,
      days,
      scope: cfg.scope,
      scopeLabel: LIBRO_SCOPES.find((s) => s.value === cfg.scope)?.label ?? '',
      basis: cfg.basis,
      basisLabel: LIBRO_BASIS.find((s) => s.value === cfg.basis)?.label ?? '',
    },
    cohort: { n: rows.length, beforeFilters: base.length, filters: applied },
    highlights,
    kpis,
    catalog: eligible.map(({ f, kind }) => ({ key: f.key, label: f.label, group: f.group, section: f.section, kind })),
  }

  // --- Actividad en el tiempo -------------------------------------------------
  if (has('flujo')) {
    const g = cfg.granularity === 'auto' ? (days <= 62 ? 'dia' : days <= 190 ? 'semana' : 'mes') : cfg.granularity
    const granularity = g === 'dia' && days > 124 ? 'semana' : g === 'semana' && days > 900 ? 'mes' : g
    const keyOf = (ymd: string) => (granularity === 'dia' ? ymd : granularity === 'semana' ? mondayOf(ymd) : ymd.slice(0, 7))
    const labelOf = (key: string) =>
      granularity === 'mes' ? `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}` : `${key.slice(8, 10)}/${key.slice(5, 7)}`
    const keys: string[] = []
    if (granularity === 'mes') {
      let y = Number(cfg.from.slice(0, 4))
      let m = Number(cfg.from.slice(5, 7))
      const end = cfg.to.slice(0, 7)
      for (;;) {
        const k = `${y}-${String(m).padStart(2, '0')}`
        if (k > end) break
        keys.push(k)
        if (++m > 12) {
          m = 1
          y++
        }
      }
    } else {
      for (let d = granularity === 'semana' ? mondayOf(cfg.from) : cfg.from; d <= cfg.to; d = addDaysYmd(d, granularity === 'semana' ? 7 : 1)) keys.push(d)
    }
    const map = new Map(keys.map((k) => [k, { key: k, label: labelOf(k), nursery: 0, uci: 0, abortos: 0, total: 0 }]))
    for (const x of rows) {
      const p = map.get(keyOf(x.event))
      if (!p) continue
      if (x.seg === 'aborto') p.abortos++
      else if (x.seg === 'uci') p.uci++
      else p.nursery++
      p.total++
    }
    report.flow = {
      granularity,
      points: keys.map((k) => map.get(k)!),
      weekday: bars(rows.map((x) => WEEKDAYS[weekdayIdx(x.event)]), WEEKDAYS, 7),
    }
  }

  // --- Perfil materno ---------------------------------------------------------
  if (has('materno')) {
    const upper = (k: string, pool = rows) => pool.map((x) => up(x, k))
    report.maternal = {
      age: hist('Edad materna', 'años', nums(rows, 'edad'), 2),
      ageBins: bars(rows.map((x) => ageBin(val(x, 'edad'))), AGE_ORDER),
      bmi: bars(rows.map((x) => bmiBin(val(x, 'imc'))), BMI_ORDER),
      parity: bars(upper('paridad'), ['PRIMIGESTA', 'MULTÍPARA']),
      origin: bars(upper('pais_origen'), undefined, 8),
      indigenous: bars(upper('pueblo_originario'), ['SI', 'NO']),
      prenatal: bars(upper('control_prenatal'), ['SI', 'NO']),
      prevision: bars(upper('prevision'), undefined, 8),
      procedencia: bars(upper('procedencia'), undefined, 8),
    }
  }

  // --- Parto ------------------------------------------------------------------
  if (has('parto')) {
    const robsonOrder = [...new Set(births.map((x) => up(x, 'robson')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    report.delivery = {
      type: bars(rows.map((x) => up(x, 'tipo_parto')), [...tipoAcc.order, 'ABORTO']),
      robson: bars(births.map((x) => up(x, 'robson')), robsonOrder, 12),
      cesareanCause: bars(births.filter(isCes).map((x) => up(x, 'causa_cesarea')), undefined, 8),
      induction: bars(births.map((x) => up(x, 'induccion')), ['SI', 'NO']),
      rpm: bars(births.map((x) => up(x, 'rpm')), ['SI', 'NO']),
      placenta: bars(births.map((x) => up(x, 'entrega_placenta')), ['SI', 'NO']),
      cesareaByAge: cesByAge,
      cesareaByParity: cesByParity,
      cesareaByPrevision: groupRate(births, (x) => up(x, 'prevision'), (x) => (tipoKnown(x) ? isCes(x) : null), undefined, 6),
    }
  }

  // --- Recién nacido ----------------------------------------------------------
  if (has('rn')) {
    const wt = boxesBy(births, 'peso', tipoAcc)
    const gt = boxesBy(births, 'eg', tipoAcc)
    const apgar = (k: string) =>
      births.map((x) => {
        const n = num(x, k)
        return n === null ? '' : n <= 3 ? APGAR_BANDS[0] : n <= 6 ? APGAR_BANDS[1] : APGAR_BANDS[2]
      })
    report.newborn = {
      ga: hist('Edad gestacional', 'semanas', nums(births, 'eg'), 1),
      weight: hist('Peso al nacer', 'g', nums(births, 'peso'), 250),
      gaBins: bars(births.map((x) => gaBin(val(x, 'eg'))), GA_ORDER),
      weightBins: bars(births.map((x) => weightBin(val(x, 'peso'))), WEIGHT_ORDER),
      sex: bars(births.map((x) => up(x, 'sexo_rn')), ['FEMENINO', 'MASCULINO', 'INDETERMINADO']),
      apgar1: bars(apgar('apgar1'), APGAR_BANDS),
      apgar5: bars(apgar('apgar5'), APGAR_BANDS),
      apego: bars(births.map((x) => up(x, 'apego')), ['SI', 'NO']),
      lactancia1h: bars(births.map((x) => up(x, 'lm_1h')), ['SI', 'NO']),
      malformacion: bars(births.map((x) => up(x, 'malformacion')), ['SI', 'NO']),
      weightByType: wt.boxes,
      gaByType: gt.boxes,
      weightTest: kruskalWallis(wt.groups),
    }
  }

  // --- Asociaciones -----------------------------------------------------------
  if (has('contingencia')) {
    const a = (k: string, limit = 6) => accOf(k, births, limit)
    const list: (ContingencyTable | null)[] = []
    if (cfg.cross) list.push(cross(`${byKey.get(cfg.cross.row)?.f.label ?? cfg.cross.row} × ${byKey.get(cfg.cross.col)?.f.label ?? cfg.cross.col}`, accOf(cfg.cross.row, rows, 8), accOf(cfg.cross.col, rows, 8), rows))
    const pairs: [Acc | null, Acc | null][] = [
      [tipoAcc, a('eg')],
      [a('edad'), tipoAcc],
      [a('paridad'), tipoAcc],
      [tipoAcc, a('apgar5')],
      [a('control_prenatal'), a('eg')],
      [a('imc'), a('peso')],
      [a('prevision', 5), tipoAcc],
      [segAcc, tipoAcc],
      [segAcc, a('eg')],
    ]
    for (const [r, c] of pairs) list.push(cross(`${r?.label ?? ''} × ${c?.label ?? ''}`, r, c, births))
    report.contingency = list.filter((t): t is ContingencyTable => t !== null)
  }

  // --- Exámenes y coberturas --------------------------------------------------
  if (has('examenes')) {
    const pos = (k: string, positive: string, negative: string) => (x: Item) => {
      const v = up(x, k)
      return v === positive ? true : v === negative ? false : null
    }
    const sgbPos = rows.filter((x) => up(x, 'sgb_res') === 'POSITIVO')
    const rpmYes = births.filter((x) => yes(x, 'rpm') === true)
    const hivPos = births.filter((x) => up(x, 'elisa_res') === 'POSITIVO')
    const coverage: LibroRate[] = [
      makeRate('Control prenatal', rows, (x) => yes(x, 'control_prenatal')),
      makeRate('Profilaxis SGB en madres con SGB positivo', sgbPos, (x) => (up(x, 'prof_sgb') === 'SI' ? true : up(x, 'prof_sgb') === 'NO' ? false : null)),
      makeRate('Profilaxis en madres con RPM', rpmYes, (x) => yes(x, 'profilaxis_rpm')),
      makeRate('Vacuna VHB al recién nacido', births, (x) => yes(x, 'vhb')),
      makeRate('Vacuna BCG', births, (x) => yes(x, 'bcg')),
      makeRate('Nirsevimab', births, (x) => yes(x, 'nirsevimab')),
      makeRate('TSH / PKU', births, (x) => yes(x, 'tsh_pku')),
      makeRate('PEAT realizado', births, (x) => yes(x, 'peat')),
      makeRate('PEAT con resultado «refiere»', births, pos('peat_resultado', 'REFIERE', 'PASA')),
      makeRate('Interconsulta de cardiología', births, (x) => yes(x, 'ic_cardiologia')),
      makeRate('BCG aplicada en RN de madre con ELISA positivo', hivPos, (x) => yes(x, 'bcg'), 'Valor esperado: 0 %'),
    ]
    report.exams = {
      maternal: [
        makeRate('ELISA positivo', rows, pos('elisa_res', 'POSITIVO', 'NEGATIVO')),
        makeRate('VDRL reactivo', rows, pos('vdrl_res', 'REACTIVO', 'NO REACTIVO')),
        makeRate('SGB positivo', rows, pos('sgb_res', 'POSITIVO', 'NEGATIVO')),
        makeRate('Hepatitis B positivo', rows, pos('hb_res', 'POSITIVO', 'NEGATIVO')),
        makeRate('Chagas positivo', rows, pos('chagas_res', 'POSITIVO', 'NEGATIVO')),
      ].filter((r) => r.total > 0),
      coverage: coverage.filter((r) => r.total > 0),
    }
  }

  // --- Alta y estadía ---------------------------------------------------------
  if (has('alta')) {
    const stayVals = births.map(stayOf)
    const withStay = births.filter((_, i) => stayVals[i] !== null)
    const stayAcc = (g: Acc) => {
      const m = new Map<string, number[]>()
      births.forEach((x, i) => {
        const k = g.of(x)
        const d = stayVals[i]
        if (k && d !== null) m.set(k, [...(m.get(k) ?? []), d])
      })
      const labels = g.order.filter((k) => m.has(k))
      return { boxes: labels.map((l) => ({ label: l, stats: boxStats(m.get(l) ?? []) })), groups: labels.map((l) => m.get(l) ?? []) }
    }
    const byType = stayAcc(tipoAcc)
    const bySeg = stayAcc(segAcc)
    const stayTest: KruskalResult | null = kruskalWallis(byType.groups)
    report.discharge = {
      feeding: bars(births.map((x) => up(x, 'alimentacion_alta')), ['LACTANCIA EXCLUSIVA', 'LACTANCIA MIXTA', 'FÓRMULA', 'OTRA']),
      segment: bars(births.map((x) => segLabel(x.seg)), ['Nursery', 'UCI Neonatal']),
      stay: hist('Estadía del recién nacido', 'días', withStay.map((x) => stayOf(x) as number), 1),
      stayBySegment: bySeg.boxes,
      stayByType: byType.boxes,
      stayTest,
    }
  }

  // --- Carga por día y franja -------------------------------------------------
  if (has('turnos')) {
    const cells = WEEKDAYS.map(() => BANDS.map(() => 0))
    const bandVals: string[] = []
    for (const x of births) {
      const m = /^(\d{1,2}):/.exec(val(x, 'hora'))
      if (!m || !YMD.test(x.date)) continue
      const b = Math.min(3, Math.floor(Number(m[1]) / 6))
      cells[weekdayIdx(x.date)][b]++
      bandVals.push(BANDS[b])
    }
    const heat: Heat = { title: 'Partos según día de la semana y franja horaria', rows: WEEKDAYS, cols: BANDS, cells, max: Math.max(0, ...cells.flat()) }
    report.shifts = { heat, band: bars(bandVals, BANDS, 4) }
  }

  // --- Calidad ----------------------------------------------------------------
  if (has('calidad')) {
    const lowest = [...mComp.perField, ...nComp.perField]
      .map(([key, e]) => ({ key, ...e }))
      .filter((e) => e.total >= 5)
      .map((e) => {
        const f = fields.find((x) => x.key === e.key)!
        return { label: f.label, section: f.group, answered: e.answered, total: e.total, pct: round1((e.answered / e.total) * 100) }
      })
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 12)
    report.quality = {
      sections: [
        { label: 'Maternidad: registros completos', n: mComp.complete, total: rows.length, pct: pct(mComp.complete, rows.length), ci: wilson(mComp.complete, rows.length) },
        { label: 'Neonatología: registros completos', n: nComp.complete, total: births.length, pct: pct(nComp.complete, births.length), ci: wilson(nComp.complete, births.length) },
      ],
      lowest,
    }
  }

  // --- Columnas elegidas ------------------------------------------------------
  if (has('columnas') && cfg.columns.length > 0) {
    const byAcc = cfg.by ? accOf(cfg.by, rows, 8) : null
    const blocks: LibroColumnBlock[] = []
    for (const key of cfg.columns) {
      const def = byKey.get(key)
      const acc = accOf(key, rows, 12)
      if (!def || !acc) continue
      const answers = rows.map((x) => acc.of(x))
      const dist = bars(answers, acc.order, 50)
      const values = def.kind === 'numero' ? nums(rows, key) : []
      const withBy = byAcc && cfg.by !== key
      const box = withBy && def.kind === 'numero' ? boxesBy(rows, key, byAcc) : null
      blocks.push({
        key,
        label: def.f.label,
        section: def.f.section,
        kind: def.kind,
        answered: answers.filter(Boolean).length,
        dist,
        summary: values.length ? summarize(values) : null,
        hist: values.length ? hist(def.f.label, '', values) : null,
        cross: withBy ? cross(`${byAcc.label} × ${def.f.label}`, byAcc, acc, rows) : null,
        boxes: box && box.boxes.length ? box.boxes : null,
        kruskal: box ? kruskalWallis(box.groups) : null,
      })
    }
    report.columns = blocks
  }

  const dataKeys = eligible.map((e) => e.f.key)
  const data = rows.map((x) => {
    const row: Record<string, string> = { unidad: segLabel(x.seg) }
    for (const k of dataKeys) row[k] = val(x, k)
    return row
  })
  return { report, data }
}
