import { and, eq } from 'drizzle-orm'
import { MAX_REASON_LENGTH } from '@/lib/revisions'
import { recordChanges, screeningStatusLabel, type Change } from '@/lib/server/revisions'
import { assertEpisodeId, handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { explainChange } from '@/lib/audit-text'
import { BCG_HIV_POSITIVE_MESSAGE, episodeCode, isBcgKind } from '@/lib/rules'
import { PEA_RESULTS, SCREENING_KINDS, SCREENING_STATUS, screeningKindLabel, TZ } from '@/lib/config'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode, episodeBlock, screening } from '@/lib/db/schema'

type Params = { params: Promise<{ id: string }> }

export const PATCH = handle<Params>(async (req, { params }) => {
  const ctx = await requireCtx('write')
  const { id } = await params
  assertEpisodeId(id)
  const body = await readJson<Record<string, unknown>>(req)
  const [ep] = await db
    .select({ id: episode.id, maternalHivResult: episode.maternalHivResult })
    .from(episode).where(eq(episode.id, id)).limit(1)
  if (!ep) throw new HttpError(404, 'No encontramos este registro.')

  const { reason: rawReason, ...rest } = body
  const reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, MAX_REASON_LENGTH) : ''
  const isExtra = (k: string) => k.includes(':')
  const entries = Object.entries(rest).filter(([k]) => !isExtra(k))
  const parseDate = (raw: unknown, allowFuture: boolean): Date | null => {
    if (raw === null || raw === '') return null
    const d = new Date(String(raw))
    if (Number.isNaN(d.getTime()) || (!allowFuture && d.getTime() > Date.now() + 24 * 3600 * 1000)) {
      throw new HttpError(400, 'La fecha del tamizaje no es válida.')
    }
    return d
  }
  const dates = new Map<string, Date | null>()
  const dates2 = new Map<string, Date | null>()
  const cited = new Map<string, Date | null>()
  const lots = new Map<string, string | null>()
  const results = new Map<string, string | null>()
  const preDuctals = new Map<string, number | null>()
  const postDuctals = new Map<string, number | null>()
  const parseSat = (raw: unknown): number | null => {
    if (raw === null || raw === '' || raw === undefined) return null
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      throw new HttpError(400, 'La saturación debe ser un número entero entre 0 y 100.')
    }
    return n
  }
  for (const [key, raw] of Object.entries(rest)) {
    const [prefix, kind] = key.split(':')
    if (!kind) continue
    if (prefix === 'preductal') preDuctals.set(kind, parseSat(raw))
    else if (prefix === 'postductal') postDuctals.set(kind, parseSat(raw))
    else if (prefix === 'fecha') dates.set(kind, parseDate(raw, false))
    else if (prefix === 'fecha2') dates2.set(kind, parseDate(raw, false))
    else if (prefix === 'cita') cited.set(kind, parseDate(raw, true))
    else if (prefix === 'lote') {
      const v = typeof raw === 'string' ? raw.trim().slice(0, 40) : ''
      lots.set(kind, v || null)
    } else if (prefix === 'resultado') {
      const v = typeof raw === 'string' && raw ? raw : null
      if (v && !PEA_RESULTS.some((r) => r.value === v)) throw new HttpError(400, 'Resultado no válido.')
      results.set(kind, v)
    } else throw new HttpError(400, 'Dato de tamizaje no válido.')
  }
  const kinds = [
    ...new Set([
      ...entries.map(([k]) => k),
      ...dates.keys(),
      ...dates2.keys(),
      ...cited.keys(),
      ...lots.keys(),
      ...results.keys(),
      ...preDuctals.keys(),
      ...postDuctals.keys(),
    ]),
  ]
  if (kinds.length === 0) throw new HttpError(400, 'No hay cambios que guardar.')
  const now = new Date()
  const changes: Change[] = []
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString('es-CL', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin fecha'
  for (const kind of kinds) {
    if (!SCREENING_KINDS.some((k) => k.key === kind)) throw new HttpError(400, 'Tamizaje no válido.')
    const sent = entries.find(([k]) => k === kind)?.[1]
    if (sent !== undefined && !SCREENING_STATUS.some((s) => s.key === sent)) {
      throw new HttpError(400, 'Estado no válido.')
    }
    const [prev] = await db
      .select({
        status: screening.status,
        doneAt: screening.doneAt,
        doneAt2: screening.doneAt2,
        citedAt: screening.citedAt,
        lot: screening.lot,
        result: screening.result,
        preDuctal: screening.preDuctal,
        postDuctal: screening.postDuctal,
      })
      .from(screening)
      .where(and(eq(screening.episodeId, id), eq(screening.kind, kind)))
      .limit(1)
    const before = prev?.status ?? 'pendiente'
    const status = (sent as string | undefined) ?? before
    if (isBcgKind(kind) && status === 'realizado' && before !== 'realizado' && ep.maternalHivResult === 'positivo') {
      throw new HttpError(422, BCG_HIV_POSITIVE_MESSAGE)
    }
    const done = status === 'realizado' || status === 'rechazado'
    let doneAt: Date | null = null
    if (done) {
      if (dates.has(kind) && dates.get(kind)) doneAt = dates.get(kind) ?? now
      else doneAt = prev?.doneAt && (before === 'realizado' || before === 'rechazado') ? prev.doneAt : now
    }
    if (before !== status) {
      changes.push({
        block: 'tamizaje',
        field: `tamizaje:${kind}`,
        oldValue: screeningStatusLabel(before),
        newValue: screeningStatusLabel(status),
      })
    } else if (done && prev?.doneAt?.getTime() !== doneAt?.getTime()) {
      changes.push({
        block: 'tamizaje',
        field: `tamizaje:${kind}`,
        oldValue: `Fecha ${fmt(prev?.doneAt ?? null)}`,
        newValue: `Fecha ${fmt(doneAt)}`,
      })
    }
    const label = screeningKindLabel(kind)
    const doneAt2 = dates2.has(kind) ? (dates2.get(kind) ?? null) : (prev?.doneAt2 ?? null)
    const citedAt = cited.has(kind) ? (cited.get(kind) ?? null) : (prev?.citedAt ?? null)
    const lot = lots.has(kind) ? (lots.get(kind) ?? null) : (prev?.lot ?? null)
    const result = results.has(kind) ? (results.get(kind) ?? null) : (prev?.result ?? null)
    if (doneAt2?.getTime() !== (prev?.doneAt2?.getTime() ?? undefined) && (dates2.has(kind) || prev?.doneAt2)) {
      changes.push({
        block: 'tamizaje',
        field: `tamizaje:${kind}`,
        oldValue: `Segunda toma ${fmt(prev?.doneAt2 ?? null)}`,
        newValue: `Segunda toma ${fmt(doneAt2)}`,
      })
    }
    if (cited.has(kind) && citedAt?.getTime() !== prev?.citedAt?.getTime()) {
      changes.push({
        block: 'tamizaje',
        field: `tamizaje:${kind}`,
        oldValue: `Cita ${fmt(prev?.citedAt ?? null)}`,
        newValue: `Cita ${fmt(citedAt)}`,
      })
    }
    if (lots.has(kind) && lot !== (prev?.lot ?? null)) {
      changes.push({
        block: 'tamizaje',
        field: `tamizaje:${kind}`,
        oldValue: `Lote ${prev?.lot ?? 'sin dato'}`,
        newValue: `Lote ${lot ?? 'sin dato'}`,
      })
    }
    if (results.has(kind) && result !== (prev?.result ?? null)) {
      const name = (v: string | null) => PEA_RESULTS.find((r) => r.value === v)?.label ?? 'Sin resultado'
      changes.push({
        block: 'tamizaje',
        field: `tamizaje:${kind}`,
        oldValue: `Resultado ${label}: ${name(prev?.result ?? null)}`,
        newValue: `Resultado ${label}: ${name(result)}`,
      })
    }
    const preDuctal = preDuctals.has(kind) ? (preDuctals.get(kind) ?? null) : (prev?.preDuctal ?? null)
    const postDuctal = postDuctals.has(kind) ? (postDuctals.get(kind) ?? null) : (prev?.postDuctal ?? null)
    if (preDuctals.has(kind) && preDuctal !== (prev?.preDuctal ?? null)) {
      changes.push({
        block: 'tamizaje',
        field: `tamizaje:${kind}`,
        oldValue: `Pre ductal ${prev?.preDuctal ?? 'sin dato'}`,
        newValue: `Pre ductal ${preDuctal ?? 'sin dato'}`,
      })
    }
    if (postDuctals.has(kind) && postDuctal !== (prev?.postDuctal ?? null)) {
      changes.push({
        block: 'tamizaje',
        field: `tamizaje:${kind}`,
        oldValue: `Post ductal ${prev?.postDuctal ?? 'sin dato'}`,
        newValue: `Post ductal ${postDuctal ?? 'sin dato'}`,
      })
    }
    const values = {
      status,
      doneAt,
      doneAt2,
      citedAt,
      lot,
      result,
      preDuctal,
      postDuctal,
      updatedBy: ctx.staffId,
      updatedByName: ctx.name,
      updatedAt: now,
    }
    await db
      .insert(screening)
      .values({ episodeId: id, kind, ...values })
      .onConflictDoUpdate({ target: [screening.episodeId, screening.kind], set: values })
  }
  await db
    .insert(episodeBlock)
    .values({ episodeId: id, block: 'seguimiento', staffId: ctx.staffId, staffName: ctx.name, updatedAt: now })
    .onConflictDoUpdate({
      target: [episodeBlock.episodeId, episodeBlock.block],
      set: { staffId: ctx.staffId, staffName: ctx.name, updatedAt: now },
    })
  await db.update(episode).set({ updatedAt: now }).where(eq(episode.id, id))
  await recordChanges(ctx, id, changes, reason)
  const [epRow] = await db.select({ seq: episode.seq }).from(episode).where(eq(episode.id, id)).limit(1)
  if (changes.length > 0) {
    await audit(
      ctx,
      'modificar',
      'seguimiento',
      id,
      explainChange({
        block: 'seguimiento',
        code: epRow ? episodeCode(epRow.seq) : null,
        created: false,
        changes,
      }),
    )
  }
  return Response.json({ ok: true })
})
