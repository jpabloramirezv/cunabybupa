import { and, asc, eq, inArray } from 'drizzle-orm'
import { HttpError } from '@/lib/api'
import { db } from '@/lib/db'
import { birthRecord, bookField, catalogItem, staff } from '@/lib/db/schema'
import { DOCTOR_ROLES, type Role } from '@/lib/rules'

/**
 * Los "médicos tratantes" del catálogo son solo las personas inscritas como usuarios
 * de la app con rol médico o médico jefe. Este espejo se mantiene al crear o editar personal.
 */
export async function syncDoctorItem(person: { id: number; name: string; role: string; active: boolean }) {
  const isDoctor = DOCTOR_ROLES.includes(person.role as Role)
  const [existing] = await db
    .select({ id: catalogItem.id, label: catalogItem.label })
    .from(catalogItem)
    .where(and(eq(catalogItem.kind, 'profesional'), eq(catalogItem.staffId, person.id)))
    .limit(1)
  if (!isDoctor) {
    if (existing) await db.update(catalogItem).set({ active: false }).where(eq(catalogItem.id, existing.id))
    return
  }
  if (existing) {
    await db
      .update(catalogItem)
      .set({ label: person.name, active: person.active })
      .where(eq(catalogItem.id, existing.id))
    if (existing.label !== person.name) await renameDoctorInBook(existing.label, person.name)
    return
  }
  await db
    .insert(catalogItem)
    .values({ kind: 'profesional', label: person.name, active: person.active, staffId: person.id })
}

/** Nombres de los médicos activos de la app: la única lista válida para las columnas de médico del libro. */
export async function listBookDoctors(): Promise<string[]> {
  const rows = await db
    .select({ label: catalogItem.label })
    .from(catalogItem)
    .innerJoin(staff, eq(staff.id, catalogItem.staffId))
    .where(
      and(
        eq(catalogItem.kind, 'profesional'),
        eq(catalogItem.active, true),
        eq(staff.active, true),
        inArray(staff.role, [...DOCTOR_ROLES]),
      ),
    )
    .orderBy(asc(catalogItem.label))
  return [...new Set(rows.map((r) => r.label))]
}

export type BookDoctor = { id: number; name: string; specialty: string | null; role: string }

/** Médicos activos con su especialidad, para elegirlos en el libro y detectar nombres repetidos. */
export async function listBookDoctorsDetailed(): Promise<BookDoctor[]> {
  const rows = await db
    .select({ id: staff.id, name: staff.name, specialty: staff.specialty, role: staff.role })
    .from(staff)
    .where(and(eq(staff.active, true), inArray(staff.role, [...DOCTOR_ROLES])))
    .orderBy(asc(staff.name))
  return rows
}

/** Si se corrige el nombre de un médico, los registros del libro que lo citan se actualizan con él. */
async function renameDoctorInBook(from: string, to: string) {
  const cols = await db.select({ key: bookField.key }).from(bookField).where(eq(bookField.type, 'doctor'))
  const keys = cols.map((c) => c.key)
  if (keys.length === 0) return
  const rows = await db.select({ id: birthRecord.id, data: birthRecord.data }).from(birthRecord)
  for (const r of rows) {
    const data = r.data ?? {}
    const hit = keys.filter((k) => data[k] === from)
    if (hit.length === 0) continue
    const next = { ...data }
    for (const k of hit) next[k] = to
    await db.update(birthRecord).set({ data: next }).where(eq(birthRecord.id, r.id))
  }
}

export async function syncDoctorItemById(staffId: number) {
  const [p] = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1)
  if (p) await syncDoctorItem(p)
}

/** Rechaza cualquier médico tratante que no sea un usuario médico de la app. */
export async function assertDoctorIds(ids: number[]) {
  if (ids.length === 0) return
  const rows = await db
    .select({ id: catalogItem.id })
    .from(catalogItem)
    .innerJoin(staff, eq(staff.id, catalogItem.staffId))
    .where(
      and(
        eq(catalogItem.kind, 'profesional'),
        inArray(catalogItem.id, ids),
        inArray(staff.role, [...DOCTOR_ROLES]),
      ),
    )
  if (rows.length !== ids.length) {
    throw new HttpError(
      422,
      'El médico tratante debe ser un médico inscrito como usuario de la app. Pídele a Jefatura que lo agregue en Administración.',
    )
  }
}
