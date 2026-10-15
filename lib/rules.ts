// Reglas compartidas entre cliente y servidor: faltantes, estado y avisos.

import { SCREENING_KINDS } from '@/lib/config'
import { addMonthsDaysSantiago } from '@/lib/time'

export type Role = 'matrona' | 'medico' | 'medico_jefe' | 'jefatura' | 'analista'

/** Roles que pueden figurar como médico tratante. */
export const DOCTOR_ROLES: readonly Role[] = ['medico', 'medico_jefe']

export const ROLE_LABEL: Record<Role, string> = {
  matrona: 'Matrona',
  medico: 'Médico',
  medico_jefe: 'Médico Jefe',
  jefatura: 'Jefatura',
  analista: 'Analista',
}

/**
 * Etiqueta visible del cargo. Una matrona con permisos de Jefatura sigue
 * mostrándose solo como "Matrona"; `isAdmin` cambia permisos, no el nombre.
 */
export function roleLabelFor(role: Role, _isAdmin?: boolean): string {
  return ROLE_LABEL[role]
}

export type EpisodeStatus = 'incompleto' | 'completo' | 'cerrado'

export const STATUS_LABEL: Record<EpisodeStatus, string> = {
  incompleto: 'Por completar',
  completo: 'Completo',
  cerrado: 'Cerrado',
}

/**
 * Estado que ve el usuario. "Por completar" reúne un solo concepto: faltan
 * datos del ingreso o queda algún tamizaje abierto. El estado guardado no cambia.
 */
export function uiStatus(e: {
  status: EpisodeStatus
  pendingKinds: string[]
  screeningIssues?: string[]
}): EpisodeStatus {
  if (e.status === 'cerrado') return 'cerrado'
  return e.status === 'incompleto' || e.pendingKinds.length > 0 || (e.screeningIssues?.length ?? 0) > 0
    ? 'incompleto'
    : 'completo'
}

export type HivState = 'sin_dato' | 'incompleto' | 'vigente' | 'caducado'

export type HivStatus = {
  state: HivState
  /** Último día en que el examen vale. */
  expiresAt: string | null
  daysLeft: number | null
  negative: boolean
}

/** El VIH materno vale 1 mes y 5 días desde la fecha del examen. */
export function hivStatus(
  result: string | null | undefined,
  at: string | null | undefined,
  now: number = Date.now(),
): HivStatus {
  const has = !!result
  const hasDate = !!at
  if (!has && !hasDate) return { state: 'sin_dato', expiresAt: null, daysLeft: null, negative: false }
  if (!has || !hasDate) return { state: 'incompleto', expiresAt: null, daysLeft: null, negative: result === 'negativo' }
  const exp = addMonthsDaysSantiago(at as string, 1, 5)
  const daysLeft = Math.ceil((exp.getTime() - now) / 86400_000)
  return {
    state: exp.getTime() >= now ? 'vigente' : 'caducado',
    expiresAt: exp.toISOString(),
    daysLeft,
    negative: result === 'negativo',
  }
}

export const BCG_HIV_POSITIVE_MESSAGE =
  'Contraindicación: VIH materno positivo. No se debe administrar la vacuna BCG.'

/** El VIH materno positivo contraindica la BCG sin importar la fecha del examen. */
export const isBcgKind = (kind: string) => kind.toUpperCase() === 'BCG'

/** Motivo por el que no se puede administrar BCG, o null si está habilitada. */
export function bcgBlockedReason(
  result: string | null | undefined,
  at: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (result === 'positivo') return BCG_HIV_POSITIVE_MESSAGE
  const h = hivStatus(result, at, now)
  if (h.state === 'sin_dato' || h.state === 'incompleto')
    return 'Registra el resultado y la fecha del VIH materno para habilitar la vacuna BCG.'
  if (h.state === 'caducado') return 'El VIH materno está caducado. Registra un examen vigente para habilitar la vacuna BCG.'
  if (!h.negative) return 'La vacuna BCG solo se habilita con VIH materno negativo.'
  return null
}

export type ScreeningLike = {
  kind: string
  status: string
  lot?: string | null
  result?: string | null
  citedAt?: string | null
}

/**
 * Datos que faltan dentro de tamizajes e inmunizaciones ya iniciados, más el VIH materno.
 * Se suman a los tamizajes pendientes para el estado "Por completar".
 */
export function screeningIssues(
  ep: Pick<EpisodeCore, 'maternalHivResult' | 'maternalHivAt'>,
  screenings: ScreeningLike[],
): string[] {
  const out: string[] = []
  const hiv = hivStatus(ep.maternalHivResult, ep.maternalHivAt)
  if (hiv.state === 'sin_dato' || hiv.state === 'incompleto') out.push('VIH materno (resultado y fecha)')
  for (const def of SCREENING_KINDS) {
    const s = screenings.find((x) => x.kind === def.key)
    if (!s) continue
    if (s.status === 'realizado') {
      if (def.lot && !s.lot?.trim()) out.push(`Lote de ${def.label}`)
      if (def.result && !s.result) out.push(`Resultado de ${def.label}`)
    }
    if (s.status === 'citado' && !s.citedAt) out.push(`Fecha de citación de ${def.label}`)
  }
  return out
}

/** Documentos de ingreso que faltan. Es un aviso: no cambia el estado del registro. */
export function missingDocuments(ep: Partial<EpisodeCore>): string[] {
  const out: string[] = []
  if (!ep.docUrgencyLaw) out.push('Activación Ley de Urgencia')
  if (!ep.gesNotified) out.push('Notificación GES')
  if (!ep.docConsentAdmission) out.push('Consentimiento informado de ingreso')
  if (!ep.docConsentMila) out.push('Consentimiento Ley Mila')
  return out
}

export type EpisodeCore = {
  gaWeeks: number | null
  gaDays: number | null
  birthWeightG: number | null
  apgar1: number | null
  apgar5: number | null
  apgar10: number | null
  birthLengthCm: number | null
  birthHeadCm: number | null
  docUrgencyLaw: boolean | null
  docConsentAdmission: boolean | null
  docConsentMila: boolean | null
  maternalHivResult: string | null
  maternalHivAt: string | null
  sex: string | null
  deliveryType: string | null
  birthAt: string | null
  previsionId: number | null
  procedimientoId: number | null
  dxIngresoId: number | null
  /** Todos los diagnósticos de ingreso; `dxIngresoId` es el principal (el primero). */
  dxIngresoIds: number[]
  medicoId: number | null
  /** Todos los médicos tratantes; `medicoId` es el principal (el primero). */
  medicoIds: number[]
  admissionAt: string | null
  careLevel: string | null
  transferOrigin: string | null
  gesNotified: boolean | null
  gesNotifiedAt: string | null
  hyperbili: boolean | null
  phototherapyAt: string | null
  dischargeAt: string | null
  dischargeWeightG: number | null
  dxEgresoId: number | null
  /** Todos los diagnósticos de egreso; `dxEgresoId` es el principal (el primero). */
  dxEgresoIds: number[]
  destinoId: number | null
  feedingDischarge: string | null
  altaConfirmedAt: string | null
}

type Check = [keyof EpisodeCore | 'admissionNumber', string]

export const INGRESO_REQUIRED: Check[] = [
  ['gaWeeks', 'Edad gestacional'],
  ['birthWeightG', 'Peso de nacimiento'],
  ['apgar1', 'APGAR 1 min'],
  ['apgar5', 'APGAR 5 min'],
  ['sex', 'Sexo'],
  ['deliveryType', 'Tipo de parto'],
]

export const INGRESO_OPTIONAL: Check[] = [
  ['birthAt', 'Fecha y hora de nacimiento'],
  ['admissionNumber', 'Número de admisión'],
  ['previsionId', 'Previsión'],
  ['procedimientoId', 'Procedencia'],
  ['dxIngresoId', 'Diagnóstico de ingreso'],
  ['medicoId', 'Médico tratante'],
  ['birthLengthCm', 'Talla de nacimiento'],
  ['birthHeadCm', 'Circunferencia craneana'],
]

export const ALTA_REQUIRED: Check[] = [
  ['dischargeAt', 'Fecha del alta'],
  ['dischargeWeightG', 'Peso al alta'],
  ['dxEgresoId', 'Diagnóstico de egreso'],
  ['destinoId', 'Destino'],
  ['feedingDischarge', 'Alimentación al alta'],
  ['medicoId', 'Médico tratante'],
]

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === ''
}

function missing(
  checks: Check[],
  ep: Partial<EpisodeCore>,
  hasAdmission: boolean,
): string[] {
  return checks
    .filter(([key]) =>
      key === 'admissionNumber'
        ? !hasAdmission
        : isEmpty(ep[key as keyof EpisodeCore]),
    )
    .map(([, label]) => label)
}

export function missingIngresoRequired(ep: Partial<EpisodeCore>) {
  return missing(INGRESO_REQUIRED, ep, true)
}

export function missingIngreso(ep: Partial<EpisodeCore>, hasAdmission: boolean) {
  return [
    ...missing(INGRESO_REQUIRED, ep, hasAdmission),
    ...missing(INGRESO_OPTIONAL, ep, hasAdmission),
  ]
}

export function missingAlta(ep: Partial<EpisodeCore>) {
  return missing(ALTA_REQUIRED, ep, true)
}

export function computeStatus(
  ep: Partial<EpisodeCore>,
  hasAdmission: boolean,
): EpisodeStatus {
  if (ep.altaConfirmedAt && missingAlta(ep).length === 0) return 'cerrado'
  return missingIngreso(ep, hasAdmission).length === 0 ? 'completo' : 'incompleto'
}

/** El APGAR a 5 minutos es el único valor que se rechaza si es imposible. */
export function apgar5Error(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  if (!Number.isInteger(v) || v < 0 || v > 10)
    return 'El APGAR a 5 minutos debe estar entre 0 y 10.'
  return null
}

export function apgar10Error(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  if (!Number.isInteger(v) || v < 0 || v > 10)
    return 'El APGAR a 10 minutos debe estar entre 0 y 10.'
  return null
}

/** Avisos que se muestran pero nunca bloquean la carga. */
export function episodeWarnings(ep: Partial<EpisodeCore>): string[] {
  const w: string[] = []
  const { gaWeeks, gaDays, birthWeightG, apgar1, apgar5 } = ep
  if (gaWeeks != null && (gaWeeks < 22 || gaWeeks > 43))
    w.push('La edad gestacional parece fuera de lo habitual (22 a 43 semanas).')
  if (gaDays != null && (gaDays < 0 || gaDays > 6))
    w.push('Los días de edad gestacional deben ir de 0 a 6.')
  if (birthWeightG != null && (birthWeightG < 300 || birthWeightG > 5500))
    w.push('El peso de nacimiento parece fuera de lo habitual (300 a 5.500 g).')
  if (apgar1 != null && (apgar1 < 0 || apgar1 > 10))
    w.push('El APGAR a 1 minuto debe estar entre 0 y 10.')
  if (apgar1 != null && apgar5 != null && apgar5 + 3 < apgar1)
    w.push('El APGAR a 5 minutos es bastante menor que el de 1 minuto. Revisa que esté bien.')
  if (gaWeeks != null && birthWeightG != null) {
    if (gaWeeks >= 36 && birthWeightG < 1500)
      w.push('El peso es muy bajo para la edad gestacional indicada.')
    if (gaWeeks <= 30 && birthWeightG > 2500)
      w.push('El peso es muy alto para la edad gestacional indicada.')
  }
  if (ep.birthLengthCm != null && (ep.birthLengthCm < 20 || ep.birthLengthCm > 65))
    w.push('La talla de nacimiento parece fuera de lo habitual (20 a 65 cm).')
  if (ep.birthHeadCm != null && (ep.birthHeadCm < 15 || ep.birthHeadCm > 45))
    w.push('La circunferencia craneana parece fuera de lo habitual (15 a 45 cm).')
  const birth = ep.birthAt ? new Date(ep.birthAt).getTime() : null
  if (birth && birth > Date.now() + 5 * 60000)
    w.push('La fecha de nacimiento está en el futuro.')
  if (birth && ep.dischargeAt && new Date(ep.dischargeAt).getTime() < birth)
    w.push('El alta es anterior al nacimiento.')
  if (birth && ep.phototherapyAt && new Date(ep.phototherapyAt).getTime() < birth)
    w.push('La fototerapia es anterior al nacimiento.')
  if (
    ep.dischargeWeightG != null &&
    (ep.dischargeWeightG < 500 || ep.dischargeWeightG > 8000)
  )
    w.push('El peso al alta parece fuera de lo habitual.')
  return w
}

export function episodeCode(seq: number) {
  return `RN-${String(seq).padStart(4, '0')}`
}

export function weightCategory(g: number | null | undefined) {
  if (g == null) return null
  if (g < 1500) return '<1500'
  if (g < 2500) return '1500-2499'
  return '>=2500'
}

export const WEIGHT_LABEL: Record<string, string> = {
  '<1500': 'Menos de 1.500 g',
  '1500-2499': '1.500 a 2.499 g',
  '>=2500': '2.500 g o más',
}

export function normalizeText(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
