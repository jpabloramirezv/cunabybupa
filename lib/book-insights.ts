import type { Bar, Box, ContingencyTable, Heat, Hist } from '@/lib/insights'
import type { KruskalResult, Summary } from '@/lib/stats'

export type LibroScope = 'todos' | 'nacimientos' | 'nursery' | 'uci' | 'aborto'
export type LibroBasis = 'registro' | 'alta'
export type LibroGranularity = 'auto' | 'dia' | 'semana' | 'mes'

export const LIBRO_SCOPES: { value: LibroScope; label: string; hint: string }[] = [
  { value: 'todos', label: 'Todo el Libro', hint: 'Nacimientos y abortos' },
  { value: 'nacimientos', label: 'Solo nacimientos', hint: 'Nursery y UCI, sin abortos' },
  { value: 'nursery', label: 'Nursery', hint: 'Recién nacidos con estadía normal' },
  { value: 'uci', label: 'UCI Neonatal', hint: 'Recién nacidos hospitalizados' },
  { value: 'aborto', label: 'Abortos', hint: 'Solo datos maternos' },
]

export const LIBRO_BASIS: { value: LibroBasis; label: string; hint: string }[] = [
  { value: 'registro', label: 'Fecha del parto', hint: 'Eventos ocurridos en el período' },
  { value: 'alta', label: 'Fecha de alta del RN', hint: 'Recién nacidos dados de alta en el período' },
]

export const LIBRO_GRANULARITY: { value: LibroGranularity; label: string }[] = [
  { value: 'auto', label: 'Automática' },
  { value: 'dia', label: 'Diaria' },
  { value: 'semana', label: 'Semanal' },
  { value: 'mes', label: 'Mensual' },
]

export type LibroKpiKey =
  | 'registros'
  | 'partos'
  | 'abortos'
  | 'nursery'
  | 'uci'
  | 'uciPct'
  | 'promedioDia'
  | 'cesarea'
  | 'cesareaUrgencia'
  | 'vaginal'
  | 'instrumental'
  | 'induccion'
  | 'rpm'
  | 'primigesta'
  | 'edadMediana'
  | 'madre35'
  | 'madreAdolescente'
  | 'obesidad'
  | 'controlPrenatal'
  | 'prematuros'
  | 'bajoPeso'
  | 'macrosomia'
  | 'apgarBajo'
  | 'apego'
  | 'lactancia1h'
  | 'malformacion'
  | 'altas'
  | 'estadia'
  | 'lactanciaExclusiva'
  | 'vhb'
  | 'tamizaje'
  | 'completitud'

export const LIBRO_KPIS: { key: LibroKpiKey; label: string; group: string }[] = [
  { key: 'registros', label: 'Registros analizados', group: 'Actividad' },
  { key: 'partos', label: 'Nacimientos', group: 'Actividad' },
  { key: 'abortos', label: 'Abortos', group: 'Actividad' },
  { key: 'nursery', label: 'RN en Nursery', group: 'Actividad' },
  { key: 'uci', label: 'RN en UCI Neonatal', group: 'Actividad' },
  { key: 'uciPct', label: '% de RN en UCI', group: 'Actividad' },
  { key: 'promedioDia', label: 'Nacimientos por día', group: 'Actividad' },
  { key: 'cesarea', label: 'Tasa de cesárea', group: 'Parto' },
  { key: 'cesareaUrgencia', label: 'Cesárea de urgencia', group: 'Parto' },
  { key: 'vaginal', label: 'Parto vaginal', group: 'Parto' },
  { key: 'instrumental', label: 'Parto instrumental', group: 'Parto' },
  { key: 'induccion', label: 'Inducción del trabajo de parto', group: 'Parto' },
  { key: 'rpm', label: 'Rotura prematura de membranas', group: 'Parto' },
  { key: 'primigesta', label: 'Primigestas', group: 'Madre' },
  { key: 'edadMediana', label: 'Edad materna (mediana)', group: 'Madre' },
  { key: 'madre35', label: 'Madres de 35 años o más', group: 'Madre' },
  { key: 'madreAdolescente', label: 'Madres menores de 20 años', group: 'Madre' },
  { key: 'obesidad', label: 'Madres con obesidad (IMC ≥ 30)', group: 'Madre' },
  { key: 'controlPrenatal', label: 'Con control prenatal', group: 'Madre' },
  { key: 'prematuros', label: 'Prematuros (< 37 sem)', group: 'Recién nacido' },
  { key: 'bajoPeso', label: 'Bajo peso al nacer (< 2.500 g)', group: 'Recién nacido' },
  { key: 'macrosomia', label: 'Peso de 4.000 g o más', group: 'Recién nacido' },
  { key: 'apgarBajo', label: "Apgar a los 5' menor de 7", group: 'Recién nacido' },
  { key: 'apego', label: 'Apego inmediato', group: 'Recién nacido' },
  { key: 'lactancia1h', label: 'Lactancia en la primera hora', group: 'Recién nacido' },
  { key: 'malformacion', label: 'Malformación congénita', group: 'Recién nacido' },
  { key: 'altas', label: 'Altas de recién nacidos', group: 'Alta y tamizajes' },
  { key: 'estadia', label: 'Estadía mediana (días)', group: 'Alta y tamizajes' },
  { key: 'lactanciaExclusiva', label: 'Lactancia exclusiva al alta', group: 'Alta y tamizajes' },
  { key: 'vhb', label: 'Vacuna VHB', group: 'Alta y tamizajes' },
  { key: 'tamizaje', label: 'TSH / PKU realizado', group: 'Alta y tamizajes' },
  { key: 'completitud', label: 'Registros completos', group: 'Calidad' },
]

export const DEFAULT_LIBRO_KPIS: LibroKpiKey[] = [
  'registros',
  'partos',
  'abortos',
  'uciPct',
  'cesarea',
  'induccion',
  'prematuros',
  'bajoPeso',
  'apgarBajo',
  'lactancia1h',
  'estadia',
  'completitud',
]

export type LibroSectionKey =
  | 'flujo'
  | 'materno'
  | 'parto'
  | 'rn'
  | 'contingencia'
  | 'examenes'
  | 'alta'
  | 'turnos'
  | 'calidad'
  | 'columnas'

export const LIBRO_SECTIONS: { key: LibroSectionKey; label: string; hint: string }[] = [
  { key: 'flujo', label: 'Actividad en el tiempo', hint: 'Nacimientos y abortos por día, semana o mes, y por día de la semana.' },
  { key: 'materno', label: 'Perfil materno', hint: 'Edad, IMC, paridad, origen, control prenatal y previsión.' },
  { key: 'parto', label: 'Parto y vía de nacimiento', hint: 'Tipo de parto, Robson, causas de cesárea, inducción y RPM.' },
  { key: 'rn', label: 'Recién nacido', hint: 'Edad gestacional, peso, Apgar, apego, lactancia y malformaciones.' },
  { key: 'contingencia', label: 'Asociaciones entre variables', hint: 'Tablas cruzadas con prueba de chi-cuadrado y V de Cramér.' },
  { key: 'examenes', label: 'Exámenes, profilaxis y tamizajes', hint: 'Positividad materna y cobertura de profilaxis, vacunas y tamizajes.' },
  { key: 'alta', label: 'Alta y estadía', hint: 'Alimentación al alta, hospitalización y días de estadía.' },
  { key: 'turnos', label: 'Carga por día y franja horaria', hint: 'Mapa de calor de partos según día de la semana y hora.' },
  { key: 'calidad', label: 'Calidad del registro', hint: 'Completitud de Maternidad y Neonatología, y columnas con más vacíos.' },
  { key: 'columnas', label: 'Columnas elegidas', hint: 'Detalle de las columnas que selecciones, con comparación por una variable.' },
]

export const DEFAULT_LIBRO_SECTIONS: LibroSectionKey[] = [
  'flujo',
  'materno',
  'parto',
  'rn',
  'contingencia',
  'examenes',
  'alta',
  'turnos',
  'calidad',
]

export type LibroFilter = { key: string; values: string[] }

export type LibroConfig = {
  title: string
  subtitle: string
  notes: string
  from: string
  to: string
  scope: LibroScope
  basis: LibroBasis
  granularity: LibroGranularity
  kpis: LibroKpiKey[]
  sections: LibroSectionKey[]
  filters: LibroFilter[]
  columns: string[]
  by: string
  cross: { row: string; col: string } | null
}

export type LibroKpi = { key: LibroKpiKey; label: string; value: string; sub?: string }

export type LibroRate = { label: string; n: number; total: number; pct: number | null; ci: [number, number] | null; note?: string }

export type LibroCatalogField = { key: string; label: string; group: string; section: string; kind: 'categoria' | 'numero' | 'fecha' | 'hora' }

export type LibroColumnBlock = {
  key: string
  label: string
  section: string
  kind: 'categoria' | 'numero' | 'fecha' | 'hora'
  answered: number
  dist: Bar[]
  summary: Summary | null
  hist: Hist | null
  cross: ContingencyTable | null
  boxes: Box[] | null
  kruskal: KruskalResult | null
}

export type LibroReport = {
  meta: {
    title: string
    subtitle: string
    notes: string
    generatedAt: string
    generatedBy: string
    from: string
    to: string
    days: number
    scope: LibroScope
    scopeLabel: string
    basis: LibroBasis
    basisLabel: string
  }
  cohort: { n: number; beforeFilters: number; filters: { label: string; values: string[] }[] }
  highlights: string[]
  kpis: LibroKpi[]
  catalog: LibroCatalogField[]
  flow?: {
    granularity: 'dia' | 'semana' | 'mes'
    points: { key: string; label: string; nursery: number; uci: number; abortos: number; total: number }[]
    weekday: Bar[]
  }
  maternal?: {
    age: Hist
    ageBins: Bar[]
    bmi: Bar[]
    parity: Bar[]
    origin: Bar[]
    indigenous: Bar[]
    prenatal: Bar[]
    prevision: Bar[]
    procedencia: Bar[]
  }
  delivery?: {
    type: Bar[]
    robson: Bar[]
    cesareanCause: Bar[]
    induction: Bar[]
    rpm: Bar[]
    placenta: Bar[]
    cesareaByAge: Bar[]
    cesareaByParity: Bar[]
    cesareaByPrevision: Bar[]
  }
  newborn?: {
    ga: Hist
    weight: Hist
    gaBins: Bar[]
    weightBins: Bar[]
    sex: Bar[]
    apgar1: Bar[]
    apgar5: Bar[]
    apego: Bar[]
    lactancia1h: Bar[]
    malformacion: Bar[]
    weightByType: Box[]
    gaByType: Box[]
    weightTest: KruskalResult | null
  }
  contingency?: ContingencyTable[]
  exams?: { maternal: LibroRate[]; coverage: LibroRate[] }
  discharge?: {
    feeding: Bar[]
    segment: Bar[]
    stay: Hist
    stayBySegment: Box[]
    stayByType: Box[]
    stayTest: KruskalResult | null
  }
  shifts?: { heat: Heat; band: Bar[] }
  quality?: {
    sections: LibroRate[]
    lowest: { label: string; section: string; answered: number; total: number; pct: number }[]
  }
  columns?: LibroColumnBlock[]
}
