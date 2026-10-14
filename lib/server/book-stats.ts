import { getBookFields, type BookRecordOut } from '@/lib/server/book'
import { listRecords } from '@/lib/server/book-records'
import { segmentOf, sectionProgress, type BookSegment } from '@/lib/book-flow'
import { addDaysYmd } from '@/lib/time'

export type StatsSegment = 'nursery' | 'uci' | 'todos'

export type Dist = { label: string; n: number; pct: number }[]
export type Rate = { label: string; n: number; total: number; pct: number | null }

export type CrossRow = { label: string; n: number; hits: number; pct: number | null }
export type Cross = { id: string; title: string; hint: string; outcome: string; rows: CrossRow[] }
export type RiskItem = {
  label: string
  mothers: number
  follow: string
  followN: number
  expect: 'todos' | 'ninguno'
}

/** Mirada conjunta del recién nacido y su madre, calculada solo con datos agregados. */
export type Binomio = {
  n: number
  complete: number
  completePct: number | null
  age: Dist
  bmi: Dist
  parity: Dist
  origin: Dist
  indigenous: Dist
  prenatal: Dist
  crosses: Cross[]
  risks: RiskItem[]
}

export type BookStats = {
  binomio: Binomio
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

const numOf = (v: string | undefined) => {
  if (!v) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const AGE_ORDER = ['Menor de 20 años', '20 a 34 años', '35 años o más']
const ageBin = (v: string | undefined) => {
  const n = numOf(v)
  if (n === null) return ''
  return n < 20 ? AGE_ORDER[0] : n < 35 ? AGE_ORDER[1] : AGE_ORDER[2]
}
const BMI_ORDER = ['Bajo peso (< 18,5)', 'Normal (18,5 a 24,9)', 'Sobrepeso (25 a 29,9)', 'Obesidad (30 o más)']
const bmiBin = (v: string | undefined) => {
  const n = numOf(v)
  if (n === null) return ''
  return n < 18.5 ? BMI_ORDER[0] : n < 25 ? BMI_ORDER[1] : n < 30 ? BMI_ORDER[2] : BMI_ORDER[3]
}

type Item = { r: BookRecordOut; seg: BookSegment }

/** `hit` devuelve null cuando el dato no permite evaluar el resultado: esa fila no cuenta. */
function cross(
  meta: Omit<Cross, 'rows'>,
  items: Item[],
  group: (r: BookRecordOut) => string,
  hit: (x: Item) => boolean | null,
  order?: string[],
): Cross {
  const acc = new Map<string, { n: number; hits: number }>()
  for (const x of items) {
    const g = group(x.r)
    const h = hit(x)
    if (!g || h === null) continue
    const cur = acc.get(g) ?? { n: 0, hits: 0 }
    cur.n++
    if (h) cur.hits++
    acc.set(g, cur)
  }
  const labels = order ? order.filter((o) => acc.has(o)) : [...acc.keys()]
  return { ...meta, rows: labels.map((label) => ({ label, ...acc.get(label)!, pct: pct(acc.get(label)!.hits, acc.get(label)!.n) })) }
}

const yn = (v: string | undefined) => (v === 'SI' ? true : v === 'NO' ? false : null)
const isCesarea = (r: BookRecordOut) => (r.values.tipo_parto ?? '').toUpperCase().includes('CESÁREA')

function computeBinomio(fields: Awaited<ReturnType<typeof getBookFields>>, items: Item[], segment: StatsSegment): Binomio {
  const complete = items.filter(
    (x) =>
      sectionProgress(fields, x.r.values, 'materno').state === 'completo' &&
      sectionProgress(fields, x.r.values, 'neonatal').state === 'completo',
  ).length

  const rows = items.map((x) => x.r)
  const originOf = (r: BookRecordOut) => (r.values.pais_origen ?? '').trim().toUpperCase()
  const topOrigins = dist(rows.map(originOf)).slice(0, 5)

  const crosses: Cross[] = [
    cross(
      { id: 'edad-prematuridad', title: 'Edad materna y prematuridad', hint: 'Porcentaje de RN nacidos antes de las 37 semanas según la edad de la madre.', outcome: 'Prematuros (< 37 sem)' },
      items,
      (r) => ageBin(r.values.edad),
      (x) => {
        const eg = numOf(x.r.values.eg)
        return eg === null ? null : eg < 37
      },
      AGE_ORDER,
    ),
    cross(
      { id: 'control-prematuridad', title: 'Control prenatal y prematuridad', hint: 'Compara la prematuridad entre madres con y sin control prenatal.', outcome: 'Prematuros (< 37 sem)' },
      items,
      (r) => (r.values.control_prenatal === 'SI' ? 'Con control prenatal' : r.values.control_prenatal === 'NO' ? 'Sin control prenatal' : ''),
      (x) => {
        const eg = numOf(x.r.values.eg)
        return eg === null ? null : eg < 37
      },
      ['Con control prenatal', 'Sin control prenatal'],
    ),
    cross(
      { id: 'paridad-cesarea', title: 'Paridad y cesárea', hint: 'Porcentaje de partos por cesárea según la paridad de la madre.', outcome: 'Cesárea' },
      items,
      (r) => r.values.paridad ?? '',
      (x) => (x.r.values.tipo_parto ? isCesarea(x.r) : null),
    ),
    cross(
      { id: 'imc-macrosomia', title: 'IMC materno y peso al nacer', hint: 'Porcentaje de RN con 4.000 g o más según el IMC de la madre.', outcome: 'Peso ≥ 4.000 g' },
      items,
      (r) => bmiBin(r.values.imc),
      (x) => {
        const p = numOf(x.r.values.peso)
        return p === null ? null : p >= 4000
      },
      BMI_ORDER,
    ),
    cross(
      { id: 'parto-apgar', title: "Tipo de parto y Apgar bajo", hint: "Porcentaje de RN con Apgar a los 5' menor de 7 según cómo nació.", outcome: "Apgar 5' < 7" },
      items,
      (r) => r.values.tipo_parto ?? '',
      (x) => {
        const a = numOf(x.r.values.apgar5)
        return a === null ? null : a < 7
      },
    ),
    cross(
      { id: 'parto-lactancia', title: 'Tipo de parto y lactancia en la primera hora', hint: 'Porcentaje de RN que iniciaron lactancia en la primera hora según el tipo de parto.', outcome: 'Lactancia 1.ª hora' },
      items,
      (r) => r.values.tipo_parto ?? '',
      (x) => yn(x.r.values.lm_1h),
    ),
    cross(
      { id: 'parto-apego', title: 'Tipo de parto y apego', hint: 'Porcentaje de RN con apego inmediato según el tipo de parto.', outcome: 'Con apego' },
      items,
      (r) => r.values.tipo_parto ?? '',
      (x) => yn(x.r.values.apego),
    ),
  ]
  if (segment === 'todos') {
    crosses.push(
      cross(
        { id: 'parto-uci', title: 'Tipo de parto e ingreso a UCI', hint: 'Porcentaje de RN que se hospitalizaron según el tipo de parto.', outcome: 'Hospitalizados en UCI' },
        items,
        (r) => r.values.tipo_parto ?? '',
        (x) => x.seg === 'uci',
      ),
      cross(
        { id: 'edad-uci', title: 'Edad materna e ingreso a UCI', hint: 'Porcentaje de RN hospitalizados según la edad de la madre.', outcome: 'Hospitalizados en UCI' },
        items,
        (r) => ageBin(r.values.edad),
        (x) => x.seg === 'uci',
        AGE_ORDER,
      ),
    )
  }

  const count = (pred: (r: BookRecordOut) => boolean) => rows.filter(pred).length
  const v = (r: BookRecordOut, k: string) => r.values[k]
  const risks: RiskItem[] = [
    {
      label: 'Madre con ELISA VIH positivo',
      mothers: count((r) => v(r, 'elisa_res') === 'POSITIVO'),
      follow: 'RN con vacuna BCG aplicada (está contraindicada)',
      followN: count((r) => v(r, 'elisa_res') === 'POSITIVO' && v(r, 'bcg') === 'SI'),
      expect: 'ninguno',
    },
    {
      label: 'Madre con Hepatitis B positiva',
      mothers: count((r) => v(r, 'hb_res') === 'POSITIVO'),
      follow: 'RN con vacuna VHB',
      followN: count((r) => v(r, 'hb_res') === 'POSITIVO' && v(r, 'vhb') === 'SI'),
      expect: 'todos',
    },
    {
      label: 'Madre con SGB positivo',
      mothers: count((r) => v(r, 'sgb_res') === 'POSITIVO'),
      follow: 'Madres con profilaxis SGB',
      followN: count((r) => v(r, 'sgb_res') === 'POSITIVO' && v(r, 'prof_sgb') === 'SI'),
      expect: 'todos',
    },
    {
      label: 'Rotura prematura de membranas',
      mothers: count((r) => v(r, 'rpm') === 'SI'),
      follow: 'Madres con profilaxis de RPM',
      followN: count((r) => v(r, 'rpm') === 'SI' && v(r, 'profilaxis_rpm') === 'SI'),
      expect: 'todos',
    },
    {
      label: 'Madre con VDRL reactivo',
      mothers: count((r) => v(r, 'vdrl_res') === 'REACTIVO'),
      follow: 'RN hospitalizados en UCI',
      followN: items.filter((x) => x.r.values.vdrl_res === 'REACTIVO' && x.seg === 'uci').length,
      expect: 'todos',
    },
    {
      label: 'Madre con Chagas positivo',
      mothers: count((r) => v(r, 'chagas_res') === 'POSITIVO'),
      follow: 'RN con IC cardiología',
      followN: count((r) => v(r, 'chagas_res') === 'POSITIVO' && v(r, 'ic_cardiologia') === 'SI'),
      expect: 'todos',
    },
  ]

  return {
    n: items.length,
    complete,
    completePct: pct(complete, items.length),
    age: dist(rows.map((r) => ageBin(r.values.edad)), AGE_ORDER),
    bmi: dist(rows.map((r) => bmiBin(r.values.imc)), BMI_ORDER),
    parity: dist(rows.map((r) => r.values.paridad ?? '')),
    origin: topOrigins,
    indigenous: dist(rows.map((r) => r.values.pueblo_originario ?? ''), ['SI', 'NO']),
    prenatal: dist(rows.map((r) => r.values.control_prenatal ?? ''), ['SI', 'NO']),
    crosses,
    risks,
  }
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
    binomio: computeBinomio(fields, scope, segment),
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
