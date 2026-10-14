export const UNIT_EMAIL = 'neonatologia@clinicarenaca.cl'
export const PERSON_COOKIE = 'cuna_persona'
export const TZ = 'America/Santiago'
export const PERSON_SESSION_HOURS = 12
export const MAX_PIN_ATTEMPTS = 5
export const PIN_LOCK_MINUTES = 5
export const OVERDUE_HOURS = 48
export const DEFAULT_CONTACT_RETENTION_DAYS = 90

export type ScreeningKindDef = {
  key: string
  label: string
  help: string
  /** Grupo en que se muestra en la pestaña Tamizajes. */
  group: 'tamizaje' | 'inmunizacion'
  /** Permite registrar una primera y una segunda toma. */
  twoDates?: boolean
  /** Exige fecha y lote del producto administrado. */
  lot?: boolean
  /** Pide el resultado cuando está realizado. */
  result?: boolean
  /** Pide saturación pre y post ductal (números) cuando está realizado. */
  ductal?: boolean
}

export const SCREENING_KINDS: readonly ScreeningKindDef[] = [
  {
    key: 'METABOLICO',
    label: 'Screening metabólico',
    help: 'PKU y TSH (fenilcetonuria e hipotiroidismo congénito)',
    group: 'tamizaje',
    twoDates: true,
  },
  { key: 'PEA', label: 'Screening auditivo', help: 'Potenciales evocados auditivos (PEA)', group: 'tamizaje', result: true },
  {
    key: 'CARDIO',
    label: 'Screening cardiológico',
    help: 'Saturación pre y post ductal',
    group: 'tamizaje',
    ductal: true,
  },
  { key: 'VHB', label: 'Vacuna VHB', help: 'Hepatitis B', group: 'inmunizacion', lot: true },
  { key: 'BCG', label: 'Vacuna BCG', help: 'Tuberculosis', group: 'inmunizacion', lot: true },
  { key: 'Nirsevimab', label: 'Nirsevimab', help: 'Prevención de VRS', group: 'inmunizacion', lot: true },
]

export type ScreeningKind = string

/** Tamizajes que existieron antes de unificar el metabólico y mover el VIH al ingreso. */
const LEGACY_SCREENING_LABELS: Record<string, string> = {
  PKU: 'PKU',
  TSH: 'TSH',
  VIH: 'VIH',
}

export const screeningKindLabel = (key: string) =>
  SCREENING_KINDS.find((k) => k.key === key)?.label ?? LEGACY_SCREENING_LABELS[key] ?? key

export const SCREENING_STATUS = [
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'realizado', label: 'Realizado' },
  { key: 'citado', label: 'Citado' },
  { key: 'rechazado', label: 'Rechazado' },
  { key: 'no_aplica', label: 'No aplica' },
] as const

export const PEA_RESULTS = [
  { value: 'pasa', label: 'Pasa' },
  { value: 'refiere', label: 'Refiere' },
] as const

export const HIV_RESULTS = [
  { value: 'negativo', label: 'Negativo' },
  { value: 'positivo', label: 'Positivo' },
  { value: 'indeterminado', label: 'Indeterminado' },
] as const

/** El examen de VIH materno vale 1 mes y 5 días desde su fecha. */
export const HIV_VALID_MONTHS = 1
export const HIV_VALID_EXTRA_DAYS = 5

/** Documentos que debe tener el ingreso. La notificación GES usa su propio dato. */
export const ADMISSION_DOCUMENTS = [
  { key: 'docUrgencyLaw', label: 'Activación Ley de Urgencia' },
  { key: 'gesNotified', label: 'Notificación GES' },
  { key: 'docConsentAdmission', label: 'Consentimiento informado de ingreso' },
  { key: 'docConsentMila', label: 'Consentimiento Ley Mila' },
] as const

export type ScreeningStatus = (typeof SCREENING_STATUS)[number]['key']

export const CARE_LEVEL_OPTIONS = [
  { value: 'basico', label: 'Básico' },
  { value: 'uti', label: 'UTI' },
  { value: 'uci', label: 'UCI' },
] as const

export const SEX_OPTIONS = [
  { value: 'F', label: 'Mujer' },
  { value: 'M', label: 'Hombre' },
  { value: 'I', label: 'Indeterminado' },
]

export const DELIVERY_OPTIONS = [
  { value: 'vaginal', label: 'Vaginal' },
  { value: 'cesarea', label: 'Cesárea' },
  { value: 'instrumental', label: 'Instrumental' },
]

export const FEEDING_OPTIONS = [
  { value: 'exclusiva', label: 'Lactancia exclusiva' },
  { value: 'mixta', label: 'Lactancia mixta' },
  { value: 'formula', label: 'Fórmula' },
  { value: 'otra', label: 'Otra' },
]

export const CONTACT_REASONS = [
  { value: 'respaldo', label: 'Respaldo' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'olvido_documentos', label: 'Olvido de documentos' },
]

export const CATALOG_KINDS = [
  { key: 'prevision', label: 'Previsiones', singular: 'Previsión' },
  { key: 'procedimiento', label: 'Procedencias', singular: 'Procedencia' },
  { key: 'destino', label: 'Destinos', singular: 'Destino' },
  { key: 'profesional', label: 'Profesionales', singular: 'Profesional' },
] as const

export type CatalogKind = (typeof CATALOG_KINDS)[number]['key']
