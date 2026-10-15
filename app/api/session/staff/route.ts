import { and, asc, eq, ne } from 'drizzle-orm'
import { handle, HttpError } from '@/lib/api'
import { NO_PIN_HASH } from '@/lib/server/doctors'
import { getAccount } from '@/lib/ctx'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'

export const GET = handle(async () => {
  if (!(await getAccount())) throw new HttpError(401, 'Primero inicia sesión con la cuenta de la unidad.')
  const rows = await db
    .select({ id: staff.id, name: staff.name, role: staff.role, isAdmin: staff.isAdmin, pinLength: staff.pinLength })
    .from(staff)
    .where(and(eq(staff.active, true), ne(staff.pinHash, NO_PIN_HASH)))
    .orderBy(asc(staff.name))
  return Response.json(rows)
})
