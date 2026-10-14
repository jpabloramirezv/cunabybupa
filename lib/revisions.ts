export const FIELD_LABELS: Record<string, string> = {
  gaWeeks: 'Semanas de gestación',
  gaDays: 'Días de gestación',
  birthWeightG: 'Peso de nacimiento (g)',
  apgar1: 'APGAR a 1 minuto',
  apgar5: 'APGAR a 5 minutos',
  apgar10: 'APGAR a 10 minutos',
  birthLengthCm: 'Talla de nacimiento (cm)',
  birthHeadCm: 'Circunferencia craneana (cm)',
  docUrgencyLaw: 'Activación Ley de Urgencia',
  docConsentAdmission: 'Consentimiento informado de ingreso',
  docConsentMila: 'Consentimiento Ley Mila',
  maternalHivResult: 'Resultado de VIH materno',
  maternalHivAt: 'Fecha del examen de VIH materno',
  sex: 'Sexo',
  deliveryType: 'Tipo de parto',
  birthAt: 'Fecha y hora de nacimiento',
  previsionId: 'Previsión',
  procedimientoId: 'Procedencia',
  dxIngresoId: 'Diagnóstico de ingreso',
  dxIngresoIds: 'Diagnósticos de ingreso',
  medicoId: 'Profesional',
  medicoIds: 'Médicos tratantes',
  admissionAt: 'Fecha y hora de ingreso',
  careLevel: 'Nivel de cuidado',
  transferOrigin: 'Centro de origen del traslado',
  gesNotified: 'Notificación GES',
  gesNotifiedAt: 'Fecha de notificación GES',
  hyperbili: 'Hiperbilirrubinemia',
  phototherapyAt: 'Inicio de fototerapia',
  dischargeAt: 'Fecha y hora de alta',
  dischargeWeightG: 'Peso al alta (g)',
  dxEgresoId: 'Diagnóstico de egreso',
  dxEgresoIds: 'Diagnósticos de egreso',
  destinoId: 'Destino',
  feedingDischarge: 'Alimentación al alta',
  patientName: 'Nombre del recién nacido',
  rut: 'RUT',
  admissionNumber: 'N° de admisión',
  motherName: 'Nombre de la madre',
  motherPhone: 'Teléfono de la madre',
  contactReason: 'Motivo de contacto',
  contactConsent: 'Consentimiento de contacto',
  alta: 'Alta',
  creacion: 'Registro',
}

export const TIMESTAMP_FIELDS = new Set([
  'birthAt',
  'phototherapyAt',
  'dischargeAt',
  'admissionAt',
  'gesNotifiedAt',
  'maternalHivAt',
])

export const BLOCK_LABELS: Record<string, string> = {
  ingreso: 'Ingreso',
  seguimiento: 'Seguimiento',
  tamizaje: 'Tamizajes',
  identidad: 'Identificación',
  alta: 'Alta',
}

/** Un motivo de corrección útil tiene al menos esta cantidad de caracteres. */
export const MIN_REASON_LENGTH = 5
export const MAX_REASON_LENGTH = 300

export type RevisionItem = {
  id: number
  at: string
  staffName: string
  role: string | null
  block: string
  field: string
  label: string
  oldValue: string | null
  newValue: string | null
  /** Datos de identificación: se registra que cambiaron, pero nunca su contenido. */
  sensitive: boolean
  reason: string | null
}

export type RevisionsPayload = { items: RevisionItem[] }
