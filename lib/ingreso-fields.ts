/**
 * Preguntas fijas del Ingreso (UPC y Nursery comparten la misma ficha). Jefatura puede renombrarlas,
 * agregarles un texto de ayuda y ocultar las que no son clínicamente indispensables, pero no cambiar su tipo:
 * otras partes del sistema (reglas de alerta, estado del registro, libro) las leen por su clave.
 */
export type IngresoField = {
  key: string
  /** Nombre original en el formulario. */
  label: string
  group: string
  /** Tipo de respuesta, solo para mostrarlo en Administración. */
  kind: string
  /** Columna de la tabla de Neonatología que muestra este dato, si existe. */
  tableId?: string
  /** Nombre original de la columna en la tabla. */
  tableLabel?: string
  /** No se puede ocultar: sin este dato el registro no tiene sentido clínico. */
  core?: boolean
}

export const INGRESO_GROUPS = [
  { name: 'Datos del nacimiento', note: 'Se piden siempre, en UPC y en Nursery.' },
  { name: 'Antropometría', note: 'Se piden siempre, en UPC y en Nursery.' },
  { name: 'APGAR', note: 'Si el Apgar ya viene del Libro de Partos, no se vuelve a preguntar.' },
  {
    name: 'Admisión',
    note: 'En Nursery solo aparece si el recién nacido se hospitalizó. Las listas (previsión, procedencia, diagnósticos, médicos) son las mismas para UPC y Nursery.',
  },
  { name: 'Documentos de ingreso', note: 'En Nursery solo aparecen si el recién nacido se hospitalizó.' },
] as const

export const INGRESO_FIELDS: IngresoField[] = [
  { key: 'birthAt', label: 'Fecha y hora de nacimiento', group: 'Datos del nacimiento', kind: 'Fecha y hora', tableId: 'birth', tableLabel: 'Fecha y hora', core: true },
  { key: 'gaWeeks', label: 'Edad gestacional', group: 'Datos del nacimiento', kind: 'Número (semanas)', tableId: 'ga', tableLabel: 'EG', core: true },
  { key: 'sex', label: 'Sexo', group: 'Datos del nacimiento', kind: 'Opciones', tableId: 'sex', tableLabel: 'Sexo', core: true },
  { key: 'deliveryType', label: 'Tipo de parto', group: 'Datos del nacimiento', kind: 'Opciones', tableId: 'delivery', tableLabel: 'Parto', core: true },

  { key: 'birthWeightG', label: 'Peso', group: 'Antropometría', kind: 'Número (g)', tableId: 'weight', tableLabel: 'Peso (g)', core: true },
  { key: 'birthLengthCm', label: 'Talla', group: 'Antropometría', kind: 'Decimal (cm)' },
  { key: 'birthHeadCm', label: 'Circunferencia de cráneo', group: 'Antropometría', kind: 'Decimal (cm)' },

  { key: 'apgar1', label: 'APGAR al minuto', group: 'APGAR', kind: 'Puntaje 0 a 10', core: true },
  { key: 'apgar5', label: 'APGAR a los 5 minutos', group: 'APGAR', kind: 'Puntaje 0 a 10', tableId: 'apgar', tableLabel: 'APGAR', core: true },
  { key: 'apgar10', label: 'APGAR a los 10 minutos', group: 'APGAR', kind: 'Puntaje 0 a 10' },

  { key: 'previsionId', label: 'Previsión', group: 'Admisión', kind: 'Lista del catálogo', tableId: 'prevision', tableLabel: 'Previsión' },
  { key: 'procedimientoId', label: 'Procedencia', group: 'Admisión', kind: 'Lista del catálogo', tableId: 'procedimiento', tableLabel: 'Procedimiento' },
  { key: 'transferOrigin', label: 'Centro de origen del traslado', group: 'Admisión', kind: 'Texto (si es traslado)', tableId: 'transferOrigin', tableLabel: 'Centro de origen' },
  { key: 'careLevel', label: 'Nivel de cuidado', group: 'Admisión', kind: 'Opciones', tableId: 'careLevel', tableLabel: 'Nivel de cuidado' },
  { key: 'admissionAt', label: 'Fecha y hora de ingreso', group: 'Admisión', kind: 'Fecha y hora', tableId: 'admissionAt', tableLabel: 'Fecha de ingreso' },
  { key: 'dxIngresoIds', label: 'Diagnósticos de ingreso', group: 'Admisión', kind: 'Diagnósticos (varios)', tableId: 'dxIngreso', tableLabel: 'Diagnóstico de ingreso' },
  { key: 'medicoIds', label: 'Médico tratante', group: 'Admisión', kind: 'Médicos (varios)', tableId: 'medico', tableLabel: 'Médico' },

  { key: 'docUrgencyLaw', label: 'Activación Ley de Urgencia', group: 'Documentos de ingreso', kind: 'Casilla' },
  { key: 'gesNotified', label: 'Notificación GES', group: 'Documentos de ingreso', kind: 'Casilla', tableId: 'ges', tableLabel: 'GES' },
  { key: 'gesNotifiedAt', label: 'Fecha de notificación GES', group: 'Documentos de ingreso', kind: 'Fecha (si hay GES)' },
  { key: 'docConsentAdmission', label: 'Consentimiento informado de ingreso', group: 'Documentos de ingreso', kind: 'Casilla' },
  { key: 'docConsentMila', label: 'Consentimiento Ley Mila', group: 'Documentos de ingreso', kind: 'Casilla' },
]

const BY_KEY = new Map(INGRESO_FIELDS.map((f) => [f.key, f]))

export const isIngresoKey = (key: string) => BY_KEY.has(key)
export const getIngresoField = (key: string) => BY_KEY.get(key)

/** Lo que Jefatura cambió respecto del original. Lo que no está aquí queda como viene de fábrica. */
export type IngresoOverride = {
  label?: string
  tableLabel?: string
  help?: string
  hidden?: boolean
}
export type IngresoOverrides = Record<string, IngresoOverride>

export type IngresoView = {
  label: string
  tableLabel: string
  help: string
  hidden: boolean
}

/** Valor vigente de una pregunta: lo configurado, o el original. */
export function ingresoView(key: string, overrides: IngresoOverrides | undefined): IngresoView {
  const base = BY_KEY.get(key)
  const o = overrides?.[key]
  return {
    label: o?.label || base?.label || key,
    tableLabel: o?.tableLabel || base?.tableLabel || o?.label || base?.label || key,
    help: o?.help ?? '',
    hidden: base?.core ? false : Boolean(o?.hidden),
  }
}

/** ¿La columna de la tabla debe mostrarse? Se oculta cuando la pregunta que la alimenta está oculta. */
export function ingresoColumnHidden(tableId: string, overrides: IngresoOverrides | undefined) {
  const owners = INGRESO_FIELDS.filter((f) => f.tableId === tableId)
  return owners.length > 0 && owners.every((f) => ingresoView(f.key, overrides).hidden)
}

export function ingresoColumnLabel(tableId: string, fallback: string, overrides: IngresoOverrides | undefined) {
  const f = INGRESO_FIELDS.find((x) => x.tableId === tableId)
  if (!f) return fallback
  const o = overrides?.[f.key]
  return o?.tableLabel || o?.label || fallback
}
