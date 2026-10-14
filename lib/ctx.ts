import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { HttpError } from '@/lib/api'
import {
  MAX_PIN_ATTEMPTS,
  PERSON_COOKIE,
  PERSON_SESSION_HOURS,
  PIN_LOCK_MINUTES,
  UNIT_EMAIL,
} from '@/lib/config'
import { db } from '@/lib/db'
import { personSession, staff } from '@/lib/db/schema'
import { isValidPinFormat, verifyPin } from '@/lib/pin'
import type { Role } from '@/lib/rules'

export const hashToken = (t: string) =>
  createHash('sha256').update(t).digest('hex')

export async function getAccount() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  if (session.user.email.toLowerCase() !== UNIT_EMAIL) return null
  return session.user
}

export type Ctx = {
  staffId: number
  name: string
  role: Role
  isAdmin: boolean
  userId: string
  canWrite: boolean
  canIdentity: boolean
  canPanel: boolean
  canReports: boolean
  canAdmin: boolean
  canClinical: boolean
}

export function permissionsFor(role: Role, isAdmin = false) {
  // La Matrona con permisos de Jefatura (isAdmin) tiene exactamente los permisos de una Jefatura.
  const effective: Role = role === 'matrona' && isAdmin ? 'jefatura' : role
  return {
    canWrite: effective === 'matrona' || effective === 'jefatura',
    canIdentity: effective === 'matrona' || effective === 'jefatura',
    canPanel: effective !== 'matrona',
    /** Informes: solo Jefatura (matronería) y Jefatura Médica (Médico Jefe). */
    canReports: effective === 'jefatura' || effective === 'medico_jefe',
    canAdmin: effective === 'jefatura',
    canClinical: effective !== 'analista',
  }
}

export async function getCtx(): Promise<Ctx | null> {
  const account = await getAccount()
  if (!account) return null
  const token = (await cookies()).get(PERSON_COOKIE)?.value
  if (!token) return null
  const rows = await db
    .select({ s: staff })
    .from(personSession)
    .innerJoin(staff, eq(staff.id, personSession.staffId))
    .where(
      and(
        eq(personSession.tokenHash, hashToken(token)),
        eq(personSession.userId, account.id),
        gt(personSession.expiresAt, new Date()),
        eq(staff.active, true),
      ),
    )
    .limit(1)
  const s = rows[0]?.s
  if (!s) return null
  const role = s.role as Role
  return {
    staffId: s.id,
    name: s.name,
    role,
    isAdmin: s.isAdmin,
    userId: account.id,
    ...permissionsFor(role, s.isAdmin),
  }
}

type Need = 'write' | 'identity' | 'panel' | 'reports' | 'admin' | 'clinical'

export async function requireCtx(need?: Need): Promise<Ctx> {
  const ctx = await getCtx()
  if (!ctx) throw new HttpError(401, 'Tu sesión terminó. Vuelve a ingresar.')
  const ok =
    !need ||
    (need === 'write' && ctx.canWrite) ||
    (need === 'identity' && ctx.canIdentity) ||
    (need === 'panel' && ctx.canPanel) ||
    (need === 'reports' && ctx.canReports) ||
    (need === 'admin' && ctx.canAdmin) ||
    (need === 'clinical' && ctx.canClinical)
  if (!ok) throw new HttpError(403, 'Tu rol no permite hacer esto.')
  return ctx
}

/** Verifica el PIN con bloqueo temporal tras varios intentos fallidos. */
export async function verifyStaffPin(staffId: number, pin: unknown) {
  if (!isValidPinFormat(pin)) throw new HttpError(400, 'El PIN debe tener 4 o 6 dígitos.')
  const [s] = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1)
  if (!s || !s.active) throw new HttpError(404, 'No encontramos a esa persona.')
  if (s.lockedUntil && s.lockedUntil.getTime() > Date.now()) {
    const min = Math.ceil((s.lockedUntil.getTime() - Date.now()) / 60000)
    throw new HttpError(429, `Demasiados intentos. Espera ${min} min e intenta de nuevo.`)
  }
  if (!verifyPin(pin, s.pinHash)) {
    const attempts = s.failedAttempts + 1
    const lock = attempts >= MAX_PIN_ATTEMPTS
    await db
      .update(staff)
      .set({
        failedAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + PIN_LOCK_MINUTES * 60000) : null,
      })
      .where(eq(staff.id, s.id))
    throw new HttpError(
      401,
      lock
        ? `PIN incorrecto. Bloqueamos el acceso por ${PIN_LOCK_MINUTES} min.`
        : 'PIN incorrecto.',
    )
  }
  if (s.failedAttempts > 0 || s.lockedUntil) {
    await db
      .update(staff)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(eq(staff.id, s.id))
  }
  return s
}

export async function startPersonSession(staffId: number, userId: string) {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + PERSON_SESSION_HOURS * 3600_000)
  await db.insert(personSession).values({
    tokenHash: hashToken(token),
    staffId,
    userId,
    expiresAt: expires,
  })
  ;(await cookies()).set(PERSON_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: process.env.NODE_ENV === 'development' ? 'none' : 'lax',
    path: '/',
    expires,
  })
}

export async function endPersonSession() {
  const jar = await cookies()
  const token = jar.get(PERSON_COOKIE)?.value
  if (token) {
    await db.delete(personSession).where(eq(personSession.tokenHash, hashToken(token)))
  }
  jar.delete(PERSON_COOKIE)
}
