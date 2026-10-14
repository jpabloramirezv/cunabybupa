import { getBookFields, type BookRecordOut } from '@/lib/server/book'
import { listRecords } from '@/lib/server/book-records'
import { segmentOf, sectionProgress, type BookSegment } from '@/lib/book-flow'
import { addDaysYmd } from '@/lib/time'

export type StatsSegment = 'nursery' | 'uci' | 'todos'

export type Dist = { label: string; n: number; pct: number }[]
export type Rate = { label: string; n: number; total: number; pct: number | null }

export type BookStats = {
  period: { from: string; to: string }
  segment: StatsSegment
  totals: {
    births: number
    nursery: number
    uci: number
    abortos: number
    discharged: number
    uciPct: number | null
    pendingMaternity: number
    pendingNeonatal: number
  }
  deliveryType: Dist
  sex: Dist
  gestationalAge: Dist
  weight: Dist
  feeding: Dist
  rates: Rate[]
  series: { key: string; label: string; nursery: number; uci: number }[]
  granularity: 'dia' | 'mes'
}

const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 1000) / 10)

function dist(values: string[], order?: string[]): Dist {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const labels = order ? [...order.filter((o) => counts.has(o)), ...[...counts.keys()].filter((k) => !order.includes(k))] : [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
  return labels.map((label) => ({ label, n: counts.get(label) ?? 0, pct: total ? Math.round(((counts.get(label) ?? 0) / total) * 1000) / 10 : 0 }))
}

const gaBin = (v: string) => {
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n)) return ''
  if (n < 28) return 'Extremo (<28)'
  if (n < 32) return 'Muy prematuro (28-31)'
  if (n < 37) return 'Prematuro (32-36)'
  return 'De término (37+)'
}
const GA_ORDER = ['Extremo (<28)', 'Muy prematuro (28-31)', 'Prematuro (32-36)', 'De término (37+)']

const weightBin = (v: string) => {
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n)) return ''
  if (n < 1000) return '< 1.000 g'
  if (n < 1500) return '1.000 - 1.499 g'
  if (n < 2500) return '1.500 - 2.499 g'
  if (n < 4000) return '2.500 - 3.999 g'
  return '4.000 g o más'
}
const WEIGHT_ORDER = ['< 1.000 g', '1.000 - 1.499 g', '1.500 - 2.499 g', '2.500 - 3.999 g', '4.000 g o más']

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function yesRate(label: string, rows: BookRecordOut[], key: string, yes = 'SI'): Rate {
  const answered = rows.filter((r) => r.values[key] === 'SI' || r.values[key] === 'NO' || (yes !== 'SI' && r.values[key]))
  const n = answered.filter((r) => r.values[key] === yes).length
  return { label, n, total: answered.length, pct: pct(n, answered.length) }
}

export async function computeBookStats(from: string, to: string, segment: StatsSegment): Promise<BookStats> {
  const fields = await getBookFields()
  const all = await listRecords(fields)
  const dateOf = (r: BookRecordOut) => r.values.fecha || r.createdAt.slice(0, 10)
  const inPeriod = all
    .filter((r) => {
      const d = dateOf(r)
      return d >= from && d <= to
    })
    .map((r) => ({ r, seg: segmentOf(r.values, r.episodeId) as BookSegment }))

  const births = inPeriod.filter((x) => x.seg !== 'aborto')
  const nursery = births.filter((x) => x.seg === 'nursery')
  const uci = births.filter((x) => x.seg === 'uci')
  const abortos = inPeriod.length - births.length

  const scope = segment === 'nursery' ? nursery : segment === 'uci' ? uci : births
  const scopeAll = segment === 'todos' ? inPeriod : scope
  const rows = scope.map((x) => x.r)

  const discharged = rows.filter((r) => {
    const d = r.values.fecha_alta_rn
    return !!d && d >= from && d <= to
  }).length

  const pendingMaternity = scopeAll.filter((x) => sectionProgress(fields, x.r.values, 'materno').state !== 'completo').length
  const pendingNeonatal = scope.filter((x) => sectionProgress(fields, x.r.values, 'neonatal').state !== 'completo').length

  const cesareas = rows.filter((r) => (r.values.tipo_parto ?? '').toUpperCase().includes('CESÁREA')).length
  const withDelivery = rows.filter((r) => r.values.tipo_parto).length
  const rates: Rate[] = [
    { label: 'Cesárea', n: cesareas, total: withDelivery, pct: pct(cesareas, withDelivery) },
    yesRate('Inducción del trabajo de parto', rows, 'induccion'),
    yesRate('Control prenatal', rows, 'control_prenatal'),
    yesRate('Apego', rows, 'apego'),
    yesRate('Lactancia en la primera hora', rows, 'lm_1h'),
    yesRate('Malformación congénita', rows, 'malformacion'),
    yesRate('Vacuna VHB', rows, 'vhb'),
    yesRate('Vacuna BCG', rows, 'bcg'),
    yesRate('Nirsevimab', rows, 'nirsevimab'),
    yesRate('TSH / PKU', rows, 'tsh_pku'),
    yesRate('PEAT', rows, 'peat'),
    yesRate('IC cardiología', rows, 'ic_cardiologia'),
  ]

  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
  const granularity: 'dia' | 'mes' = days <= 62 ? 'dia' : 'mes'
  const buckets = new Map<string, { key: string; label: string; nursery: number; uci: number }>()
  if (granularity === 'dia') {
    for (let i = 0; i < days; i++) {
      const d = addDaysYmd(from, i)
      buckets.set(d, { key: d, label: `${d.slice(8, 10)}/${d.slice(5, 7)}`, nursery: 0, uci: 0 })
    }
  }
  for (const x of births) {
    if (x.seg === 'nursery' && segment === 'uci') continue
    if (x.seg === 'uci' && segment === 'nursery') continue
    const d = dateOf(x.r)
    const key = granularity === 'dia' ? d : d.slice(0, 7)
    let b = buckets.get(key)
    if (!b) {
      b = { key, label: granularity === 'dia' ? key : `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`, nursery: 0, uci: 0 }
      buckets.set(key, b)
    }
    b[x.seg === 'uci' ? 'uci' : 'nursery']++
  }

  return {
    period: { from, to },
    segment,
    totals: {
      births: scope.length,
      nursery: nursery.length,
      uci: uci.length,
      abortos,
      discharged,
      uciPct: pct(uci.length, births.length),
      pendingMaternity,
      pendingNeonatal,
    },
    deliveryType: dist(scopeAll.map((x) => x.r.values.tipo_parto ?? '')),
    sex: dist(rows.map((r) => r.values.sexo_rn ?? '')),
    gestationalAge: dist(rows.map((r) => gaBin(r.values.eg ?? '')), GA_ORDER),
    weight: dist(rows.map((r) => weightBin(r.values.peso ?? '')), WEIGHT_ORDER),
    feeding: dist(rows.map((r) => r.values.alimentacion_alta ?? '')),
    rates,
    series: [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)),
    granularity,
  }
}
