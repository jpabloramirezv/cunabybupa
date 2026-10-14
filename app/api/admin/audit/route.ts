import { desc, inArray } from 'drizzle-orm'
import { handle } from '@/lib/api'
import { explainStoredDetail } from '@/lib/audit-text'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { auditLog, episode } from '@/lib/db/schema'
import { episodeCode } from '@/lib/rules'

export const GET = handle(async () => {
  await requireCtx('admin')
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(200)

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
