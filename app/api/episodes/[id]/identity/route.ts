import { eq } from 'drizzle-orm'
import { assertEpisodeId, handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { explainChange } from '@/lib/audit-text'
import { ensureEpisode } from '@/lib/server/create-episode'
import { CONTACT_REASONS } from '@/lib/config'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode, episodeBlock, episodeIdentity } from '@/lib/db/schema'
import { cleanRut, formatRut } from '@/lib/rut'
import { computeStatus, episodeCode } from '@/lib/rules'
import { MAX_REASON_LENGTH } from '@/lib/revisions'
import { recordChanges } from '@/lib/server/revisions'
import {
  getContactRetentionDays,
  linkReadmission,
  purgeExpiredContacts,
  rowToCore,
} from '@/lib/server/episodes'
import type { IdentityPayload } from '@/lib/types'
import { shiftOf } from '@/lib/time'

type Params = { params: Promise<{ id: string }> }

const empty: IdentityPayload = {
  patientName: null,
  rut: null,
  admissionNumber: null,
  motherName: null,
  motherPhone: null,
  contactReason: null,
  contactConsent: false,
  contactDeleteAt: null,
}

export const GET = handle<Params>(async (_req, { params }) => {
  const ctx = await requireCtx('identity')
  const { id } = await params
  assertEpisodeId(id)
  await purgeExpiredContacts()
  const [row] = await db.select().from(episodeIdentity).where(eq(episodeIdentity.episodeId, id)).limit(1)
  await audit(ctx, 'leer', 'identidad', id)
  if (!row) return Response.json(empty)
  const payload: IdentityPayload = {
    patientName: row.patientName,
    rut: row.rut,
    admissionNumber: row.admissionNumber,
    motherName: row.motherName,
    motherPhone: row.motherPhone,
    contactReason: row.contactReason,
    contactConsent: row.contactConsent,
    contactDeleteAt: row.contactDeleteAt?.toISOString() ?? null,
  }
  return Response.json(payload)
})

const TEXT_FIELDS = ['patientName', 'rut', 'admissionNumber', 'motherName', 'motherPhone'] as const

export const PATCH = handle<Params>(async (req, { params }) => {
  const ctx = await requireCtx('identity')
  const { id } = await params
  assertEpisodeId(id)
  const body = await readJson<Record<string, unknown>>(req)

  const { created } = await ensureEpisode(id, ctx)
  if (created) {
    await recordChanges(ctx, id, [
      { block: 'identidad', field: 'creacion', oldValue: null, newValue: 'Registro creado' },
    ])
  }

  const [current] = await db.select().from(episodeIdentity).where(eq(episodeIdentity.episodeId, id)).limit(1)
  const next: Record<string, unknown> = {}

  for (const key of TEXT_FIELDS) {
    if (!(key in body)) continue
    const v = body[key]
    if (v === null || v === '') {
      next[key] = null
      continue
    }
    if (typeof v !== 'string' || v.length > 120) throw new HttpError(400, 'Un dato de identificación no es válido.')
    next[key] = key === 'rut' ? formatRut(cleanRut(v)) : v.trim()
  }
  if ('contactReason' in body) {
    const v = body.contactReason
    if (v === null || v === '') next.contactReason = null
    else if (typeof v === 'string' && CONTACT_REASONS.some((r) => r.value === v)) next.contactReason = v
    else throw new HttpError(400, 'El motivo de contacto no es válido.')
  }
  if ('contactConsent' in body) {
    if (typeof body.contactConsent !== 'boolean') throw new HttpError(400, 'El consentimiento no es válido.')
    next.contactConsent = body.contactConsent
  }

  const consent = (next.contactConsent ?? current?.contactConsent ?? false) as boolean
  const reason = ('contactReason' in next ? next.contactReason : current?.contactReason) as string | null
  const touchesContact = 'motherName' in next || 'motherPhone' in next
  if (!consent) {
    next.motherName = null
    next.motherPhone = null
    next.contactReason = null
    next.contactDeleteAt = null
  } else {
    if (touchesContact && (next.motherName || next.motherPhone) && !reason) {
      throw new HttpError(422, 'Selecciona el motivo antes de guardar el contacto materno.')
    }
    const hasContact = (next.motherName ?? current?.motherName) || (next.motherPhone ?? current?.motherPhone)
    if (hasContact && !current?.contactDeleteAt) {
      const days = await getContactRetentionDays()
      next.contactDeleteAt = new Date(Date.now() + days * 86400_000)
    }
  }

  const now = new Date()
  const values = { ...next, updatedAt: now, updatedBy: ctx.staffId }
  await db
    .insert(episodeIdentity)
    .values({ episodeId: id, ...values })
    .onConflictDoUpdate({ target: episodeIdentity.episodeId, set: values })

  await db
    .insert(episodeBlock)
    .values({ episodeId: id, block: 'identidad', staffId: ctx.staffId, staffName: ctx.name, updatedAt: now })
    .onConflictDoUpdate({
      target: [episodeBlock.episodeId, episodeBlock.block],
      set: { staffId: ctx.staffId, staffName: ctx.name, updatedAt: now },
    })

  if ('rut' in next) await linkReadmission(id)

  const [after] = await db.select().from(episodeIdentity).where(eq(episodeIdentity.episodeId, id)).limit(1)
  const [fresh] = await db.select().from(episode).where(eq(episode.id, id)).limit(1)
  const status = computeStatus(rowToCore(fresh), !!after?.admissionNumber?.trim())
  const complete = status !== 'incompleto'
  await db
    .update(episode)
    .set({
      status,
      updatedAt: now,
      completedAt: complete ? (fresh.completedAt ?? now) : null,
      completedShift: complete ? (fresh.completedShift ?? shiftOf(now).key) : null,
    })
    .where(eq(episode.id, id))

  const changeReason = typeof body.reason === 'string' ? body.reason.trim().slice(0, MAX_REASON_LENGTH) : ''
  const currentRow = (current ?? {}) as Record<string, unknown>
  const touched = Object.keys(next).filter((k) => {
    if (k === 'contactDeleteAt' || k === 'updatedAt') return false
    const a = currentRow[k] ?? null
    const b = next[k] ?? null
    return a !== b
  })
  await recordChanges(
    ctx,
    id,
    touched.map((field) => ({ block: 'identidad', field, oldValue: null, newValue: null, sensitive: true })),
    changeReason,
  )

  await audit(
    ctx,
    created ? 'crear' : current ? 'modificar' : 'crear',
    'identidad',
    id,
    explainChange({
      block: 'identidad',
      code: episodeCode(fresh.seq),
      created,
      changes: touched.map((field) => ({ field, oldValue: null, newValue: null, sensitive: true })),
    }),
  )
  return Response.json({ ok: true, contactDeleteAt: after?.contactDeleteAt?.toISOString() ?? null })
})
