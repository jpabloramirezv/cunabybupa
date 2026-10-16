import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { appSetting } from '@/lib/db/schema'
import { INDICATOR_BY_ID, parseTargets, type Targets } from '@/lib/panel-indicators'
import { TARGETS_KEY } from '@/lib/server/panel-dashboard'
import { eq } from 'drizzle-orm'

export const GET = handle(async () => {
  await requireCtx('admin')
  const [row] = await db.select().from(appSetting).where(eq(appSetting.key, TARGETS_KEY)).limit(1)
  return Response.json({ targets: parseTargets(row?.value) })
})

export const PUT = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<{ targets?: Record<string, { value?: unknown; direction?: unknown }> }>(req)
  const input = b.targets ?? {}
  const clean: Targets = {}
  for (const [id, t] of Object.entries(input)) {
    const ind = INDICATOR_BY_ID.get(id)
    if (!ind) throw new HttpError(400, 'Indicador desconocido.')
    if (t?.value === null || t?.value === '' || t?.value === undefined) continue
    const value = Number(t.value)
    if (!Number.isFinite(value) || value < 0 || (ind.unit === 'pct' && value > 100)) {
      throw new HttpError(400, `La meta de "${ind.label}" no es válida.`)
    }
    clean[id] = { value, direction: t.direction === 'menor' ? 'menor' : 'mayor' }
  }
  const value = JSON.stringify(clean)
  await db
    .insert(appSetting)
    .values({ key: TARGETS_KEY, value })
    .onConflictDoUpdate({ target: appSetting.key, set: { value } })
  await audit(ctx, 'modificar', 'administracion', null, `Metas del panel: ${Object.keys(clean).length} indicadores`)
  return Response.json({ ok: true })
})
