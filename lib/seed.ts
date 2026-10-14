import { randomUUID } from 'node:crypto'
import { count, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { UNIT_EMAIL } from '@/lib/config'
import { db } from '@/lib/db'
import {
  appSetting,
  catalogItem,
  diagnosis,
  episode,
  episodeBlock,
  episodeIdentity,
  screening,
  staff,
  user,
} from '@/lib/db/schema'
import { hashPin } from '@/lib/pin'
import { formatRut, rutDv } from '@/lib/rut'
import { computeStatus, type EpisodeCore } from '@/lib/rules'
import {
  DEMO_PASSWORD,
  DEMO_STAFF,
  SEED_CATALOG,
  SEED_DIAGNOSES,
} from '@/lib/seed-data'
import { shiftOf } from '@/lib/time'

let ready: Promise<void> | null = null

/** Deja lista la cuenta de la unidad, el personal, los catálogos y los datos ficticios. */
export function ensureDemo() {
  ready ??= run().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

const H = 3600_000

type Spec = {
  h: number
  ga: number
  gd: number
  w: number
  a1: number
  a5: number
  sex: 'F' | 'M'
  del: 'vaginal' | 'cesarea' | 'instrumental'
  prev?: string
  proc?: string
  dx?: string
  med?: string
  adm?: boolean
  noBirth?: boolean
  name: string
  rutBody: number
  bili?: number
  cmpH?: number
  scr?: Record<string, string>
  contact?: boolean
  alta?: {
    losDays: number
    wt: number
    dxEg: string
    dest: string
    feed: string
  }
  altaPartial?: boolean
  readmitOfIdx?: number
}

const ALL_DONE = {
  PKU: 'realizado',
  TSH: 'realizado',
  PEA: 'realizado',
  VHB: 'realizado',
  BCG: 'realizado',
  VIH: 'realizado',
  Nirsevimab: 'no_aplica',
}

const SPECS: Spec[] = [
  { h: 6, ga: 29, gd: 3, w: 1180, a1: 6, a5: 8, sex: 'F', del: 'cesarea', prev: 'Fonasa tramo B', proc: 'CPAP', dx: 'P22.0', med: 'Dr. Rodrigo Muñoz', adm: true, name: 'RN de Valentina Prueba', rutBody: 26100101, scr: { VHB: 'realizado' } },
  { h: 20, ga: 34, gd: 0, w: 2050, a1: 7, a5: 9, sex: 'M', del: 'vaginal', name: 'RN de Camila Ejemplo', rutBody: 26100202, noBirth: true },
  { h: 55, ga: 26, gd: 5, w: 840, a1: 4, a5: 7, sex: 'M', del: 'cesarea', prev: 'Fonasa tramo A', proc: 'Ventilación mecánica', dx: 'P07.2', med: 'Dra. Francisca Lagos', adm: true, name: 'RN de Javiera Demo', rutBody: 26100303, bili: 30, scr: { VHB: 'realizado' } },
  { h: 3, ga: 38, gd: 2, w: 3300, a1: 8, a5: 9, sex: 'F', del: 'vaginal', name: 'RN de Fernanda Muestra', rutBody: 26100404, noBirth: true },
  { h: 80, ga: 32, gd: 1, w: 1720, a1: 7, a5: 8, sex: 'F', del: 'instrumental', prev: 'Isapre', proc: 'Fototerapia', dx: 'P59.9', med: 'Dr. Andrés Salinas', adm: true, name: 'RN de Paula Ficticia', rutBody: 26100505, bili: 20, scr: { PKU: 'realizado', TSH: 'realizado', PEA: 'rechazado', VHB: 'realizado' } },
  { h: 30, ga: 36, gd: 4, w: 2600, a1: 9, a5: 9, sex: 'M', del: 'cesarea', prev: 'Particular', proc: 'Observación sin procedimiento', dx: 'P22.1', med: 'Dra. Valentina Cortés', adm: true, name: 'RN de Andrea Simulada', rutBody: 26100606, cmpH: 5, scr: { PKU: 'realizado' } },
  { h: 10, ga: 30, gd: 0, w: 1350, a1: 5, a5: 8, sex: 'F', del: 'cesarea', prev: 'Fonasa tramo C', proc: 'CPAP', dx: 'P07.1', name: 'RN de Lorena Inventada', rutBody: 26100707 },
  { h: 100, ga: 33, gd: 2, w: 1900, a1: 6, a5: 8, sex: 'M', del: 'vaginal', prev: 'Fonasa tramo B', proc: 'Cánula nasal de alto flujo', dx: 'P07.3', med: 'Dr. Rodrigo Muñoz', adm: true, name: 'RN de Natalia Ensayo', rutBody: 26100808, altaPartial: true, scr: { PKU: 'realizado', TSH: 'realizado', VHB: 'realizado', BCG: 'realizado' } },
  { h: 24 * 20, ga: 38, gd: 0, w: 3100, a1: 8, a5: 9, sex: 'F', del: 'vaginal', prev: 'Fonasa tramo A', proc: 'Fototerapia', dx: 'P59.9', med: 'Dra. Francisca Lagos', adm: true, name: 'RN de Carolina Piloto', rutBody: 26200909, bili: 14, scr: ALL_DONE, contact: true, alta: { losDays: 5, wt: 3050, dxEg: 'P59.9', dest: 'Domicilio', feed: 'exclusiva' } },
  { h: 24 * 29, ga: 29, gd: 0, w: 1250, a1: 5, a5: 8, sex: 'M', del: 'cesarea', prev: 'Isapre', proc: 'Ventilación mecánica', dx: 'P22.0', med: 'Dr. Andrés Salinas', adm: true, name: 'RN de Daniela Maqueta', rutBody: 26201010, cmpH: 30, scr: ALL_DONE, alta: { losDays: 25, wt: 2150, dxEg: 'P27.1', dest: 'Domicilio', feed: 'mixta' } },
  { h: 24 * 18, ga: 35, gd: 2, w: 2300, a1: 7, a5: 9, sex: 'F', del: 'cesarea', prev: 'Fonasa tramo D', proc: 'CPAP', dx: 'P22.1', med: 'Dra. Valentina Cortés', adm: true, name: 'RN de Mónica Borrador', rutBody: 26201111, scr: { ...ALL_DONE, BCG: 'pendiente' }, alta: { losDays: 9, wt: 2380, dxEg: 'P07.3', dest: 'Domicilio', feed: 'mixta' } },
  { h: 24 * 15, ga: 39, gd: 1, w: 3500, a1: 9, a5: 10, sex: 'M', del: 'vaginal', prev: 'Fonasa tramo B', proc: 'Observación sin procedimiento', dx: 'P24.0', med: 'Dr. Rodrigo Muñoz', adm: true, name: 'RN de Patricia Esquema', rutBody: 26201212, scr: ALL_DONE, alta: { losDays: 4, wt: 3420, dxEg: 'P24.0', dest: 'Domicilio', feed: 'exclusiva' } },
  { h: 24 * 12, ga: 31, gd: 5, w: 1650, a1: 6, a5: 8, sex: 'F', del: 'instrumental', prev: 'Isapre', proc: 'Cánula nasal de alto flujo', dx: 'P07.3', med: 'Dra. Francisca Lagos', adm: true, name: 'RN de Gabriela Plantilla', rutBody: 26201313, bili: 40, cmpH: 8, scr: ALL_DONE, alta: { losDays: 10, wt: 1900, dxEg: 'P59.9', dest: 'Cuidados intermedios neonatales', feed: 'mixta' } },
  { h: 24 * 9, ga: 37, gd: 0, w: 2800, a1: 8, a5: 9, sex: 'M', del: 'cesarea', prev: 'Particular', proc: 'Observación sin procedimiento', dx: 'P70.4', med: 'Dra. Valentina Cortés', adm: true, name: 'RN de Soledad Modelo', rutBody: 26201414, scr: { ...ALL_DONE, PEA: 'rechazado' }, alta: { losDays: 3, wt: 2760, dxEg: 'P70.4', dest: 'Domicilio', feed: 'formula' } },
  { h: 24 * 8, ga: 27, gd: 3, w: 980, a1: 4, a5: 7, sex: 'M', del: 'cesarea', prev: 'Fonasa tramo A', proc: 'Ventilación mecánica', dx: 'P07.2', med: 'Dr. Andrés Salinas', adm: true, name: 'RN de Ignacia Referencia', rutBody: 26201515, cmpH: 20, scr: { PKU: 'realizado', TSH: 'realizado', VHB: 'realizado', BCG: 'pendiente' }, alta: { losDays: 6, wt: 1010, dxEg: 'P07.2', dest: 'Traslado a otro centro', feed: 'otra' } },
  { h: 24 * 3, ga: 38, gd: 0, w: 3050, a1: 8, a5: 9, sex: 'F', del: 'vaginal', prev: 'Fonasa tramo A', proc: 'Fototerapia', dx: 'P59.9', med: 'Dra. Francisca Lagos', adm: true, name: 'RN de Carolina Piloto', rutBody: 26200909, bili: 12, scr: { VHB: 'realizado' }, readmitOfIdx: 8 },
]

const ident = (body: number) => formatRut(`${body}${rutDv(String(body))}`)

async function run() {
  // Catálogos
  const [{ n: dxCount }] = await db.select({ n: count() }).from(diagnosis)
  if (dxCount === 0) {
    await db.insert(diagnosis).values(
      SEED_DIAGNOSES.map(([code, name, synonyms]) => ({ code, name, synonyms })),
    )
  }
  const [{ n: itemCount }] = await db.select({ n: count() }).from(catalogItem)
  if (itemCount === 0) {
    await db.insert(catalogItem).values(
      Object.entries(SEED_CATALOG).flatMap(([kind, labels]) =>
        labels.map((label) => ({ kind, label })),
      ),
    )
  }
  await db
    .insert(appSetting)
    .values({ key: 'contact_retention_days', value: '90' })
    .onConflictDoNothing()

  // Cuenta institucional de la unidad
  const existing = await db.select().from(user).where(eq(user.email, UNIT_EMAIL)).limit(1)
  if (existing.length === 0) {
    await auth.api.signUpEmail({
      body: { email: UNIT_EMAIL, password: DEMO_PASSWORD, name: 'Neonatología' },
    })
  } else {
    // Una cuenta creada antes con otra clave (o sin credencial) dejaba el acceso bloqueado.
    const authCtx = await auth.$context
    const userId = existing[0].id
    const accounts = await authCtx.internalAdapter.findAccounts(userId)
    const credential = accounts.find((a) => a.providerId === 'credential')
    const hash = async () => authCtx.password.hash(DEMO_PASSWORD)
    if (!credential) {
      await authCtx.internalAdapter.linkAccount({
        userId,
        providerId: 'credential',
        accountId: userId,
        password: await hash(),
      })
    } else {
      const matches =
        !!credential.password &&
        (await authCtx.password.verify({ hash: credential.password, password: DEMO_PASSWORD }))
      if (!matches) await authCtx.internalAdapter.updatePassword(userId, await hash())
    }
  }

  // Personal
  const [{ n: staffCount }] = await db.select({ n: count() }).from(staff)
  if (staffCount === 0) {
    await db.insert(staff).values(
      DEMO_STAFF.map((s) => ({
        name: s.name,
        role: s.role,
        pinHash: hashPin(s.pin),
        pinLength: s.pin.length,
      })),
    )
  }

  // Registros ficticios
  const [{ n: epCount }] = await db.select({ n: count() }).from(episode)
  if (epCount > 0) return

  const staffRows = await db.select().from(staff)
  const matronas = staffRows.filter((s) => s.role === 'matrona')
  const dx = await db.select().from(diagnosis)
  const items = await db.select().from(catalogItem)
  const dxId = (code?: string) => dx.find((d) => d.code === code)?.id ?? null
  const itemId = (kind: string, label?: string) =>
    items.find((i) => i.kind === kind && i.label === label)?.id ?? null

  const now = Date.now()
  const ids: string[] = []

  for (const [idx, s] of SPECS.entries()) {
    const id = randomUUID()
    ids.push(id)
    const creator = matronas[idx % matronas.length]
    const created = new Date(now - s.h * H)
    const birth = s.noBirth ? null : new Date(created.getTime() - 2 * H)
    const discharge = s.alta
      ? new Date(created.getTime() + s.alta.losDays * 24 * H)
      : s.altaPartial
        ? new Date(now - 2 * H)
        : null
    const vals = {
      id,
      gaWeeks: s.ga,
      gaDays: s.gd,
      birthWeightG: s.w,
      apgar1: s.a1,
      apgar5: s.a5,
      sex: s.sex,
      deliveryType: s.del,
      birthAt: birth,
      previsionId: itemId('prevision', s.prev),
      procedimientoId: itemId('procedimiento', s.proc),
      dxIngresoId: dxId(s.dx),
      medicoId: itemId('profesional', s.med),
      hyperbili: s.bili !== undefined ? true : s.dx ? false : null,
      phototherapyAt:
        s.bili !== undefined ? new Date((birth ?? created).getTime() + s.bili * H) : null,
      dischargeAt: discharge,
      dischargeWeightG: s.alta?.wt ?? null,
      dxEgresoId: dxId(s.alta?.dxEg),
      destinoId: itemId('destino', s.alta?.dest),
      feedingDischarge: s.alta?.feed ?? null,
      altaConfirmedAt: s.alta ? discharge : null,
      createdAt: created,
      createdShift: shiftOf(created).key,
      createdBy: creator.id,
      readmissionOf: s.readmitOfIdx !== undefined ? ids[s.readmitOfIdx] : null,
    }
    const asCore = Object.fromEntries(
      Object.entries(vals).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : (v ?? null)]),
    ) as unknown as EpisodeCore
    const status = computeStatus(asCore, !!s.adm)
    const ingresoOk = status !== 'incompleto'
    const completedAt = ingresoOk ? new Date(created.getTime() + (s.cmpH ?? 1) * H) : null
    const updated = new Date(Math.min(now, (discharge ?? created).getTime() + H))

    await db.insert(episode).values({
      ...vals,
      status,
      completedAt,
      completedShift: completedAt ? shiftOf(completedAt).key : null,
      updatedAt: updated,
    })
    await db.insert(episodeBlock).values({
      episodeId: id,
      block: 'ingreso',
      staffId: creator.id,
      staffName: creator.name,
      updatedAt: created,
    })
    if (s.scr || s.bili !== undefined) {
      await db.insert(episodeBlock).values({
        episodeId: id,
        block: 'seguimiento',
        staffId: creator.id,
        staffName: creator.name,
        updatedAt: new Date(Math.min(now, created.getTime() + 6 * H)),
      })
    }
    if (s.alta || s.altaPartial) {
      await db.insert(episodeBlock).values({
        episodeId: id,
        block: 'alta',
        staffId: matronas[(idx + 1) % matronas.length].id,
        staffName: matronas[(idx + 1) % matronas.length].name,
        updatedAt: discharge ?? updated,
      })
    }
    for (const [kind, st] of Object.entries(s.scr ?? {})) {
      await db.insert(screening).values({
        episodeId: id,
        kind,
        status: st,
        doneAt: st === 'pendiente' ? null : new Date(created.getTime() + 20 * H),
        updatedBy: creator.id,
        updatedByName: creator.name,
        updatedAt: new Date(Math.min(now, created.getTime() + 20 * H)),
      })
    }
    const withContact = s.contact || idx === 0
    await db.insert(episodeIdentity).values({
      episodeId: id,
      patientName: s.name,
      rut: ident(s.rutBody),
      admissionNumber: s.adm ? `ADM-${100000 + idx * 37}` : null,
      motherName: withContact ? 'Contacto de demostración' : null,
      motherPhone: withContact ? '+56 9 5555 0000' : null,
      contactReason: withContact ? 'seguimiento' : null,
      contactConsent: !!withContact,
      contactDeleteAt: withContact ? new Date(now + 60 * 24 * H) : null,
      updatedBy: creator.id,
    })
  }
}
