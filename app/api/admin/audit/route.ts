import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import { handle } from '@/lib/api'
import { explainStoredDetail } from '@/lib/audit-text'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { auditLog, episode } from '@/lib/db/schema'
import { episodeCode } from '@/lib/rules'

/**
 * Por defecto solo trazabilidad (crear, modificar, eliminar, exportar). Los accesos
 * a datos sensibles e ingresos de sesión se consultan aparte con ?vista=accesos.
 * Las lecturas antiguas de listados e indicadores quedan guardadas pero no se muestran.
 */
export const GET = handle(async (req) => {
  await requireCtx('admin')
  const accesos = new URL(req.url).searchParams.get('vista') === 'accesos'
  const where = accesos
    ? and(eq(auditLog.action, 'leer'), inArray(auditLog.block, ['identidad', 'sesion']))
    : ne(auditLog.action, 'leer')
  const rows = await db.select().from(auditLog).where(where).orderBy(desc(auditLog.at)).limit(200)

  const ids = Array.from(new Set(rows.map((r) => r.episodeId).filter((x): x is string => !!x)))
  const codes = new Map<string, string>()
  if (ids.length > 0) {
    const eps = await db.select({ id: episode.id, seq: episode.seq }).from(episode).where(inArray(episode.id, ids))
    for (const e of eps) codes.set(e.id, episodeCode(e.seq))
  }

  return Response.json(
    rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      staffName: r.staffName,
      action: r.action,
      block: r.block,
      episodeId: r.episodeId,
      code: r.episodeId ? (codes.get(r.episodeId) ?? null) : null,
      detail: explainStoredDetail(r.action, r.block, r.detail),
    })),
  )
})
