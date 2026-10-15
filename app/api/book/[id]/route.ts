import { and, eq, isNull, ne } from 'drizzle-orm'
import { assertEpisodeId, handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord, episode } from '@/lib/db/schema'
import { canonicalizeBookDoctors, getBookFields, sanitizeData } from '@/lib/server/book'
import { activeRecord, getRecord, withDefaults } from '@/lib/server/book-records'

type Ctx = { params: Promise<{ id: string }> }

const checkId = (id: string) => {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new HttpError(400, 'Registro no válido.')
}

export const PATCH = handle<Ctx>(async (req, { params }) => {
  const ctx = await requireCtx()
  if (!ctx.canBook) throw new HttpError(403, 'Tu rol no permite editar el libro.')
  const { id } = await params
  checkId(id)
  const [current] = await db.select().from(birthRecord).where(activeRecord(id)).limit(1)
  if (!current) throw new HttpError(404, 'No encontramos el registro.')

  const b = await readJson<{ data?: unknown; episodeId?: unknown }>(req)
  const fields = await getBookFields()
  const { data, errors } = sanitizeData(b.data, fields, {
    materno: ctx.canEditMaternity,
    neonatal: ctx.canEditNeonatal,
  })
  if (errors.length) throw new HttpError(422, errors[0])
  await canonicalizeBookDoctors(data, fields)

  const set: Partial<typeof birthRecord.$inferInsert> = {}
  if (b.episodeId !== undefined) {
    if (b.episodeId === null || b.episodeId === '') {
      set.episodeId = null
    } else if (typeof b.episodeId === 'string') {
      assertEpisodeId(b.episodeId)
      const [ep] = await db.select({ id: episode.id }).from(episode).where(eq(episode.id, b.episodeId)).limit(1)
      if (!ep) throw new HttpError(404, 'No encontramos ese ingreso de UPC.')
      const [dup] = await db
        .select({ id: birthRecord.id })
        .from(birthRecord)
        .where(and(eq(birthRecord.episodeId, ep.id), isNull(birthRecord.deletedAt), ne(birthRecord.id, id)))
        .limit(1)
      if (dup) throw new HttpError(409, 'Ese recién nacido ya está vinculado a otra fila del libro.')
      set.episodeId = ep.id
    } else {
      throw new HttpError(400, 'Vínculo no válido.')
    }
  }
  const touchedNeonatal = fields.some((f) => f.section === 'neonatal' && f.key in data)
  const merged = withDefaults({ ...(current.data ?? {}), ...data }, fields, ctx, touchedNeonatal)
  if (Object.keys(data).length === 0 && Object.keys(set).length === 0) {
    throw new HttpError(400, 'No hay cambios que guardar.')
  }
  await db
    .update(birthRecord)
    .set({ ...set, data: merged, updatedAt: new Date(), updatedByName: ctx.name })
    .where(eq(birthRecord.id, id))
  const before = (current.data ?? {}) as Record<string, unknown>
  const changedLabels = Object.keys(data)
    .filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(merged[k] ?? null))
    .map((k) => fields.find((f) => f.key === k)?.label ?? k)
  const linkChanged = set.episodeId !== undefined && set.episodeId !== current.episodeId
  if (changedLabels.length > 0 || linkChanged) {
    const parts = [
      changedLabels.length ? `Campos: ${changedLabels.join(', ')}` : '',
      linkChanged ? (set.episodeId ? 'Vinculó ingreso de UPC' : 'Quitó vínculo con UPC') : '',
    ].filter(Boolean)
    await audit(ctx, 'modificar', 'libro', set.episodeId ?? current.episodeId, `Registro ${id.slice(0, 8)} · ${parts.join(' · ')}`)
  }
  return Response.json({ record: await getRecord(id, fields) })
})

/** Elimina de forma lógica: la fila queda guardada para auditoría. Solo Jefatura. */
export const DELETE = handle<Ctx>(async (_req, { params }) => {
  const ctx = await requireCtx('admin')
  const { id } = await params
  checkId(id)
  const [current] = await db.select({ id: birthRecord.id }).from(birthRecord).where(activeRecord(id)).limit(1)
  if (!current) throw new HttpError(404, 'No encontramos el registro.')
  await db.update(birthRecord).set({ deletedAt: new Date() }).where(eq(birthRecord.id, id))
  await audit(ctx, 'eliminar', 'libro', null, `Registro ${id.slice(0, 8)}`)
  return Response.json({ ok: true })
})
