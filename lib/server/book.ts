import { and, asc, eq, inArray } from 'drizzle-orm'
import { TZ } from '@/lib/config'
import { DEFAULT_BOOK_FIELDS, DOCTOR_BOOK_KEYS, type BookFieldType, type BookSection } from '@/lib/book-fields'
import { db } from '@/lib/db'
import { appSetting, bookField, catalogItem, episode } from '@/lib/db/schema'
import { HttpError } from '@/lib/api'
import { listBookDoctors } from '@/lib/server/doctors'
import { attachIdentity, buildDetails } from '@/lib/server/episodes'
import type { EpisodeDetail } from '@/lib/types'

export type BookFieldRow = {
  id: number
  key: string
  label: string
  section: BookSection
  group: string
  type: BookFieldType
  options: string[]
  position: number
  required: boolean
  active: boolean
  source: string | null
}

const toField = (r: typeof bookField.$inferSelect): BookFieldRow => ({
  id: r.id,
  key: r.key,
  label: r.label,
  section: r.section === 'neonatal' ? 'neonatal' : 'materno',
  group: r.groupName,
  type: (['text', 'number', 'decimal', 'date', 'time', 'select', 'doctor'].includes(r.type) ? r.type : 'text') as BookFieldType,
  options: r.options ?? [],
  position: r.position,
  required: r.required,
  active: r.active,
  source: r.source,
})

let seeded = false

/** Carga las columnas originales la primera vez; después son 100% administrables. */
export async function ensureBookFields() {
  if (seeded) return
  const existing = await db.select({ id: bookField.id }).from(bookField).limit(1)
  if (existing.length === 0) {
    await db
      .insert(bookField)
      .values(
        DEFAULT_BOOK_FIELDS.map((f, i) => ({
          key: f.key,
          label: f.label,
          section: f.section,
          groupName: f.group,
          type: f.type,
          options: f.options ?? [],
          position: (i + 1) * 10,
          source: f.source ?? null,
        })),
      )
      .onConflictDoNothing({ target: bookField.key })
  }
  await migrateDoctorFields()
  seeded = true
}

const DOCTOR_MIGRATION = 'book_doctor_fields_v1'

/** Una sola vez: las columnas de médicos de instalaciones anteriores pasan de texto libre a médico inscrito. */
async function migrateDoctorFields() {
  const [done] = await db.select().from(appSetting).where(eq(appSetting.key, DOCTOR_MIGRATION)).limit(1)
  if (done) return
  await db
    .update(bookField)
    .set({ type: 'doctor', options: [] })
    .where(and(inArray(bookField.key, [...DOCTOR_BOOK_KEYS]), eq(bookField.type, 'text')))
  await db.insert(appSetting).values({ key: DOCTOR_MIGRATION, value: '1' }).onConflictDoNothing()
}

export async function getBookFields(includeInactive = false): Promise<BookFieldRow[]> {
  await ensureBookFields()
  const rows = await db.select().from(bookField).orderBy(asc(bookField.position), asc(bookField.id))
  return rows.map(toField).filter((f) => includeInactive || f.active)
}

const ymdInTz = (iso: string | Date | null | undefined) => {
  if (!iso) return ''
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const SEX: Record<string, string> = { F: 'FEMENINO', M: 'MASCULINO', I: 'INDETERMINADO' }
const FEEDING: Record<string, string> = {
  exclusiva: 'LACTANCIA EXCLUSIVA',
  mixta: 'LACTANCIA MIXTA',
  formula: 'FÓRMULA',
  otra: 'OTRA',
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

const DELIVERY_BOOK: Record<string, string> = { vaginal: 'PARTO VAGINAL', instrumental: 'PARTO INSTRUMENTAL' }

/** Separa "Nombre(s) Paterno Materno": los dos últimos términos son los apellidos. */
function splitName(full: string | null | undefined) {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 3) return { nombre: parts.slice(0, -2).join(' '), paterno: parts[parts.length - 2], materno: parts[parts.length - 1] }
  if (parts.length === 2) return { nombre: parts[0], paterno: parts[1], materno: '' }
  return { nombre: parts[0] ?? '', paterno: '', materno: '' }
}

const hmInTz = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
}

type Labels = Map<number, string>

function resolveSource(source: string, d: EpisodeDetail, labels: Labels): string {
  if (source === 'patient.paterno' || source === 'patient.materno') {
    const p = splitName(d.identity?.patientName)
    return source === 'patient.paterno' ? p.paterno : p.materno
  }
  if (source.startsWith('mother.')) {
    const m = splitName(d.identity?.motherName)
    return m[source.slice('mother.'.length) as 'nombre' | 'paterno' | 'materno'] ?? ''
  }
  if (source === 'birth.date') return ymdInTz(d.birthAt)
  if (source === 'birth.time') return hmInTz(d.birthAt)
  if (source === 'previsionLabel') return d.previsionId != null ? (labels.get(d.previsionId) ?? '') : ''
  if (source === 'medicoLabel') {
    const ids = d.medicoIds?.length ? d.medicoIds : d.medicoId != null ? [d.medicoId] : []
    return ids.map((i) => labels.get(i)).filter(Boolean).join(', ')
  }
  if (source === 'deliveryLabel') return DELIVERY_BOOK[str(d.deliveryType)] ?? ''
  if (source.startsWith('identity.')) {
    const k = source.slice('identity.'.length) as keyof NonNullable<EpisodeDetail['identity']>
    return str(d.identity?.[k])
  }
  if (source.startsWith('screening.')) {
    const [, kind, sub] = source.split('.')
    const row = d.screenings.find((s) => s.kind === kind)
    if (!row) return ''
    if (sub === 'result') return row.result === 'pasa' ? 'PASA' : row.result === 'refiere' ? 'REFIERE' : ''
    if (row.status === 'realizado') return 'SI'
    if (row.status === 'rechazado' || row.status === 'no_aplica') return 'NO'
    return ''
  }
  switch (source) {
    case 'sex':
      return SEX[str(d.sex)] ?? ''
    case 'feedingDischarge':
      return FEEDING[str(d.feedingDischarge)] ?? ''
    case 'dischargeAt':
      return ymdInTz(d.dischargeAt)
    case 'hospitalized':
      return d.unit === 'nursery' ? 'NO' : 'SI'
    default:
      return str((d as unknown as Record<string, unknown>)[source])
  }
}

/** Valores que ya existen en el episodio de UCI vinculado, indexados por clave de columna. */
export async function resolveLinked(
  episodeIds: (string | null)[],
  fields: BookFieldRow[],
): Promise<Map<string, Record<string, string>>> {
  const ids = [...new Set(episodeIds.filter((x): x is string => !!x))]
  const out = new Map<string, Record<string, string>>()
  if (ids.length === 0) return out
  const rows = await db.select().from(episode).where(inArray(episode.id, ids))
  const details = await attachIdentity(await buildDetails(rows))
  const cat = await db.select({ id: catalogItem.id, label: catalogItem.label }).from(catalogItem)
  const labels: Labels = new Map(cat.map((c) => [c.id, c.label]))
  for (const d of details) {
    const values: Record<string, string> = {}
    for (const f of fields) {
      if (!f.source || f.source === 'user') continue
      const v = resolveSource(f.source, d, labels)
      if (v !== '') values[f.key] = v
    }
    out.set(d.id, values)
  }
  return out
}

export async function episodeSummary(id: string) {
  const [row] = await db.select().from(episode).where(eq(episode.id, id)).limit(1)
  if (!row) return null
  const [d] = await attachIdentity(await buildDetails([row]))
  return d ?? null
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Valida cada valor según el tipo de columna y solo deja pasar columnas que la persona puede editar. */
export function sanitizeData(
  raw: unknown,
  fields: BookFieldRow[],
  canEdit: Record<BookSection, boolean>,
): { data: Record<string, string>; errors: string[] } {
  const data: Record<string, string> = {}
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return { data, errors }
  const input = raw as Record<string, unknown>
  for (const f of fields) {
    if (!canEdit[f.section] || !(f.key in input) || f.source === 'user') continue
    const v = input[f.key]
    const s = (v === null || v === undefined ? '' : String(v)).trim().slice(0, 300)
    if (s === '') {
      data[f.key] = ''
      continue
    }
    if (f.type === 'number' && !/^-?\d+$/.test(s)) errors.push(`${f.label} debe ser un número entero.`)
    else if (f.type === 'decimal' && !/^-?\d+([.,]\d+)?$/.test(s)) errors.push(`${f.label} debe ser un número.`)
    else if (f.type === 'date' && (!DATE_RE.test(s) || Number.isNaN(new Date(s).getTime())))
      errors.push(`${f.label} no es una fecha válida.`)
    else if (f.type === 'time' && !TIME_RE.test(s)) errors.push(`${f.label} no es una hora válida.`)
    else data[f.key] = f.type === 'decimal' ? s.replace(',', '.') : s
  }
  return { data, errors }
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/**
 * Las columnas de tipo médico solo aceptan personas inscritas en la app. Un valor histórico
 * que ya estaba en el registro se conserva mientras no se cambie, para no perder datos antiguos.
 */
export async function assertBookDoctors(
  data: Record<string, string>,
  fields: BookFieldRow[],
  previous: Record<string, string> = {},
) {
  const doctorFields = fields.filter((f) => f.type === 'doctor' && data[f.key])
  if (doctorFields.length === 0) return
  const names = await listBookDoctors()
  const byNorm = new Map(names.map((n) => [norm(n), n]))
  for (const f of doctorFields) {
    const v = data[f.key]
    const match = byNorm.get(norm(v))
    if (match) {
      data[f.key] = match
      continue
    }
    if (previous[f.key] !== undefined && norm(previous[f.key]) === norm(v)) continue
    throw new HttpError(
      422,
      `${f.label}: elige un médico inscrito en la app. Si falta, pídele a Jefatura que lo agregue en Administración.`,
    )
  }
}

export type BookRecordOut = {
  id: string
  n: number
  seq: number
  episodeId: string | null
  episodeCode: string | null
  data: Record<string, string>
  linked: Record<string, string>
  values: Record<string, string>
  createdByName: string | null
  updatedByName: string | null
  createdAt: string
  updatedAt: string
}

/** Combina lo digitado con lo que ya está en UCI: lo digitado manda. */
export const effectiveValues = (data: Record<string, string>, linked: Record<string, string>) => {
  const out: Record<string, string> = { ...linked }
  for (const [k, v] of Object.entries(data)) if (v !== '') out[k] = v
  return out
}
