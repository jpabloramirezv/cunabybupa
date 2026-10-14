import { eq, sql } from 'drizzle-orm'
import { assertEpisodeId, handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { explainChange } from '@/lib/audit-text'
import { ensureEpisode, parseUnit } from '@/lib/server/create-episode'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode, episodeBlock, episodeIdentity } from '@/lib/db/schema'
import { computeStatus } from '@/lib/rules'
import { MAX_REASON_LENGTH, MIN_REASON_LENGTH } from '@/lib/revisions'
import { diffEpisode, recordChanges } from '@/lib/server/revisions'
import { buildDetails, rowToCore } from '@/lib/server/episodes'
import { isBlock, parsePatch } from '@/lib/server/fields'
import { assertDoctorIds } from '@/lib/server/doctors'
import { shiftOf } from '@/lib/time'

type Params = { params: Promise<{ id: string }> }

export const GET = handle<Params>(async (_req, { params }) => {
  await requireCtx('clinical')
  const { id } = await params
  assertEpisodeId(id)
  const [row] = await db.select().from(episode).where(eq(episode.id, id)).limit(1)
  if (!row) throw new HttpError(404, 'No encontramos este registro.')
  const [detail] = await buildDetails([row])
  return Response.json(detail)
})

/** Guardado campo a campo. Si el registro no existe y el bloque es "ingreso", lo crea. */
export const PATCH = handle<Params>(async (req, { params }) => {
  const ctx = await requireCtx('write')
  const { id } = await params
  assertEpisodeId(id)
  const body = await readJson<{ block?: unknown; patch?: unknown; reason?: unknown }>(req)
  if (!isBlock(body.block)) throw new HttpError(400, 'Bloque no válido.')
  const block = body.block
  const values = parsePatch(block, body.patch)
  if (Array.isArray(values.medicoIds)) await assertDoctorIds(values.medicoIds as number[])
  const reason =
    typeof body.reason === 'string' ? body.reason.trim().slice(0, MAX_REASON_LENGTH) : ''

  const now = new Date()
  let [row] = await db.select().from(episode).where(eq(episode.id, id)).limit(1)
  let created = false
  if (!row) {
    if (block !== 'ingreso') throw new HttpError(404, 'No encontramos este registro.')
    ;({ row, created } = await ensureEpisode(id, ctx, now, parseUnit((body as { unit?: unknown }).unit)))
  } else if (row.status === 'cerrado' && !ctx.canAdmin) {
    throw new HttpError(403, 'Este registro está cerrado. Solo jefatura puede corregirlo.')
  } else if (row.status === 'cerrado' && reason.length < MIN_REASON_LENGTH) {
    throw new HttpError(422, 'Indica el motivo de la corrección para modificar un registro cerrado.')
  }
  const changes = await diffEpisode(block, row as unknown as Record<string, unknown>, values)

  const merged = { ...rowToCore(row), ...Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  ) }
  const [ident] = await db
    .select({ a: episodeIdentity.admissionNumber })
    .from(episodeIdentity)
    .where(eq(episodeIdentity.episodeId, id))
    .limit(1)
  const hasAdmission = !!ident?.a?.trim()
  const status = computeStatus(merged, hasAdmission)
  const ingresoComplete = status !== 'incompleto'

  await db
    .update(episode)
    .set({
      ...values,
      status,
      updatedAt: now,
      completedAt: ingresoComplete ? (row.completedAt ?? now) : null,
      completedShift: ingresoComplete
        ? (row.completedShift ?? shiftOf(now).key)
        : null,
    })
    .where(eq(episode.id, id))

  await db
    .insert(episodeBlock)
    .values({
      episodeId: id,
      block,
      staffId: ctx.staffId,
      staffName: ctx.name,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [episodeBlock.episodeId, episodeBlock.block],
      set: { staffId: ctx.staffId, staffName: ctx.name, updatedAt: now },
    })

  if (created) {
    await recordChanges(ctx, id, [
      { block, field: 'creacion', oldValue: null, newValue: 'Registro creado' },
    ])
  }
  await recordChanges(ctx, id, changes, reason)

  const [fresh] = await db.select().from(episode).where(eq(episode.id, id)).limit(1)
  const [detail] = await buildDetails([fresh])

  await audit(
    ctx,
    created ? 'crear' : 'modificar',
    block,
    id,
    explainChange({ block, code: detail.code, created, changes }),
  )
  return Response.json(detail)
})

export const dynamic = 'force-dynamic'
void sql
