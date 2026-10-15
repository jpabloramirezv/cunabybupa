import type { BookSection } from '@/lib/book-fields'

type Values = Record<string, string>

/** A qué "mundo" pertenece cada fila del libro. */
export type BookSegment = 'nursery' | 'uci' | 'aborto'

export const SEGMENT_LABEL: Record<BookSegment, string> = {
  nursery: 'Nursery',
  uci: 'UCI Neonatal',
  aborto: 'Aborto',
}

/**
 * Un recién nacido es de UCI si está vinculado a un ingreso de la Pizarra o si se marcó Hospitalización = SI.
 * Si no, es de Nursery (estadía normal). Los abortos no tienen recién nacido.
 */
export function segmentOf(values: Values, episodeId?: string | null): BookSegment {
  if ((values.tipo_parto ?? '').toUpperCase() === 'ABORTO') return 'aborto'
  if (episodeId || values.hospitalizado === 'SI') return 'uci'
  return 'nursery'
}

/** Código corto y estable para que Maternidad y Neonatología se refieran a la misma fila. */
export const linkCode = (seq: number) => `LP-${String(seq).padStart(5, '0')}`

const has = (v: Values, k: string) => !!v[k]

/**
 * Columnas que solo tienen sentido según otra respuesta. Se muestran cuando la condición se cumple
 * o cuando ya tienen un dato (nunca se oculta algo ya escrito). Las columnas personalizadas siempre se ven.
 */
const REVEAL: Record<string, (v: Values) => boolean> = {
  causa_cesarea: (v) => (v.tipo_parto ?? '').toUpperCase().includes('CESÁREA'),
  robson: (v) => (v.tipo_parto ?? '').toUpperCase() !== 'ABORTO',
  tiempo_rpm: (v) => v.rpm === 'SI',
  profilaxis_rpm: (v) => v.rpm === 'SI',
  elisa_res: (v) => has(v, 'elisa_n'),
  vdrl_res: (v) => has(v, 'vdrl_n'),
  sgb_res: (v) => v.sgb === 'SI',
  prof_sgb: (v) => has(v, 'sgb'),
  hb_res: (v) => v.hb === 'SI',
  chagas_res: (v) => v.chagas === 'SI',
  peat_resultado: (v) => v.peat === 'SI',
}

export function isFieldVisible(key: string, values: Values): boolean {
  const rule = REVEAL[key]
  if (!rule) return true
  return !!values[key] || rule(values)
}

/** Texto de apoyo breve por grupo; solo para los grupos originales. */
export const GROUP_HINTS: Record<string, string> = {
  Admisión: 'Cuándo y cómo ingresó la madre.',
  'Datos de la madre': 'Identificación y antecedentes de la madre.',
  'Parto o aborto': 'Cómo ocurrió el parto y qué eventos hubo.',
  'Antecedentes obstétricos': 'Embarazos previos y controles.',
  Exámenes: 'Los resultados aparecen cuando indicas que se hizo el examen.',
  'Placenta y equipo': 'Quiénes participaron.',
  Equipo: 'Quién registra la parte neonatal.',
  'Recién nacido': 'Datos de identificación y medidas.',
  'Evaluación al nacer': 'Apgar, apego y primera hora.',
  Alta: 'Si se hospitalizó, cuándo se fue y cómo se alimenta.',
  'Vacunas y tamizajes': 'Lo hecho antes del alta.',
}

/** Fecha y hora vienen con valores por defecto, así que no cuentan como "avance". */
const NOT_COUNTED = new Set(['fecha', 'hora'])

export type SectionState = 'pendiente' | 'en_curso' | 'completo'

export type SectionProgress = { filled: number; total: number; state: SectionState }

type FieldLite = { key: string; section: BookSection }

export function sectionProgress(fields: FieldLite[], values: Values, section: BookSection): SectionProgress {
  let total = 0
  let filled = 0
  for (const f of fields) {
    if (f.section !== section || NOT_COUNTED.has(f.key) || !isFieldVisible(f.key, values)) continue
    total++
    if (values[f.key]) filled++
  }
  const state: SectionState = filled === 0 ? 'pendiente' : filled >= total ? 'completo' : 'en_curso'
  return { filled, total, state }
}

export const normRut = (s?: string) => (s ?? '').replace(/[^0-9kK]/g, '').toUpperCase()

const normText = (s?: string) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const dayDiff = (a: string, b: string) => {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  if (Number.isNaN(da) || Number.isNaN(db)) return Infinity
  return Math.abs(da - db) / 86400000
}

/**
 * Busca filas que probablemente ya existen y están esperando la parte de quien registra:
 * mismo RUT de la madre, o mismo apellido paterno con fecha de parto cercana.
 */
export function findPossibleMatches<T extends { values: Values }>(
  draft: Values,
  records: T[],
  isPending: (r: T) => boolean,
  today: string,
): T[] {
  const rut = normRut(draft.rut)
  const lineage = (v: Values) => {
    // El apellido materno del RN suele ser el paterno de la madre, así una fila que partió Neonatología
    // (solo con datos del RN) también se reconoce cuando Maternidad escribe los datos de la madre, y al revés.
    const keys = [normText(v.ap_paterno), normText(v.ap_materno_rn)].filter(Boolean)
    return keys.length ? keys : [normText(v.ap_paterno_rn)].filter(Boolean)
  }
  const surnames = lineage(draft)
  const date = draft.fecha || today
  if (!rut && surnames.length === 0) return []
  return records.filter((r) => {
    if (!isPending(r)) return false
    if (rut && normRut(r.values.rut) === rut) return true
    if (surnames.length > 0) {
      const theirs = [normText(r.values.ap_paterno), normText(r.values.ap_materno_rn)].filter(Boolean)
      if (surnames.some((s) => theirs.includes(s))) {
        const other = r.values.fecha
        return !other || dayDiff(other, date) <= 2
      }
    }
    return false
  })
}
