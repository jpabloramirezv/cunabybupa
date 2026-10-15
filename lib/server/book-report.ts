import { getBookFields, type BookFieldRow } from '@/lib/server/book'
import { listRecords } from '@/lib/server/book-records'
import { segmentOf } from '@/lib/book-flow'
import { ymdInSantiago } from '@/lib/time'
import type { BookSection } from '@/lib/book-fields'
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
  type Dist,
} from '@/lib/server/book-stats'

/** `nacimientos` reúne Nursery y UPC, sin abortos. */
export type ReportScope = 'todos' | 'nacimientos' | 'nursery' | 'uci' | 'aborto'
export type ColumnKind = 'categoria' | 'numero' | 'fecha' | 'hora'

export type CatalogField = { key: string; label: string; section: BookSection; group: string; kind: ColumnKind }
export type NumberSummary = { mean: number; median: number; p25: number; p75: number; min: number; max: number }
export type CrossTab = { by: string; columns: string[]; rows: { label: string; total: number; cells: number[] }[] }
export type ColumnReport = {
  key: string
  label: string
  section: BookSection
  kind: ColumnKind
  answered: number
  dist: Dist
  summary: NumberSummary | null
  cross: CrossTab | null
}
export type BookColumnReport = {
  period: { from: string; to: string }
  scope: ReportScope
  total: number
  catalog: CatalogField[]
  by: { key: string; label: string } | null
  columns: ColumnReport[]
}

/** Columnas que identifican a una persona o son solo correlativos: nunca entran a las estadísticas. */
const EXCLUDED_KEYS = new Set([
  'rut',
  'nombre',
  'ap_paterno',
  'ap_materno',
  'n_admision',
  'rn_episodio',
  'run_rn',
  'ap_paterno_rn',
  'ap_materno_rn',
  'fono',
  'elisa_n',
  'vdrl_n',
])
const EXCLUDED_SOURCE = /^(identity|patient|mother)\./
/** Texto libre que sí es una categoría útil (el resto de columnas de texto puede contener datos personales). */
const TEXT_CATEGORIES = new Set(['pais_origen', 'procedencia', 'robson', 'causa_cesarea', 'tiempo_rpm', 'prevision', 'prevision_rn'])

const MAX_COLUMNS = 12
const MAX_CATEGORIES = 12
const MAX_BY_CATEGORIES = 8
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function kindOf(f: BookFieldRow): ColumnKind | null {
  if (EXCLUDED_KEYS.has(f.key) || (f.source && EXCLUDED_SOURCE.test(f.source))) return null
  if (f.type === 'select' || f.type === 'doctor') return 'categoria'
  if (f.type === 'text') return TEXT_CATEGORIES.has(f.key) ? 'categoria' : null
  if (f.type === 'number' || f.type === 'decimal') return 'numero'
  if (f.type === 'date') return 'fecha'
  if (f.type === 'time') return 'hora'
  return null
}

export type Cat = { of: (v: string) => string; order: string[] }

const APGAR_ORDER = ['0 a 3', '4 a 6', '7 a 10']
const apgarBin = (v: string) => {
  const n = numOf(v)
  if (n === null) return ''
  return n <= 3 ? APGAR_ORDER[0] : n <= 6 ? APGAR_ORDER[1] : APGAR_ORDER[2]
}

const KNOWN: Record<string, Cat> = {
  edad: { of: (v) => ageBin(v), order: AGE_ORDER },
  imc: { of: (v) => bmiBin(v), order: BMI_ORDER },
  eg: { of: gaBin, order: GA_ORDER },
  peso: { of: weightBin, order: WEIGHT_ORDER },
  apgar1: { of: apgarBin, order: APGAR_ORDER },
  apgar5: { of: apgarBin, order: APGAR_ORDER },
}

const fmtNum = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 })

function numericCat(vals: string[]): Cat {
  const nums = vals.map(numOf).filter((n): n is number => n !== null)
  if (nums.length === 0) return { of: () => '', order: [] }
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  if (min === max) {
    const label = fmtNum(min)
    return { of: (v) => (numOf(v) === null ? '' : label), order: [label] }
  }
  const allInts = nums.every(Number.isInteger)
  if (allInts && max - min <= 7) {
    const order = Array.from({ length: max - min + 1 }, (_, i) => fmtNum(min + i))
    return {
      of: (v) => {
        const n = numOf(v)
        return n === null ? '' : fmtNum(Math.round(n))
      },
      order,
    }
  }
  const k = 6
  const width = (max - min) / k
  const edges = Array.from({ length: k + 1 }, (_, i) => min + width * i)
  const order = Array.from({ length: k }, (_, i) => `${fmtNum(edges[i])} a ${fmtNum(edges[i + 1])}`)
  return {
    of: (v) => {
      const n = numOf(v)
      if (n === null) return ''
      return order[Math.min(k - 1, Math.floor((n - min) / width))]
    },
    order,
  }
}

const monthLabel = (v: string) => (/^\d{4}-\d{2}/.test(v) ? `${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(2, 4)}` : '')

const HOUR_ORDER = ['Madrugada (00 a 05 h)', 'Mañana (06 a 11 h)', 'Tarde (12 a 17 h)', 'Noche (18 a 23 h)']
const hourBin = (v: string) => {
  const m = /^(\d{1,2}):/.exec(v)
  if (!m) return ''
  const h = Number(m[1])
  return h < 6 ? HOUR_ORDER[0] : h < 12 ? HOUR_ORDER[1] : h < 18 ? HOUR_ORDER[2] : HOUR_ORDER[3]
}

export function makeCat(f: BookFieldRow, kind: ColumnKind, vals: string[], limit: number): Cat {
  if (kind === 'numero') return KNOWN[f.key] ?? numericCat(vals)
  if (kind === 'fecha') {
    const order = [...new Set(vals.map((v) => v.slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().map(monthLabel)
    return { of: monthLabel, order }
  }
  if (kind === 'hora') return { of: hourBin, order: HOUR_ORDER }

  const norm = (v: string) => (f.type === 'text' ? v.trim().toUpperCase() : v.trim())
  const counts = new Map<string, number>()
  for (const v of vals) {
    const c = norm(v)
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const byCount = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
  if (counts.size > limit) {
    const top = byCount.slice(0, limit - 1)
    const set = new Set(top)
    return { of: (v) => (norm(v) ? (set.has(norm(v)) ? norm(v) : 'Otros') : ''), order: [...top, 'Otros'] }
  }
  const fromOptions = f.options.filter((o) => counts.has(o))
  const order = [...fromOptions, ...byCount.filter((k) => !fromOptions.includes(k))]
  return { of: (v) => norm(v), order }
}

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}
const round1 = (n: number) => Math.round(n * 10) / 10

function summarize(vals: string[]): NumberSummary | null {
  const nums = vals.map(numOf).filter((n): n is number => n !== null).sort((a, b) => a - b)
  if (nums.length === 0) return null
  return {
    mean: round1(nums.reduce((a, b) => a + b, 0) / nums.length),
    median: round1(quantile(nums, 0.5)),
    p25: round1(quantile(nums, 0.25)),
    p75: round1(quantile(nums, 0.75)),
    min: round1(nums[0]),
    max: round1(nums.at(-1)!),
  }
}

export async function computeBookColumnReport(opts: {
  from: string
  to: string
  scope: ReportScope
  keys: string[]
  by?: string | null
}): Promise<BookColumnReport> {
  const fields = await getBookFields()
  const eligible = fields
    .map((f) => ({ f, kind: kindOf(f) }))
    .filter((x): x is { f: BookFieldRow; kind: ColumnKind } => x.kind !== null)
  const catalog: CatalogField[] = eligible.map(({ f, kind }) => ({ key: f.key, label: f.label, section: f.section, group: f.group, kind }))
  const byKey = new Map(eligible.map((x) => [x.f.key, x]))

  const all = await listRecords(fields)
  const rows = all.filter((r) => {
    const d = r.values.fecha || ymdInSantiago(r.createdAt)
    if (d < opts.from || d > opts.to) return false
    if (opts.scope === 'todos') return true
    const seg = segmentOf(r.values, r.episodeId)
    return opts.scope === 'nacimientos' ? seg !== 'aborto' : seg === opts.scope
  })

  const valueOf = (r: (typeof rows)[number], key: string) => (r.values[key] ?? '').trim()

  const byDef = opts.by ? byKey.get(opts.by) : undefined
  const byCat = byDef
    ? makeCat(byDef.f, byDef.kind, rows.map((r) => valueOf(r, byDef.f.key)).filter(Boolean), MAX_BY_CATEGORIES)
    : null

  const columns: ColumnReport[] = []
  for (const key of [...new Set(opts.keys)].slice(0, MAX_COLUMNS)) {
    const def = byKey.get(key)
    if (!def) continue
    const vals = rows.map((r) => valueOf(r, key)).filter(Boolean)
    const cat = makeCat(def.f, def.kind, vals, MAX_CATEGORIES)
    const counts = new Map<string, number>()
    for (const v of vals) {
      const label = cat.of(v)
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    const answered = [...counts.values()].reduce((a, b) => a + b, 0)
    const labels = cat.order.filter((l) => counts.has(l))
    const dist: Dist = labels.map((label) => ({
      label,
      n: counts.get(label) ?? 0,
      pct: answered ? Math.round(((counts.get(label) ?? 0) / answered) * 1000) / 10 : 0,
    }))

    let cross: CrossTab | null = null
    if (byDef && byCat && byDef.f.key !== key) {
      const matrix = new Map<string, Map<string, number>>()
      for (const r of rows) {
        const g = byCat.of(valueOf(r, byDef.f.key))
        const c = cat.of(valueOf(r, key))
        if (!g || !c) continue
        const line = matrix.get(g) ?? new Map<string, number>()
        line.set(c, (line.get(c) ?? 0) + 1)
        matrix.set(g, line)
      }
      cross = {
        by: byDef.f.label,
        columns: labels,
        rows: byCat.order
          .filter((g) => matrix.has(g))
          .map((g) => {
            const cells = labels.map((l) => matrix.get(g)?.get(l) ?? 0)
            return { label: g, total: cells.reduce((a, b) => a + b, 0), cells }
          }),
      }
    }

    columns.push({
      key,
      label: def.f.label,
      section: def.f.section,
      kind: def.kind,
      answered,
      dist,
      summary: def.kind === 'numero' ? summarize(vals) : null,
      cross,
    })
  }

  return {
    period: { from: opts.from, to: opts.to },
    scope: opts.scope,
    total: rows.length,
    catalog,
    by: byDef ? { key: byDef.f.key, label: byDef.f.label } : null,
    columns,
  }
}
