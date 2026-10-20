import { and, eq, isNull } from 'drizzle-orm'
import { audit } from '@/lib/audit'
import type { Ctx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord, episode, episodeBlock, episodeIdentity } from '@/lib/db/schema'
import { computeStatus } from '@/lib/rules'
import { rowToCore } from '@/lib/server/episodes'
import { parsePatch } from '@/lib/server/fields'
import { diffEpisode, recordChanges } from '@/lib/server/revisions'
import { shiftOf } from '@/lib/time'

/**
 * Datos del nacimiento que existen en dos lugares: la fila del Libro (Neonatología) y el ingreso de UPC.
 * Mientras ambos estén vinculados se mantienen iguales, así que se escriben una sola vez.
 * Clave de la columna del libro -> campo del ingreso.
 */
export const SHARED_BIRTH_FIELDS: Record<string, string> = {
  apgar1: 'apgar1',
  apgar5: 'apgar5',
  eg: 'gaWeeks',
  peso: 'birthWeightG',
  talla: 'birthLengthCm',
  cc: 'birthHeadCm',
  sexo_rn: 'sex',
}

const SEX_TO_BOOK: Record<string, string> = { F: 'FEMENINO', M: 'MASCULINO', I: 'INDETERMINADO' }
const SEX_TO_EPISODE: Record<string, string> = { FEMENINO: 'F', MASCULINO: 'M', INDETERMINADO: 'I' }

const toBookValue = (field: string, v: unknown) => {
  if (v === null || v === undefined) return ''
  if (field === 'sex') return SEX_TO_BOOK[String(v)] ?? ''
  return String(v)
}

/**
 * Tras guardar el ingreso: si ya hay un valor escrito en la fila vinculada del libro, lo deja igual al del ingreso.
 * Si la fila no tiene valor propio no se toca: el libro ya muestra el del ingreso.
 */
export async function pushEpisodeToBook(episodeId: string, values: Record<string, unknown>) {
  const touched = Object.entries(SHARED_BIRTH_FIELDS).filter(([, field]) => field in values)
  if (touched.length === 0) return
  const [rec] = await db
    .select({ id: birthRecord.id, data: birthRecord.data })
    .from(birthRecord)
    .where(and(eq(birthRecord.episodeId, episodeId), isNull(birthRecord.deletedAt)))
    .limit(1)
  if (!rec) return
  const data = { ...((rec.data ?? {}) as Record<string, string>) }
  let changed = false
  for (const [key, field] of touched) {
    if (!data[key]) continue
    const next = toBookValue(field, values[field])
    if (data[key] !== next) {
      data[key] = next
      changed = true
    }
  }
  if (changed) await db.update(birthRecord).set({ data }).where(eq(birthRecord.id, rec.id))
}

/**
 * Tras guardar la fila del libro: copia al ingreso vinculado los datos compartidos que cambiaron.
 * Respeta los ingresos cerrados (solo se corrigen desde el ingreso, con motivo) y nunca borra datos del ingreso.
 */
export async function pushBookToEpisode(ctx: Ctx, episodeId: string, changed: Record<string, string>) {
  const raw: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(SHARED_BIRTH_FIELDS)) {
    const v = changed[key]
    if (v === undefined || v === '') continue
    raw[field] = field === 'sex' ? (SEX_TO_EPISODE[v.toUpperCase()] ?? null) : v
  }
  if (Object.keys(raw).length === 0) return

  const [row] = await db.select().from(episode).where(eq(episode.id, episodeId)).limit(1)
  if (!row || row.status === 'cerrado') return

  const values: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(raw)) {
    if (val === null) continue
    try {
      Object.assign(values, parsePatch('ingreso', { [k]: val }))
    } catch {
      continue
    }
  }
  const changes = await diffEpisode('ingreso', row as unknown as Record<string, unknown>, values)
  if (changes.length === 0) return

  const now = new Date()
  const core = {
    ...rowToCore(row),
    ...Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x instanceof Date ? x.toISOString() : x])),
  }
  const [ident] = await db
    .select({ a: episodeIdentity.admissionNumber })
    .from(episodeIdentity)
    .where(eq(episodeIdentity.episodeId, episodeId))
    .limit(1)
  const status = computeStatus(core, !!ident?.a?.trim())
  const complete = status !== 'incompleto'
  await db
    .update(episode)
    .set({
      ...values,
      status,
      updatedAt: now,
      completedAt: complete ? (row.completedAt ?? now) : null,
      completedShift: complete ? (row.completedShift ?? shiftOf(now).key) : null,
    })
    .where(eq(episode.id, episodeId))
  await db
    .insert(episodeBlock)
    .values({ episodeId, block: 'ingreso', staffId: ctx.staffId, staffName: ctx.name, updatedAt: now })
    .onConflictDoUpdate({
      target: [episodeBlock.episodeId, episodeBlock.block],
      set: { staffId: ctx.staffId, staffName: ctx.name, updatedAt: now },
    })
  await recordChanges(ctx, episodeId, changes, 'Actualizado desde el Libro de Partos')
  await audit(ctx, 'modificar', 'ingreso', episodeId, 'Datos del nacimiento actualizados desde el Libro de Partos')
}
