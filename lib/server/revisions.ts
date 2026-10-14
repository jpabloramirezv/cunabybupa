import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { CARE_LEVEL_OPTIONS, DELIVERY_OPTIONS, FEEDING_OPTIONS, SCREENING_KINDS, SCREENING_STATUS, SEX_OPTIONS } from '@/lib/config'
import type { Ctx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { catalogItem, diagnosis, episodeRevision } from '@/lib/db/schema'
import { BLOCK_LABELS, FIELD_LABELS, TIMESTAMP_FIELDS, type RevisionItem } from '@/lib/revisions'

/** Mientras una misma persona edita un dato, los guardados automáticos se funden en un solo cambio. */
const MERGE_WINDOW_MS = 10 * 60_000

let ready: Promise<unknown> | null = null

/** Crea la tabla si todavía no existe, para que el historial funcione sin pasos manuales. */
export function ensureRevisionTable() {
  ready ??= db
    .execute(
      sql`CREATE TABLE IF NOT EXISTS episode_revision (
        id serial PRIMARY KEY, episode_id text NOT NULL, at timestamptz NOT NULL DEFAULT now(),
        staff_id int, staff_name text NOT NULL, role text, block text NOT NULL, field text NOT NULL,
        old_value text, new_value text, sensitive boolean NOT NULL DEFAULT false, reason text)`,
    )
    .then(() =>
      db.execute(
        sql`CREATE INDEX IF NOT EXISTS episode_revision_ep_idx ON episode_revision (episode_id, at DESC)`,
      ),
    )
    .catch((e) => {
      ready = null
      throw e
    })
  return ready
}

export type Change = {
  block: string
  field: string
  oldValue: string | null
  newValue: string | null
  sensitive?: boolean
}

const optionLabel = (list: readonly { value: string; label: string }[], v: string) =>
  list.find((o) => o.value === v)?.label ?? v

const CATALOG_FIELDS = new Set(['previsionId', 'procedimientoId', 'destinoId', 'medicoId'])
const DX_FIELDS = new Set(['dxIngresoId', 'dxEgresoId'])
const DX_LIST_FIELDS = new Set(['dxIngresoIds', 'dxEgresoIds'])

/** Convierte el valor guardado en la ficha en un texto que una persona entiende. */
async function readable(field: string, raw: unknown): Promise<string | null> {
  if (raw === null || raw === undefined || raw === '') return null
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null
    if (DX_LIST_FIELDS.has(field)) {
      const dxRows = await db
        .select({ id: diagnosis.id, code: diagnosis.code, name: diagnosis.name })
        .from(diagnosis)
        .where(inArray(diagnosis.id, raw.map(Number)))
      const byId = new Map(dxRows.map((r) => [r.id, `${r.code} · ${r.name}`]))
      return raw.map((id) => byId.get(Number(id)) ?? `N.° ${id}`).join('; ')
    }
    const rows = await db
      .select({ id: catalogItem.id, label: catalogItem.label })
      .from(catalogItem)
      .where(inArray(catalogItem.id, raw.map(Number)))
    const names = new Map(rows.map((r) => [r.id, r.label]))
    return raw.map((id) => names.get(Number(id)) ?? `N.° ${id}`).join(', ')
  }
  if (field === 'careLevel') return optionLabel(CARE_LEVEL_OPTIONS, String(raw))
  if (raw instanceof Date) return raw.toISOString()
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No'
  if (field === 'sex') return optionLabel(SEX_OPTIONS, String(raw))
  if (field === 'deliveryType') return optionLabel(DELIVERY_OPTIONS, String(raw))
  if (field === 'feedingDischarge') return optionLabel(FEEDING_OPTIONS, String(raw))
  if (CATALOG_FIELDS.has(field)) {
    const [r] = await db
      .select({ label: catalogItem.label })
      .from(catalogItem)
      .where(eq(catalogItem.id, Number(raw)))
      .limit(1)
    return r?.label ?? `N.° ${raw}`
  }
  if (DX_FIELDS.has(field)) {
    const [r] = await db
      .select({ code: diagnosis.code, name: diagnosis.name })
      .from(diagnosis)
      .where(eq(diagnosis.id, Number(raw)))
      .limit(1)
    return r ? `${r.code} · ${r.name}` : `N.° ${raw}`
  }
  return String(raw)
}

const same = (a: unknown, b: unknown) => {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = Array.isArray(a) ? a : []
    const y = Array.isArray(b) ? b : []
    return x.length === y.length && x.every((v, i) => v === y[i])
  }
  const n = (v: unknown) => (v === '' || v === undefined ? null : v instanceof Date ? v.getTime() : v)
  return n(a) === n(b)
}

/** Compara la ficha actual con el parche y devuelve solo lo que realmente cambió. */
export async function diffEpisode(
  block: string,
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<Change[]> {
  const out: Change[] = []
  for (const [field, next] of Object.entries(patch)) {
    if (same(before[field], next)) continue
    out.push({
      block,
      field,
      oldValue: await readable(field, before[field]),
      newValue: await readable(field, next),
    })
  }
  return out
}

/** Guarda los cambios. Nunca guarda el contenido de datos de identificación. */
export async function recordChanges(
  ctx: Pick<Ctx, 'staffId' | 'name' | 'role'>,
  episodeId: string,
  changes: Change[],
  reason?: string | null,
) {
  if (changes.length === 0) return
  await ensureRevisionTable()
  const why = reason?.trim() || null
  const since = new Date(Date.now() - MERGE_WINDOW_MS)

  for (const c of changes) {
    const oldValue = c.sensitive ? null : c.oldValue
    const newValue = c.sensitive ? null : c.newValue
    const [recent] = await db
      .select()
      .from(episodeRevision)
      .where(
        and(
          eq(episodeRevision.episodeId, episodeId),
          eq(episodeRevision.field, c.field),
          eq(episodeRevision.staffId, ctx.staffId),
          gt(episodeRevision.at, since),
        ),
      )
      .orderBy(desc(episodeRevision.at))
      .limit(1)

    const canMerge = recent && (recent.reason ?? null) === why
    if (canMerge) {
      if (!c.sensitive && recent.oldValue === newValue) {
        await db.delete(episodeRevision).where(eq(episodeRevision.id, recent.id))
      } else {
        await db
          .update(episodeRevision)
          .set({ newValue, at: new Date() })
          .where(eq(episodeRevision.id, recent.id))
      }
      continue
    }
    await db.insert(episodeRevision).values({
      episodeId,
      staffId: ctx.staffId,
      staffName: ctx.name,
      role: ctx.role,
      block: c.block,
      field: c.field,
      oldValue,
      newValue,
      sensitive: !!c.sensitive,
      reason: why,
    })
  }
}

const labelOf = (block: string, field: string) => {
  if (block === 'tamizaje' && field.startsWith('tamizaje:')) {
    const kind = field.slice('tamizaje:'.length)
    return `Tamizaje ${SCREENING_KINDS.find((k) => k.key === kind)?.label ?? kind}`
  }
  return FIELD_LABELS[field] ?? field
}

export const screeningStatusLabel = (key: string | null | undefined) =>
  key ? (SCREENING_STATUS.find((s) => s.key === key)?.label ?? key) : null

export async function listRevisions(episodeId: string): Promise<RevisionItem[]> {
  await ensureRevisionTable()
  const rows = await db
    .select()
    .from(episodeRevision)
    .where(eq(episodeRevision.episodeId, episodeId))
    .orderBy(desc(episodeRevision.at), desc(episodeRevision.id))
    .limit(500)
  return rows.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    staffName: r.staffName,
    role: r.role,
    block: BLOCK_LABELS[r.block] ? r.block : r.block,
    field: r.field,
    label: labelOf(r.block, r.field),
    oldValue: r.oldValue,
    newValue: r.newValue,
    sensitive: r.sensitive,
    reason: r.reason,
  }))
}

export const isTimestampField = (f: string) => TIMESTAMP_FIELDS.has(f)
