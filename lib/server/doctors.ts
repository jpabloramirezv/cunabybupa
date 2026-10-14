import { and, eq, inArray } from 'drizzle-orm'
import { HttpError } from '@/lib/api'
import { db } from '@/lib/db'
import { catalogItem, staff } from '@/lib/db/schema'
import { DOCTOR_ROLES, type Role } from '@/lib/rules'

/**
 * Los "médicos tratantes" del catálogo son solo las personas inscritas como usuarios
 * de la app con rol médico o médico jefe. Este espejo se mantiene al crear o editar personal.
 */
export async function syncDoctorItem(person: { id: number; name: string; role: string; active: boolean }) {
  const isDoctor = DOCTOR_ROLES.includes(person.role as Role)
  const [existing] = await db
    .select({ id: catalogItem.id })
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
    return
  }
  await db
    .insert(catalogItem)
    .values({ kind: 'profesional', label: person.name, active: person.active, staffId: person.id })
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
