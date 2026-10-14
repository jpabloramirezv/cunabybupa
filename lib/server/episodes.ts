import { and, eq, inArray, lt, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  appSetting,
  auditLog,
  episode,
  episodeBlock,
  episodeIdentity,
  screening,
} from '@/lib/db/schema'
import {
  DEFAULT_CONTACT_RETENTION_DAYS,
  OVERDUE_HOURS,
  SCREENING_KINDS,
} from '@/lib/config'
import {
  computeStatus,
  episodeCode,
  episodeWarnings,
  missingAlta,
  missingDocuments,
  missingIngreso,
  screeningIssues,
  type EpisodeCore,
} from '@/lib/rules'
import type { EpisodeDetail, ScreeningRow } from '@/lib/types'

export type EpisodeRow = typeof episode.$inferSelect

const iso = (d: Date | null) => (d ? d.toISOString() : null)

export function rowToCore(r: EpisodeRow): EpisodeCore {
  return {
    gaWeeks: r.gaWeeks,
    gaDays: r.gaDays,
    birthWeightG: r.birthWeightG,
    apgar1: r.apgar1,
    apgar5: r.apgar5,
    apgar10: r.apgar10,
    birthLengthCm: r.birthLengthCm,
    birthHeadCm: r.birthHeadCm,
    docUrgencyLaw: r.docUrgencyLaw,
    docConsentAdmission: r.docConsentAdmission,
    docConsentMila: r.docConsentMila,
    maternalHivResult: r.maternalHivResult,
    maternalHivAt: iso(r.maternalHivAt),
    sex: r.sex,
    deliveryType: r.deliveryType,
    birthAt: iso(r.birthAt),
    previsionId: r.previsionId,
    procedimientoId: r.procedimientoId,
    dxIngresoId: r.dxIngresoId,
    dxIngresoIds: r.dxIngresoIds?.length ? r.dxIngresoIds : r.dxIngresoId != null ? [r.dxIngresoId] : [],
    medicoId: r.medicoId,
    medicoIds: r.medicoIds?.length ? r.medicoIds : r.medicoId != null ? [r.medicoId] : [],
    admissionAt: iso(r.admissionAt ?? r.createdAt),
    careLevel: r.careLevel,
    transferOrigin: r.transferOrigin,
    gesNotified: r.gesNotified,
    gesNotifiedAt: iso(r.gesNotifiedAt),
    hyperbili: r.hyperbili,
    phototherapyAt: iso(r.phototherapyAt),
    dischargeAt: iso(r.dischargeAt),
    dischargeWeightG: r.dischargeWeightG,
    dxEgresoId: r.dxEgresoId,
    dxEgresoIds: r.dxEgresoIds?.length ? r.dxEgresoIds : r.dxEgresoId != null ? [r.dxEgresoId] : [],
    destinoId: r.destinoId,
    feedingDischarge: r.feedingDischarge,
    altaConfirmedAt: iso(r.altaConfirmedAt),
  }
}

export async function buildDetails(rows: EpisodeRow[]): Promise<EpisodeDetail[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const [blocks, scr, idents] = await Promise.all([
    db.select().from(episodeBlock).where(inArray(episodeBlock.episodeId, ids)),
    db.select().from(screening).where(inArray(screening.episodeId, ids)),
    db
      .select({
        episodeId: episodeIdentity.episodeId,
        admissionNumber: episodeIdentity.admissionNumber,
      })
      .from(episodeIdentity)
      .where(inArray(episodeIdentity.episodeId, ids)),
  ])
  const now = Date.now()
  return rows.map((r) => {
    const core = rowToCore(r)
    const hasAdmission = !!idents
      .find((i) => i.episodeId === r.id)
      ?.admissionNumber?.trim()
    const mine = scr.filter((s) => s.episodeId === r.id)
    const screenings: ScreeningRow[] = SCREENING_KINDS.map((k) => {
      const row = mine.find((m) => m.kind === k.key)
      return {
        kind: k.key,
        status: row?.status ?? 'pendiente',
        doneAt: iso(row?.doneAt ?? null),
        doneAt2: iso(row?.doneAt2 ?? null),
        citedAt: iso(row?.citedAt ?? null),
        lot: row?.lot ?? null,
        result: row?.result ?? null,
        preDuctal: row?.preDuctal ?? null,
        postDuctal: row?.postDuctal ?? null,
        updatedByName: row?.updatedByName ?? null,
        updatedAt: iso(row?.updatedAt ?? null),
      }
    })
    const pendingKinds = screenings
      .filter((s) => s.status === 'pendiente')
      .map((s) => s.kind)
    const issues = screeningIssues(core, screenings)
    const ref = (r.birthAt ?? r.createdAt).getTime()
    const overdueKinds =
      !r.altaConfirmedAt && now - ref > OVERDUE_HOURS * 3600_000 ? pendingKinds : []
    const altaStarted = !!(
      core.dischargeAt ||
      core.dischargeWeightG ||
      core.dxEgresoId ||
      core.destinoId ||
      core.feedingDischarge
    )
    return {
      ...core,
      id: r.id,
      seq: r.seq,
      code: episodeCode(r.seq),
      status: computeStatus(core, hasAdmission),
      unit: r.unit === 'nursery' ? 'nursery' : 'uci',
      readmissionOf: r.readmissionOf,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      completedAt: iso(r.completedAt),
      createdShift: r.createdShift,
      completedShift: r.completedShift,
      hasAdmission,
      missing: missingIngreso(core, hasAdmission),
      altaMissing: missingAlta(core),
      altaStarted,
      warnings: episodeWarnings(core),
      blocks: blocks
        .filter((b) => b.episodeId === r.id)
        .map((b) => ({
          block: b.block,
          staffName: b.staffName,
          updatedAt: b.updatedAt.toISOString(),
        })),
      screenings,
      pendingKinds,
      overdueKinds,
      screeningIssues: issues,
      docsMissing: missingDocuments(core),
    }
  })
}

/** Suma los datos de identificación para que quienes tienen permiso puedan buscarlos en los listados. */
export async function attachIdentity(details: EpisodeDetail[]): Promise<EpisodeDetail[]> {
  if (details.length === 0) return details
  const rows = await db
    .select({
      episodeId: episodeIdentity.episodeId,
      patientName: episodeIdentity.patientName,
      rut: episodeIdentity.rut,
      admissionNumber: episodeIdentity.admissionNumber,
      motherName: episodeIdentity.motherName,
      motherPhone: episodeIdentity.motherPhone,
    })
    .from(episodeIdentity)
    .where(
      inArray(
        episodeIdentity.episodeId,
        details.map((d) => d.id),
      ),
    )
  const byId = new Map(rows.map((r) => [r.episodeId, r]))
  return details.map((d) => {
    const r = byId.get(d.id)
    return r
      ? {
          ...d,
          identity: {
            patientName: r.patientName,
            rut: r.rut,
            admissionNumber: r.admissionNumber,
            motherName: r.motherName,
            motherPhone: r.motherPhone,
          },
        }
      : d
  })
}

export async function getContactRetentionDays(): Promise<number> {
  const [row] = await db
    .select()
    .from(appSetting)
    .where(eq(appSetting.key, 'contact_retention_days'))
    .limit(1)
  const n = row ? Number(row.value) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CONTACT_RETENTION_DAYS
}

/** Borra el contacto materno cuyo plazo venció. Deja constancia en la auditoría. */
export async function purgeExpiredContacts() {
  const expired = await db
    .select({ episodeId: episodeIdentity.episodeId })
    .from(episodeIdentity)
    .where(
      and(
        isNotNull(episodeIdentity.contactDeleteAt),
        lt(episodeIdentity.contactDeleteAt, new Date()),
      ),
    )
  if (expired.length === 0) return
  const ids = expired.map((e) => e.episodeId)
  await db
    .update(episodeIdentity)
    .set({
      motherName: null,
      motherPhone: null,
      contactReason: null,
      contactConsent: false,
      contactDeleteAt: null,
      updatedAt: new Date(),
    })
    .where(inArray(episodeIdentity.episodeId, ids))
  await db.insert(auditLog).values(
    ids.map((id) => ({
      staffId: null,
      staffName: 'Sistema',
      action: 'eliminar',
      block: 'identidad',
      episodeId: id,
      detail: 'Contacto materno eliminado al vencer el plazo',
    })),
  )
}

/** Si el mismo RUT tuvo un alta en los 30 días previos, marca el reingreso. */
export async function linkReadmission(episodeId: string) {
  const [ident] = await db
    .select({ rut: episodeIdentity.rut })
    .from(episodeIdentity)
    .where(eq(episodeIdentity.episodeId, episodeId))
    .limit(1)
  if (!ident?.rut) {
    await db.update(episode).set({ readmissionOf: null }).where(eq(episode.id, episodeId))
    return
  }
  const [self] = await db.select().from(episode).where(eq(episode.id, episodeId)).limit(1)
  if (!self) return
  const same = await db
    .select({ id: episodeIdentity.episodeId })
    .from(episodeIdentity)
    .where(eq(episodeIdentity.rut, ident.rut))
  const otherIds = same.map((s) => s.id).filter((id) => id !== episodeId)
  if (otherIds.length === 0) {
    await db.update(episode).set({ readmissionOf: null }).where(eq(episode.id, episodeId))
    return
  }
  const others = await db.select().from(episode).where(inArray(episode.id, otherIds))
  const refTime = (self.birthAt ?? self.createdAt).getTime()
  const prev = others
    .filter((o) => o.dischargeAt && o.dischargeAt.getTime() <= self.createdAt.getTime())
    .filter((o) => refTime - o.dischargeAt!.getTime() <= 30 * 86400_000)
    .sort((a, b) => b.dischargeAt!.getTime() - a.dischargeAt!.getTime())[0]
  await db
    .update(episode)
    .set({ readmissionOf: prev?.id ?? null })
    .where(eq(episode.id, episodeId))
}
