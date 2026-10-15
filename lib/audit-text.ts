import { FIELD_LABELS, TIMESTAMP_FIELDS } from '@/lib/revisions'
import { SCREENING_KINDS } from '@/lib/config'
import { fmtDateTime } from '@/lib/time'

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  crear: 'Creó',
  modificar: 'Modificó',
  leer: 'Consultó',
  eliminar: 'Eliminó',
  exportar: 'Exportó',
}

export const AUDIT_BLOCK_LABELS: Record<string, string> = {
  ingreso: 'Ingreso',
  seguimiento: 'Tamizajes y seguimiento',
  tamizaje: 'Tamizajes',
  identidad: 'Identificación',
  alta: 'Alta',
  sesion: 'Sesión',
  administracion: 'Administración',
  panel: 'Panel',
  turno: 'Turno',
  insights: 'Informes',
  libro: 'Libro de Partos',
  mural: 'Mural de turno',
}

export type AuditChange = {
  field: string
  oldValue: string | null
  newValue: string | null
  sensitive?: boolean
}

const MAX_VALUE = 60
const MAX_CHANGES = 6
const MAX_DETAIL = 900

const fieldLabel = (field: string) => {
  if (field.startsWith('tamizaje:')) {
    const kind = field.slice('tamizaje:'.length)
    return SCREENING_KINDS.find((k) => k.key === kind)?.label ?? kind
  }
  return FIELD_LABELS[field] ?? field
}

function show(field: string, v: string | null) {
  if (v === null || v === '') return 'sin dato'
  let out = v
  if (TIMESTAMP_FIELDS.has(field)) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) out = fmtDateTime(d.toISOString())
  }
  return out.length > MAX_VALUE ? `${out.slice(0, MAX_VALUE - 1)}…` : out
}

function describeOne(c: AuditChange) {
  const label = fieldLabel(c.field)
  if (c.sensitive) return label
  const was = c.oldValue === null || c.oldValue === ''
  const now = c.newValue === null || c.newValue === ''
  if (was && now) return label
  if (was) return `${label}: se registró «${show(c.field, c.newValue)}»`
  if (now) return `${label}: se borró «${show(c.field, c.oldValue)}»`
  return `${label}: cambió de «${show(c.field, c.oldValue)}» a «${show(c.field, c.newValue)}»`
}

/**
 * Frase que explica un cambio guardado, pensada para quien audita.
 * Nunca incluye el contenido de datos de identificación: solo qué campos se tocaron.
 */
export function explainChange(opts: {
  block: string
  code?: string | null
  created: boolean
  changes: AuditChange[]
}) {
  const { block, code, created, changes } = opts
  const where = AUDIT_BLOCK_LABELS[block] ?? block
  const record = code ? `el registro ${code}` : 'el registro'
  const head = created
    ? `Creó ${record} al guardar el primer dato en ${where}.`
    : `Modificó ${where} de ${record}.`
  if (changes.length === 0) {
    return created ? head : `${head} Se guardó sin cambios en los valores.`
  }
  const shown = changes.slice(0, MAX_CHANGES).map(describeOne)
  const extra = changes.length - shown.length
  const sensitive = changes.some((c) => c.sensitive)
  const parts = [head, shown.join('; ') + (extra > 0 ? `; y ${extra} cambio${extra > 1 ? 's' : ''} más` : '') + '.']
  if (sensitive) parts.push('Por ser datos de identificación, no se muestra su contenido.')
  return parts.join(' ').slice(0, MAX_DETAIL)
}

const looksLikeFieldList = (detail: string) =>
  detail.split(',').every((t) => {
    const key = t.trim()
    return key !== '' && (key in FIELD_LABELS || SCREENING_KINDS.some((k) => k.key === key))
  })

/** Traduce el detalle de movimientos antiguos (solo nombres de campo) a una frase legible. */
export function explainStoredDetail(action: string, block: string, detail: string | null) {
  if (!detail) {
    if (action === 'leer' && block === 'identidad') return 'Abrió los datos de identificación del paciente.'
    return null
  }
  if (!looksLikeFieldList(detail)) return detail
  const names = detail.split(',').map((t) => {
    const key = t.trim()
    return FIELD_LABELS[key] ?? SCREENING_KINDS.find((k) => k.key === key)?.label ?? key
  })
  const verb = action === 'crear' ? 'Registró' : 'Actualizó'
  const where = AUDIT_BLOCK_LABELS[block] ?? block
  return `${verb} en ${where}: ${names.join(', ')}.`
}
