import { addDaysYmd, todayYmd } from '@/lib/time'
import type { BoxStats, ChiResult, HistBin, KruskalResult, SpearmanResult, Summary } from '@/lib/stats'

// --- Configuración que el usuario define antes de generar el informe -----------

export type Basis = 'ingresos' | 'egresos' | 'activos'
export type Granularity = 'auto' | 'dia' | 'semana' | 'mes'

export const BASIS_OPTIONS: { value: Basis; label: string; help: string }[] = [
  { value: 'ingresos', label: 'Ingresos del período', help: 'RN que ingresaron a la unidad entre las fechas elegidas.' },
  { value: 'egresos', label: 'Egresos del período', help: 'RN dados de alta entre las fechas elegidas, sin importar cuándo ingresaron.' },
  { value: 'activos', label: 'Hospitalizados en el período', help: 'RN que estuvieron en la unidad algún momento del período (incluye estadías largas).' },
]

export const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'auto', label: 'Automática' },
  { value: 'dia', label: 'Por día' },
  { value: 'semana', label: 'Por semana' },
  { value: 'mes', label: 'Por mes' },
]

export const SECTIONS = [
  { key: 'flujo', label: 'Flujo y ocupación', help: 'Serie temporal de ingresos, egresos y RN hospitalizados.' },
  { key: 'estadia', label: 'Estadía', help: 'Histograma, boxplots y pruebas de comparación entre grupos.' },
  { key: 'perfil', label: 'Perfil neonatal', help: 'Edad gestacional, peso, APGAR, sexo, parto, previsión y diagnósticos.' },
  { key: 'contingencia', label: 'Tablas de contingencia', help: 'Cruces entre variables con prueba de asociación.' },
  { key: 'tamizajes', label: 'Tamizajes y vacunas', help: 'Estado de cada tamizaje y vacuna.' },
  { key: 'bilirrubina', label: 'Hiperbilirrubinemia', help: 'Frecuencia y tiempo hasta la fototerapia.' },
  { key: 'alta', label: 'Alta y destino', help: 'Destino, alimentación y variación de peso al alta.' },
  { key: 'turnos', label: 'Turnos y horarios', help: 'Mapa de calor por día de la semana y bloque horario.' },
  { key: 'atencion', label: 'Casos abiertos', help: 'Motivos y hospitalizaciones prolongadas aún abiertas.' },
  { key: 'calidad', label: 'Calidad del registro', help: 'Completitud de la ficha y oportunidad del registro.' },
] as const

export type SectionKey = (typeof SECTIONS)[number]['key']

export const KPI_OPTIONS = [
  { key: 'cohorte', label: 'RN analizados' },
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'egresos', label: 'Egresos' },
  { key: 'abiertos', label: 'Hospitalizados al cierre' },
  { key: 'censo', label: 'Censo diario promedio' },
  { key: 'diasCama', label: 'Días cama' },
  { key: 'estadiaMediana', label: 'Estadía mediana' },
  { key: 'estadiaP90', label: 'Estadía P90' },
  { key: 'estadiaMax', label: 'Estadía máxima' },
  { key: 'prematuros', label: '% prematuros (< 37 sem)' },
  { key: 'muyPrematuros', label: '% muy prematuros (< 32 sem)' },
  { key: 'bajoPeso', label: '% bajo peso (< 2.500 g)' },
  { key: 'muyBajoPeso', label: '% muy bajo peso (< 1.500 g)' },
  { key: 'apgarBajo', label: '% APGAR 5 min < 7' },
  { key: 'cesarea', label: '% cesárea' },
  { key: 'hiperbili', label: '% hiperbilirrubinemia' },
  { key: 'fototerapia', label: 'Mediana hasta fototerapia' },
  { key: 'lactancia', label: '% lactancia exclusiva al alta' },
  { key: 'reingreso', label: '% reingresos' },
  { key: 'tamizajes', label: '% tamizajes resueltos' },
  { key: 'oportunidad', label: 'Mediana hasta completar registro' },
  { key: 'mismoTurno', label: '% completado en el mismo turno' },
  { key: 'atencion', label: 'Casos abiertos' },
  { key: 'prolongadas', label: 'Hospitalizaciones > 30 días' },
] as const

export type KpiKey = (typeof KPI_OPTIONS)[number]['key']

export const DIMS = [
  { key: 'sexo', label: 'Sexo' },
  { key: 'parto', label: 'Tipo de parto' },
  { key: 'eg', label: 'Edad gestacional (grupo)' },
  { key: 'peso', label: 'Peso al nacer (grupo)' },
  { key: 'apgar5', label: 'APGAR a 5 min (grupo)' },
  { key: 'prevision', label: 'Previsión' },
  { key: 'procedimiento', label: 'Procedimiento' },
  { key: 'destino', label: 'Destino al alta' },
  { key: 'alimentacion', label: 'Alimentación al alta' },
  { key: 'hiperbili', label: 'Hiperbilirrubinemia' },
  { key: 'reingreso', label: 'Reingreso' },
  { key: 'turno', label: 'Turno de ingreso' },
  { key: 'estado', label: 'Estado de la ficha' },
] as const

export type DimKey = (typeof DIMS)[number]['key']

export const GA_GROUPS = [
  { value: 'extremo', label: 'Prematuro extremo (< 28 sem)' },
  { value: 'muy', label: 'Muy prematuro (28 a 31 sem)' },
  { value: 'moderado', label: 'Prematuro moderado a tardío (32 a 36 sem)' },
  { value: 'termino', label: 'De término (37 sem o más)' },
] as const

export const WEIGHT_GROUPS = [
  { value: 'eblw', label: 'Menos de 1.000 g' },
  { value: 'vlbw', label: '1.000 a 1.499 g' },
  { value: 'lbw', label: '1.500 a 2.499 g' },
  { value: 'nbw', label: '2.500 g o más' },
] as const

export type InsightFilters = {
  sex: string[]
  delivery: string[]
  gaGroup: string[]
  weightGroup: string[]
  previsionId: number[]
  procedimientoId: number[]
  destinoId: number[]
  status: string[]
  hyperbili: '' | 'si' | 'no'
  readmission: '' | 'si' | 'no'
  shift: '' | 'D' | 'N'
}

export type InsightConfig = {
  title: string
  subtitle: string
  notes: string
  from: string
  to: string
  basis: Basis
  granularity: Granularity
  sections: SectionKey[]
  kpis: KpiKey[]
  contingency: { row: DimKey; col: DimKey }
  filters: InsightFilters
}

export const emptyFilters = (): InsightFilters => ({
  sex: [],
  delivery: [],
  gaGroup: [],
  weightGroup: [],
  previsionId: [],
  procedimientoId: [],
  destinoId: [],
  status: [],
  hyperbili: '',
  readmission: '',
  shift: '',
})

export function defaultConfig(): InsightConfig {
  const to = todayYmd()
  return {
    title: 'Informe estadístico de la unidad',
    subtitle: 'Unidad de Neonatología',
    notes: '',
    from: addDaysYmd(to, -89),
    to,
    basis: 'ingresos',
    granularity: 'auto',
    sections: SECTIONS.map((s) => s.key),
    kpis: [
      'cohorte', 'ingresos', 'egresos', 'abiertos', 'censo', 'estadiaMediana', 'estadiaP90',
      'prematuros', 'bajoPeso', 'hiperbili', 'lactancia', 'tamizajes', 'atencion', 'prolongadas',
    ],
    contingency: { row: 'eg', col: 'parto' },
    filters: emptyFilters(),
  }
}

export const MAX_RANGE_DAYS = 1830

// --- Informe generado --------------------------------------------------------

export type Kpi = { key: KpiKey; label: string; value: string; sub?: string }

export type Hist = {
  title: string
  unit: string
  n: number
  bins: HistBin[]
  summary: Summary | null
}

export type Box = { label: string; stats: BoxStats | null }

export type Bar = { label: string; n: number; pct: number | null }

export type StackedBar = {
  label: string
  parts: { key: string; label: string; n: number }[]
  total: number
}

export type ContingencyTable = {
  title: string
  rowLabel: string
  colLabel: string
  rows: string[]
  cols: string[]
  cells: number[][]
  n: number
  excluded: number
  test: ChiResult | null
}

export type SeriesPoint = {
  key: string
  label: string
  from: string
  ingresos: number
  egresos: number
  abiertos: number
}

export type Heat = {
  title: string
  rows: string[]
  cols: string[]
  cells: number[][]
  max: number
}

export type AttentionCase = {
  id: string
  code: string
  days: number
  gaWeeks: number | null
  weightG: number | null
  reasons: string[]
}

export type GroupSummaryRow = { label: string; summary: Summary | null }

export type InsightReport = {
  generatedAt: string
  generatedBy: string
  config: InsightConfig
  period: { from: string; to: string; days: number }
  basisLabel: string
  cohort: { n: number; beforeFilters: number }
  filterNotes: string[]
  headline: string[]
  kpis: Kpi[]
  flow?: { granularity: Exclude<Granularity, 'auto'>; points: SeriesPoint[] }
  los?: {
    summary: Summary | null
    openCount: number
    hist: Hist
    byGa: Box[]
    byWeight: Box[]
    byDelivery: Box[]
    groupTable: GroupSummaryRow[]
    kruskalGa: KruskalResult | null
    kruskalWeight: KruskalResult | null
    spearmanGa: SpearmanResult | null
    spearmanWeight: SpearmanResult | null
  }
  profile?: {
    gaHist: Hist
    weightHist: Hist
    apgar5: Bar[]
    sex: Bar[]
    delivery: Bar[]
    gaGroups: Bar[]
    weightGroups: Bar[]
    prevision: Bar[]
    procedimiento: Bar[]
    dxIngreso: Bar[]
  }
  contingency?: ContingencyTable[]
  screening?: { overallPct: number | null; byKind: StackedBar[] }
  bili?: {
    known: number
    withBili: number
    pct: number | null
    ci: [number, number] | null
    phototherapyN: number
    hist: Hist
    byGa: Bar[]
  }
  discharge?: {
    n: number
    destino: Bar[]
    feeding: Bar[]
    dxEgreso: Bar[]
    weightChange: Hist
  }
  shifts?: {
    ingresosByShift: Bar[]
    egresosByShift: Bar[]
    heatIngresos: Heat
    heatEgresos: Heat
  }
  attention?: {
    open: number
    reasons: Bar[]
    stayBands: Bar[]
    longest: AttentionCase[]
  }
  quality?: {
    completeness: Bar[]
    lagHist: Hist
    lagByShift: Box[]
    sameShiftPct: number | null
  }
}

/** Fila anonimizada para la hoja de datos del Excel. */
export type DataRow = Record<string, string | number | null>
