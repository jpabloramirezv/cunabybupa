/** Definición única de los indicadores y alertas del Panel. La tabla, las metas y los filtros del Libro salen de aquí. */

export type PanelPeriod = 'hoy' | '7' | '30' | 'mes' | '365'

export const PERIOD_OPTIONS: { value: PanelPeriod; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: 'mes', label: 'Mes en curso' },
  { value: '365', label: '12 meses' },
]

export const parsePanelPeriod = (v: string | null): PanelPeriod =>
  v === 'hoy' || v === '7' || v === 'mes' || v === '365' ? v : '30'

/** Bajo este tamaño de muestra no se muestra porcentaje: no permite concluir. */
export const MIN_N = 5

export type Direction = 'mayor' | 'menor'
export type IndicatorGroup = 'parto' | 'rn' | 'prevencion' | 'tamizajes' | 'hospitalizacion' | 'registro'
export type IndicatorUnit = 'pct' | 'h'

export type Indicator = {
  id: string
  label: string
  group: IndicatorGroup
  source: 'Libro' | 'Pizarra' | 'Libro y Pizarra'
  /** Hacia dónde es mejor. Jefatura puede cambiarlo junto con la meta. */
  direction: Direction
  unit: IndicatorUnit
  /** Solo se calcula para estos alcances. */
  scopes: ('uci' | 'nursery' | 'todos')[]
  help: string
}

export const GROUP_LABEL: Record<IndicatorGroup, string> = {
  parto: 'Atención del parto',
  rn: 'Atención inmediata del recién nacido',
  prevencion: 'Prevención',
  tamizajes: 'Tamizajes al alta',
  hospitalizacion: 'Hospitalización en UPC',
  registro: 'Calidad del registro',
}

const ALL: Indicator['scopes'] = ['uci', 'nursery', 'todos']
const UPC: Indicator['scopes'] = ['uci', 'todos']

export const INDICATORS: Indicator[] = [
  { id: 'cesarea', label: 'Tasa de cesárea', group: 'parto', source: 'Libro', direction: 'menor', unit: 'pct', scopes: ALL, help: 'Partos por cesárea sobre los partos con tipo de parto registrado.' },
  { id: 'induccion', label: 'Inducción del trabajo de parto', group: 'parto', source: 'Libro', direction: 'menor', unit: 'pct', scopes: ALL, help: 'Partos con inducción sobre los que tienen Inducción respondida (Sí o No).' },
  { id: 'control_prenatal', label: 'Madres con control prenatal', group: 'parto', source: 'Libro', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'Madres con control prenatal sobre las que tienen la pregunta respondida.' },
  { id: 'apego', label: 'Apego inmediato', group: 'rn', source: 'Libro', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'RN con apego inmediato sobre los que tienen Apego respondido.' },
  { id: 'lm_1h', label: 'Lactancia en la primera hora', group: 'rn', source: 'Libro', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'RN que iniciaron lactancia en la primera hora sobre los que tienen la pregunta respondida.' },
  { id: 'apgar5_bajo', label: "Apgar a los 5' menor de 7", group: 'rn', source: 'Libro', direction: 'menor', unit: 'pct', scopes: ALL, help: "RN con Apgar a los 5 minutos menor de 7 sobre los que tienen Apgar a los 5' registrado." },
  { id: 'malformacion', label: 'Malformación congénita', group: 'rn', source: 'Libro', direction: 'menor', unit: 'pct', scopes: ALL, help: 'RN con malformación congénita sobre los que tienen la pregunta respondida.' },
  { id: 'vhb', label: 'Vacuna VHB aplicada', group: 'prevencion', source: 'Libro', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'RN con vacuna VHB sobre los que tienen la pregunta respondida.' },
  { id: 'bcg', label: 'Vacuna BCG aplicada', group: 'prevencion', source: 'Libro', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'RN con BCG sobre los que tienen la pregunta respondida.' },
  { id: 'nirsevimab', label: 'Nirsevimab aplicado', group: 'prevencion', source: 'Libro', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'RN con Nirsevimab sobre los que tienen la pregunta respondida.' },
  { id: 'prof_sgb', label: 'Profilaxis SGB completa (madres SGB+)', group: 'prevencion', source: 'Libro', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'Madres con SGB positivo y profilaxis Completa sobre todas las madres con SGB positivo.' },
  { id: 'prof_rpm', label: 'Profilaxis RPM completa (madres con RPM)', group: 'prevencion', source: 'Libro', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'Madres con RPM y profilaxis Completa sobre todas las madres con RPM.' },
  { id: 'tamiz_metabolico', label: 'Tamizaje metabólico (TSH / PKU)', group: 'tamizajes', source: 'Libro y Pizarra', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'UPC se mide en la Pizarra (realizado o rechazado, sin los que no aplican). Nursery se mide en el Libro. En Todos se suman ambos sin repetir RN.' },
  { id: 'tamiz_auditivo', label: 'Tamizaje auditivo (PEA / PEAT)', group: 'tamizajes', source: 'Libro y Pizarra', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'UPC se mide en la Pizarra. Nursery se mide en el Libro (PEAT). En Todos se suman ambos sin repetir RN.' },
  { id: 'tamiz_cardio', label: 'Tamizaje cardiológico', group: 'tamizajes', source: 'Libro y Pizarra', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'UPC se mide en la Pizarra (saturación pre y post ductal). Nursery se mide en el Libro (IC cardiología). En Todos se suman ambos.' },
  { id: 'reingreso', label: 'Reingresos a UPC', group: 'hospitalizacion', source: 'Pizarra', direction: 'menor', unit: 'pct', scopes: UPC, help: 'RN dados de alta en el período que tuvieron un reingreso, sobre las altas del período.' },
  { id: 'lme_alta', label: 'Lactancia materna exclusiva al alta', group: 'hospitalizacion', source: 'Pizarra', direction: 'mayor', unit: 'pct', scopes: UPC, help: 'Altas con alimentación exclusiva sobre las altas con alimentación registrada.' },
  { id: 'foto_mediana', label: 'Horas hasta fototerapia (mediana)', group: 'hospitalizacion', source: 'Pizarra', direction: 'menor', unit: 'h', scopes: UPC, help: 'Mediana de horas entre el nacimiento y el inicio de fototerapia, en RN con hiperbilirrubinemia.' },
  { id: 'foto_p90', label: 'Horas hasta fototerapia (P90)', group: 'hospitalizacion', source: 'Pizarra', direction: 'menor', unit: 'h', scopes: UPC, help: 'El 90 % de los RN inició fototerapia antes de este tiempo.' },
  { id: 'binomio_completo', label: 'Registros con madre y RN completos', group: 'registro', source: 'Libro', direction: 'mayor', unit: 'pct', scopes: ALL, help: 'Filas del Libro con Maternidad y Neonatología completas sobre las filas del período.' },
  { id: 'registro_turno', label: 'Fichas UPC completadas en el mismo turno', group: 'registro', source: 'Pizarra', direction: 'mayor', unit: 'pct', scopes: UPC, help: 'Ingresos de la Pizarra cuya ficha se completó en el mismo turno en que se creó.' },
  { id: 'registro_horas', label: 'Horas hasta completar la ficha UPC (mediana)', group: 'registro', source: 'Pizarra', direction: 'menor', unit: 'h', scopes: UPC, help: 'Mediana de horas entre la creación de la ficha y su completitud.' },
]

export const INDICATOR_BY_ID = new Map(INDICATORS.map((i) => [i.id, i]))

export type Target = { value: number; direction: Direction }
export type Targets = Record<string, Target>

export type IndicatorValue = {
  /** Casos que cumplen (null en indicadores en horas). */
  num: number | null
  /** Casos evaluables (o tamaño de muestra en horas). */
  den: number
  value: number | null
}

export type TargetStatus = 'cumple' | 'fuera' | null

/** Sin meta, sin muestra suficiente o sin dato, no hay estado: el color solo existe cuando significa algo. */
export function statusOf(value: number | null, den: number, target: Target | undefined): TargetStatus {
  if (!target || value === null || den < MIN_N) return null
  const ok = target.direction === 'mayor' ? value >= target.value : value <= target.value
  return ok ? 'cumple' : 'fuera'
}

export function parseTargets(raw: string | null | undefined): Targets {
  if (!raw) return {}
  try {
    const data = JSON.parse(raw) as Record<string, { value?: unknown; direction?: unknown }>
    const out: Targets = {}
    for (const [id, t] of Object.entries(data)) {
      const value = Number(t?.value)
      if (!INDICATOR_BY_ID.has(id) || !Number.isFinite(value) || value < 0) continue
      out[id] = { value, direction: t.direction === 'menor' ? 'menor' : 'mayor' }
    }
    return out
  } catch {
    return {}
  }
}

/* ----------------------------- Alertas clínicas ---------------------------- */

export type AlertId =
  | 'sgb-sin-profilaxis'
  | 'rpm-sin-profilaxis'
  | 'vih-con-bcg'
  | 'vhb-sin-vacuna'
  | 'chagas-sin-cardiologia'
  | 'vdrl-reactivo'
  | 'incompleto-24h'

type Values = Record<string, string>
export type AlertContext = {
  values: Values
  isAbortion: boolean
  createdAt?: string
  matDone?: boolean
  neoDone?: boolean
}

export type AlertDef = {
  id: AlertId
  label: string
  detail: string
  severity: 'alta' | 'media' | 'info'
  match: (c: AlertContext) => boolean
}

const hours24 = 24 * 3600_000

export const ALERTS: AlertDef[] = [
  {
    id: 'sgb-sin-profilaxis',
    label: 'Madres SGB positivo sin profilaxis completa',
    detail: 'Profilaxis Incompleta, Sin profilaxis o no registrada.',
    severity: 'alta',
    match: (c) => c.values.sgb_res === 'POSITIVO' && c.values.prof_sgb !== 'COMPLETA',
  },
  {
    id: 'rpm-sin-profilaxis',
    label: 'Madres con RPM sin profilaxis completa',
    detail: 'Profilaxis Incompleta, Sin profilaxis o no registrada.',
    severity: 'media',
    match: (c) => c.values.rpm === 'SI' && c.values.profilaxis_rpm !== 'COMPLETA',
  },
  {
    id: 'vih-con-bcg',
    label: 'Madre VIH positiva con RN que recibió BCG',
    detail: 'La BCG no debería aplicarse. Verificar el registro.',
    severity: 'alta',
    match: (c) => !c.isAbortion && c.values.elisa_res === 'POSITIVO' && c.values.bcg === 'SI',
  },
  {
    id: 'vhb-sin-vacuna',
    label: 'Madre Hepatitis B positiva con RN sin vacuna VHB',
    detail: 'Vacuna VHB en No o sin registrar.',
    severity: 'alta',
    match: (c) => !c.isAbortion && c.values.hb_res === 'POSITIVO' && c.values.vhb !== 'SI',
  },
  {
    id: 'chagas-sin-cardiologia',
    label: 'Madre Chagas positivo con RN sin IC a cardiología',
    detail: 'Interconsulta en No o sin registrar.',
    severity: 'media',
    match: (c) => !c.isAbortion && c.values.chagas_res === 'POSITIVO' && c.values.ic_cardiologia !== 'SI',
  },
  {
    id: 'vdrl-reactivo',
    label: 'Madre con VDRL reactivo: verificar estudio del RN',
    detail: 'Solo para revisar. No todo RN requiere hospitalización.',
    severity: 'info',
    match: (c) => !c.isAbortion && c.values.vdrl_res === 'REACTIVO',
  },
  {
    id: 'incompleto-24h',
    label: 'Registros incompletos por más de 24 horas',
    detail: 'Maternidad o Neonatología sin completar, creados hace más de un día.',
    severity: 'media',
    match: (c) =>
      !!c.createdAt &&
      Date.now() - new Date(c.createdAt).getTime() > hours24 &&
      (c.matDone === false || (!c.isAbortion && c.neoDone === false)),
  },
]

export const ALERT_BY_ID = new Map(ALERTS.map((a) => [a.id, a]))

export type DashScope = 'uci' | 'nursery' | 'todos'

/** Un registro pertenece al alcance: UPC y Nursery miran solo recién nacidos; Todos incluye abortos. */
export const inScope = (seg: 'nursery' | 'uci' | 'aborto', scope: DashScope) =>
  scope === 'todos' ? true : seg === scope
