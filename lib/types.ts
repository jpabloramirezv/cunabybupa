import type { EpisodeCore, EpisodeStatus, Role } from '@/lib/rules'

export type BlockInfo = { block: string; staffName: string; updatedAt: string }

export type ScreeningRow = {
  kind: string
  status: string
  doneAt: string | null
  /** Segunda toma (tamizaje metabólico). */
  doneAt2: string | null
  citedAt: string | null
  lot: string | null
  result: string | null
  /** Screening cardiológico: saturación pre y post ductal (%). */
  preDuctal: number | null
  postDuctal: number | null
  updatedByName: string | null
  updatedAt: string | null
}

export type EpisodeDetail = EpisodeCore & {
  id: string
  seq: number
  code: string
  status: EpisodeStatus
  /** uci = hospitalizado en la unidad; nursery = estadía normal (no pasa por la Pizarra). */
  unit: 'uci' | 'nursery'
  readmissionOf: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  createdShift: string | null
  completedShift: string | null
  hasAdmission: boolean
  missing: string[]
  altaMissing: string[]
  altaStarted: boolean
  warnings: string[]
  blocks: BlockInfo[]
  screenings: ScreeningRow[]
  pendingKinds: string[]
  overdueKinds: string[]
  /** Datos que faltan dentro de tamizajes e inmunizaciones y el VIH materno. */
  screeningIssues: string[]
  /** Documentos de ingreso que faltan (aviso, no cambia el estado). */
  docsMissing: string[]
  /** Solo llega a los roles con permiso de identidad; permite buscar por nombre, RUT o madre. */
  identity?: ListIdentity
}

export type ListIdentity = {
  patientName: string | null
  rut: string | null
  admissionNumber: string | null
  motherName: string | null
  motherPhone: string | null
}

export type DiagnosisItem = {
  id: number
  code: string
  name: string
  synonyms: string[]
  active: boolean
}

export type CatalogEntry = {
  id: number
  kind: string
  label: string
  active: boolean
  staffId?: number | null
  specialty?: string | null
}

export type Defaults = {
  previsionId: number | null
  procedimientoId: number | null
  medicoId: number | null
}

export type CatalogsPayload = {
  diagnoses: DiagnosisItem[]
  items: CatalogEntry[]
  defaults: Defaults
  contactRetentionDays: number
}

export type MePayload = {
  staffId: number
  name: string
  role: Role
  isAdmin: boolean
  canWrite: boolean
  canIdentity: boolean
  canPanel: boolean
  canReports: boolean
  canAdmin: boolean
  canClinical: boolean
  unit: 'neonatologia' | 'maternidad'
  canBook: boolean
  canEditMaternity: boolean
  canEditNeonatal: boolean
}

export type IdentityPayload = {
  patientName: string | null
  rut: string | null
  admissionNumber: string | null
  motherName: string | null
  motherPhone: string | null
  contactReason: string | null
  contactConsent: boolean
  contactDeleteAt: string | null
}

export type ShiftEvent = {
  episodeId: string
  code: string
  kind: 'ingreso' | 'egreso' | 'edicion'
  at: string
  staffId: number | null
  staffName: string | null
  patientName?: string | null
  unit?: 'uci' | 'nursery'
}

export type ShiftHistoryEntry = {
  key: string
  kind: 'D' | 'N'
  label: string
  ymd: string
  start: string
  end: string
  isCurrent: boolean
  ingresos: number
  egresos: number
  ediciones: number
  people: { staffId: number; name: string; ingresos: number; egresos: number; ediciones: number }[]
  closures: { staffId: number; staffName: string; closedAt: string; episodeCount: number; pendingCount: number }[]
  events: ShiftEvent[]
}

export type ShiftHistoryPayload = {
  me: { staffId: number; name: string }
  mine: boolean
  days: number
  range?: { from: string; to: string } | null
  shifts: ShiftHistoryEntry[]
}

export type ShiftUnitFilter = 'uci' | 'nursery' | 'todos'

export type ShiftBalanceUnit = {
  /** Recién nacidos en la unidad al comenzar el turno. */
  censoInicio: number
  ingresos: number
  egresos: number
  /** censoInicio + ingresos - egresos: recién nacidos en la unidad al terminar el turno. */
  censoFin: number
}

/** Balance del turno: movimiento de recién nacidos y registros del Libro. */
export type ShiftBalance = {
  unit: ShiftUnitFilter
  total: ShiftBalanceUnit
  byUnit: { uci: ShiftBalanceUnit; nursery: ShiftBalanceUnit }
  /** Recién nacidos que están hoy en la unidad (sin egreso confirmado), sin importar el turno que se mira. */
  censoActual: { uci: number; nursery: number; total: number }
  /** Registros del Libro de Partos y Abortos creados y editados durante el turno. */
  libro: { creados: number; editados: number }
}

export type ShiftPayload = {
  shift: {
    key: string
    label: string
    start: string
    end: string
    prevKey: string
    nextKey: string | null
    isCurrent: boolean
  }
  episodes: EpisodeDetail[]
  closures: {
    staffName: string
    closedAt: string
    episodeCount: number
    pendingCount: number
  }[]
  balance?: ShiftBalance
}

export type Stat = { label: string; n: number; median: number | null; p90: number | null }

export type PanelPayload = {
  period: { from: string; to: string }
  totals: { admitted: number; discharged: number; open: number }
  los: { overall: Stat; byGa: Stat[]; byWeight: Stat[] }
  weightDist: { key: string; label: string; n: number; pct: number }[]
  screening: {
    n: number
    overallPct: number | null
    byKind: { kind: string; label: string; done: number; refused: number; total: number; pct: number | null }[]
  }
  bili: {
    n: number
    withBili: number
    pct: number | null
    phototherapyN: number
    medianHours: number | null
    p90Hours: number | null
  }
  feeding: { n: number; exclusive: number; pct: number | null }
  readmission: { n: number; readmitted: number; pct: number | null }
  timeliness: {
    n: number
    medianHours: number | null
    p90Hours: number | null
    sameShiftPct: number | null
  }
}
