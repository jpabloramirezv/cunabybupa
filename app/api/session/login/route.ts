import { handle, HttpError, readJson } from '@/lib/api'
import { getAccount, startPersonSession, verifyStaffPin } from '@/lib/ctx'
import { audit } from '@/lib/audit'

export const POST = handle(async (req) => {
  const account = await getAccount()
  if (!account) throw new HttpError(401, 'Primero inicia sesión con la cuenta de la unidad.')
  const body = await readJson<{ staffId?: unknown; pin?: unknown }>(req)
  const staffId = Number(body.staffId)
  if (!Number.isInteger(staffId)) throw new HttpError(400, 'Selecciona tu nombre.')
  const s = await verifyStaffPin(staffId, body.pin)
  await startPersonSession(s.id, account.id)
  await audit({ staffId: s.id, name: s.name }, 'leer', 'sesion', null, 'Ingreso de persona')
  return Response.json({ ok: true })
})
