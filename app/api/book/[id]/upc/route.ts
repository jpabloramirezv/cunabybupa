import { and, eq, isNull } from 'drizzle-orm'
import { handle, HttpError } from '@/lib/api'
import { audit } from '@/lib/audit'
import { linkCode } from '@/lib/book-flow'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord, catalogItem, episode, episodeBlock, episodeIdentity } from '@/lib/db/schema'
import { cleanRut, formatRut } from '@/lib/rut'
import { computeStatus } from '@/lib/rules'
import { shiftOf, TZ } from '@/lib/time'
import { ensureEpisode } from '@/lib/server/create-episode'
import { rowToCore } from '@/lib/server/episodes'
import { parsePatch } from '@/lib/server/fields'
import { activeRecord } from '@/lib/server/book-records'
import { diffEpisode, recordChanges } from '@/lib/server/revisions'

type Ctx = { params: Promise<{ id: string }> }

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const tzOffsetMs = (ts: number) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts))
  const p = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0)
  return Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'), p('second')) - ts
}

/** Fecha y hora escritas en el libro (hora de Chile) a instante UTC. */
function birthInstant(date: string, time: string | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const [h, mi] = /^(\d{2}):(\d{2})$/.test(time ?? '') ? (time as string).split(':').map(Number) : [0, 0]
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, mi)
  const first = guess - tzOffsetMs(guess)
  return new Date(guess - tzOffsetMs(first))
}

const SEX: Record<string, string> = { FEMENINO: 'F', MASCULINO: 'M', INDETERMINADO: 'I' }
const HIV: Record<string, string> = { NEGATIVO: 'negativo', POSITIVO: 'positivo' }

function deliveryOf(v: string | undefined) {
  const t = (v ?? '').toUpperCase()
  if (t.includes('CESÁREA') || t.includes('CESAREA')) return 'cesarea'
  if (t.includes('INSTRUMENTAL')) return 'instrumental'
  if (t.includes('VAGINAL')) return 'vaginal'
  return null
}

/**
 * Crea el ingreso de UPC de un RN que ya está en el Libro de Partos y lo vincula a esa fila.
 * Precarga solo los datos que la fila ya tiene; nunca pisa nada y no copia datos de contacto de la madre.
 */
export const POST = handle<Ctx>(async (_req, { params }) => {
  const ctx = await requireCtx('write')
  if (!ctx.canBook) throw new HttpError(403, 'Tu rol no permite usar el libro.')
  const { id } = await params
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new HttpError(400, 'Registro no válido.')

  const [rec] = await db.select().from(birthRecord).where(activeRecord(id)).limit(1)
  if (!rec) throw new HttpError(404, 'No encontramos el registro del libro.')
  if (rec.episodeId) return Response.json({ episodeId: rec.episodeId, created: false })

  const v = (rec.data ?? {}) as Record<string, string>
  if ((v.tipo_parto ?? '').toUpperCase() === 'ABORTO') {
    throw new HttpError(422, 'Un aborto no tiene ingreso de recién nacido.')
  }

  const now = new Date()
  const episodeId = crypto.randomUUID()
  const { row } = await ensureEpisode(episodeId, ctx, now, 'uci')

  // Vínculo condicional: si otra persona lo hizo primero, se descarta el ingreso recién creado.
  const linked = await db
    .update(birthRecord)
    .set({ episodeId, updatedAt: now, updatedByName: ctx.name })
    .where(and(eq(birthRecord.id, id), isNull(birthRecord.deletedAt), isNull(birthRecord.episodeId)))
    .returning({ id: birthRecord.id })
  if (linked.length === 0) {
    await db.delete(episode).where(eq(episode.id, episodeId))
    const [again] = await db.select({ e: birthRecord.episodeId }).from(birthRecord).where(eq(birthRecord.id, id)).limit(1)
    if (again?.e) return Response.json({ episodeId: again.e, created: false })
    throw new HttpError(409, 'Otra persona modificó este registro. Intenta de nuevo.')
  }

  const raw: Record<string, unknown> = {}
  const birth = v.fecha ? birthInstant(v.fecha, v.hora) : null
  if (birth) raw.birthAt = birth.toISOString()
  if (SEX[(v.sexo_rn ?? '').toUpperCase()]) raw.sex = SEX[v.sexo_rn.toUpperCase()]
  if (v.eg) raw.gaWeeks = v.eg
  if (v.peso) raw.birthWeightG = v.peso
  if (v.talla) raw.birthLengthCm = v.talla
  if (v.cc) raw.birthHeadCm = v.cc
  if (v.apgar1) raw.apgar1 = v.apgar1
  if (v.apgar5) raw.apgar5 = v.apgar5
  const delivery = deliveryOf(v.tipo_parto)
  if (delivery) raw.deliveryType = delivery
  if (HIV[(v.elisa_res ?? '').toUpperCase()]) raw.maternalHivResult = HIV[v.elisa_res.toUpperCase()]

  const prevision = v.prevision_rn || v.prevision
  if (prevision) {
    const items = await db
      .select({ id: catalogItem.id, label: catalogItem.label })
      .from(catalogItem)
      .where(eq(catalogItem.kind, 'prevision'))
    const hit = items.find((i) => fold(i.label) === fold(prevision))
    if (hit) raw.previsionId = hit.id
  }

  // Cada dato se valida por separado: un valor imposible del libro no debe impedir el ingreso.
  const values: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(raw)) {
    try {
      Object.assign(values, parsePatch('ingreso', { [k]: val }))
    } catch {
      continue
    }
  }

  const surnames = [v.ap_paterno_rn, v.ap_materno_rn].map((s) => (s ?? '').trim()).filter(Boolean)
  const identity: Record<string, string> = {}
  if (surnames.length > 0) identity.patientName = `RN ${surnames.join(' ')}`.slice(0, 120)
  if (v.run_rn?.trim()) identity.rut = formatRut(cleanRut(v.run_rn)).slice(0, 120)
  if (v.rn_episodio?.trim()) identity.admissionNumber = v.rn_episodio.trim().slice(0, 120)

  const changes = await diffEpisode('ingreso', row as unknown as Record<string, unknown>, values)
  const core = {
    ...rowToCore(row),
    ...Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x instanceof Date ? x.toISOString() : x])),
  }
  const status = computeStatus(core, !!identity.admissionNumber)
  const complete = status !== 'incompleto'
  await db
    .update(episode)
    .set({
      ...values,
      status,
      updatedAt: now,
      completedAt: complete ? now : null,
      completedShift: complete ? shiftOf(now).key : null,
    })
    .where(eq(episode.id, episodeId))

  if (Object.keys(identity).length > 0) {
    const set = { ...identity, updatedAt: now, updatedBy: ctx.staffId }
    await db
      .insert(episodeIdentity)
      .values({ episodeId, ...set })
      .onConflictDoUpdate({ target: episodeIdentity.episodeId, set })
    await db
      .insert(episodeBlock)
      .values({ episodeId, block: 'identidad', staffId: ctx.staffId, staffName: ctx.name, updatedAt: now })
      .onConflictDoNothing()
  }
  await db
    .insert(episodeBlock)
    .values({ episodeId, block: 'ingreso', staffId: ctx.staffId, staffName: ctx.name, updatedAt: now })
    .onConflictDoNothing()

  await recordChanges(ctx, episodeId, [
    {
      block: 'ingreso',
      field: 'creacion',
      oldValue: null,
      newValue: `Creado desde el Libro de Partos (${linkCode(rec.seq)})`,
    },
    ...changes,
    ...Object.keys(identity).map((field) => ({
      block: 'identidad',
      field,
      oldValue: null,
      newValue: null,
      sensitive: true,
    })),
  ])
  await audit(
    ctx,
    'crear',
    'ingreso',
    episodeId,
    `Ingreso de UPC creado desde la fila ${linkCode(rec.seq)} del Libro de Partos`,
  )
  return Response.json({ episodeId, created: true })
})
