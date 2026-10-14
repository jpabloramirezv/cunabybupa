import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { appSetting } from '@/lib/db/schema'
import { getContactRetentionDays } from '@/lib/server/episodes'

export const GET = handle(async () => {
  await requireCtx('admin')
  return Response.json({ contactRetentionDays: await getContactRetentionDays() })
})

export const PATCH = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<{ contactRetentionDays?: unknown }>(req)
  const n = Number(b.contactRetentionDays)
  if (!Number.isInteger(n) || n < 1 || n > 365) {
    throw new HttpError(400, 'El plazo debe ser entre 1 y 365 días.')
  }
  await db
    .insert(appSetting)
    .values({ key: 'contact_retention_days', value: String(n) })
    .onConflictDoUpdate({ target: appSetting.key, set: { value: String(n) } })
  await audit(ctx, 'modificar', 'administracion', null, `Plazo de contacto: ${n} días`)
  return Response.json({ ok: true })
})
