import { asc, eq, inArray, sql } from 'drizzle-orm'
import { matchNames } from '@/lib/name-match'
import { DOCTOR_ROLES, type Role } from '@/lib/rules'
import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { normalizeUnit, requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'
import { hashPin, isValidPinFormat } from '@/lib/pin'
import { importDoctorsFromBook, NO_PIN_HASH, syncDoctorItem, syncDoctorItemById } from '@/lib/server/doctors'

const ROLES = ['matrona', 'medico', 'medico_jefe', 'jefatura', 'analista']

export const GET = handle(async () => {
  const ctx = await requireCtx('admin')
  let imported = 0
  try {
    imported = await importDoctorsFromBook()
  } catch (e) {
    console.error('No se pudieron importar los médicos del libro', e)
  }
  if (imported > 0) await audit(ctx, 'crear', 'administracion', null, `Médicos importados desde el Libro de Partos: ${imported}`)
  const rows = await db
    .select({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      isAdmin: staff.isAdmin,
      unit: staff.unit,
      specialty: staff.specialty,
      active: staff.active,
      lockedUntil: staff.lockedUntil,
      hasPin: sql<boolean>`${staff.pinHash} <> ${NO_PIN_HASH}`,
    })
    .from(staff)
    .orderBy(asc(staff.name))
  return Response.json(rows)
})

const cleanSpecialty = (v: unknown) => {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new HttpError(400, 'La especialidad no es válida.')
  const s = v.trim().replace(/\s+/g, ' ')
  if (s.length > 60) throw new HttpError(400, 'La especialidad es demasiado larga.')
  return s || null
}

/** Alerta si ya hay un médico activo o inactivo con el mismo nombre; se puede confirmar para crear igual. */
async function assertNoDuplicateDoctor(name: string, role: string, confirmed: boolean, exceptId?: number) {
  if (!DOCTOR_ROLES.includes(role as Role) || confirmed) return
  const doctors = (await db.select({ id: staff.id, name: staff.name }).from(staff).where(inArray(staff.role, [...DOCTOR_ROLES]))).filter(
    (d) => d.id !== exceptId,
  )
  const { exact } = matchNames(name, doctors, (d) => d.name)
  if (exact.length > 0)
    throw new HttpError(409, `Ya existe un médico llamado «${exact[0].name}» en la app. Revisa que no sea la misma persona.`)
}

export const POST = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<{
    name?: unknown
    role?: unknown
    pin?: unknown
    isAdmin?: unknown
    unit?: unknown
    specialty?: unknown
    confirmDuplicate?: unknown
  }>(req)
  const unit = normalizeUnit(b.unit)
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : ''
  const isAdmin = b.isAdmin === true && b.role === 'matrona'
  if (!name || name.length > 80) throw new HttpError(400, 'Escribe el nombre de la persona.')
  if (typeof b.role !== 'string' || !ROLES.includes(b.role)) throw new HttpError(400, 'El rol no es válido.')
  if (!isValidPinFormat(b.pin)) throw new HttpError(400, 'El PIN debe tener 4 o 6 dígitos.')
  await assertNoDuplicateDoctor(name, b.role, b.confirmDuplicate === true)
  const specialty = DOCTOR_ROLES.includes(b.role as Role) ? cleanSpecialty(b.specialty) : null
  const [row] = await db
    .insert(staff)
    .values({ name, role: b.role, isAdmin, unit, specialty, pinHash: hashPin(b.pin), pinLength: b.pin.length })
    .returning({ id: staff.id })
  await syncDoctorItem({ id: row.id, name, role: b.role, active: true })
  await audit(ctx, 'crear', 'administracion', null, `Persona: ${name} (${isAdmin ? 'matrona con permisos de jefatura' : b.role})`)
  return Response.json({ id: row.id })
})

export const PATCH = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<{
    id?: unknown
    name?: unknown
    role?: unknown
    active?: unknown
    pin?: unknown
    isAdmin?: unknown
    specialty?: unknown
    confirmDuplicate?: unknown
  }>(req)
  const id = Number(b.id)
  if (!Number.isInteger(id)) throw new HttpError(400, 'Persona no válida.')
  const [current] = await db
    .select({ role: staff.role, isAdmin: staff.isAdmin, name: staff.name })
    .from(staff)
    .where(eq(staff.id, id))
    .limit(1)
  if (!current) throw new HttpError(404, 'No encontramos a la persona.')
  const set: Partial<typeof staff.$inferInsert> = {}
  if (b.name !== undefined) {
    const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : ''
    if (!name || name.length > 80) throw new HttpError(400, 'Escribe el nombre de la persona.')
    set.name = name
  }
  if (b.role !== undefined) {
    if (typeof b.role !== 'string' || !ROLES.includes(b.role)) throw new HttpError(400, 'El rol no es válido.')
    set.role = b.role
  }
  const nextRoleForDoctor = set.role ?? current.role
  if (set.name !== undefined || set.role !== undefined) {
    const becomesDoctor = DOCTOR_ROLES.includes(nextRoleForDoctor as Role)
    const wasSame = !set.name || set.name === current.name
    if (becomesDoctor && (!wasSame || (set.role !== undefined && !DOCTOR_ROLES.includes(current.role as Role)))) {
      await assertNoDuplicateDoctor(set.name ?? current.name, nextRoleForDoctor, b.confirmDuplicate === true, id)
    }
  }
  if (b.specialty !== undefined) set.specialty = DOCTOR_ROLES.includes(nextRoleForDoctor as Role) ? cleanSpecialty(b.specialty) : null
  const bu = b as { unit?: unknown }
  if (bu.unit !== undefined) {
    if (bu.unit !== 'neonatologia' && bu.unit !== 'maternidad') throw new HttpError(400, 'La unidad no es válida.')
    set.unit = bu.unit
  }
  if (b.isAdmin !== undefined && typeof b.isAdmin !== 'boolean') throw new HttpError(400, 'Valor de administradora no válido.')
  const nextRole = set.role ?? current.role
  const nextAdmin = nextRole === 'matrona' && (typeof b.isAdmin === 'boolean' ? b.isAdmin : current.isAdmin)
  if (nextAdmin !== current.isAdmin) set.isAdmin = nextAdmin
  const keepsJefatura = nextRole === 'jefatura' || (nextRole === 'matrona' && nextAdmin)
  if (id === ctx.staffId && !keepsJefatura) throw new HttpError(422, 'No puedes quitarte tu propio acceso de jefatura.')
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') throw new HttpError(400, 'Estado no válido.')
    if (id === ctx.staffId && !b.active) throw new HttpError(422, 'No puedes desactivar tu propia cuenta.')
    set.active = b.active
  }
  if (b.pin !== undefined) {
    if (!isValidPinFormat(b.pin)) throw new HttpError(400, 'El PIN debe tener 4 o 6 dígitos.')
    set.pinHash = hashPin(b.pin)
    set.pinLength = b.pin.length
    set.failedAttempts = 0
    set.lockedUntil = null
  }
  if (Object.keys(set).length === 0) throw new HttpError(400, 'No hay cambios que guardar.')
  await db.update(staff).set(set).where(eq(staff.id, id))
  await syncDoctorItemById(id)
  await audit(ctx, 'modificar', 'administracion', null, `Persona #${id}: ${Object.keys(set).filter((k) => k !== 'pinHash' && k !== 'isAdmin').join(', ')}${set.pinHash ? ', pin' : ''}${set.isAdmin !== undefined ? `, permisos de jefatura: ${set.isAdmin ? 'sí' : 'no'}` : ''}`)
  return Response.json({ ok: true })
})
