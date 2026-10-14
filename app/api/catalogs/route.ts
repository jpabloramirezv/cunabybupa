import { asc, desc, isNotNull } from 'drizzle-orm'
import { handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { catalogItem, diagnosis, episode } from '@/lib/db/schema'
import { getContactRetentionDays } from '@/lib/server/episodes'
import type { CatalogsPayload } from '@/lib/types'

export const GET = handle(async () => {
  await requireCtx('clinical')
  const [diagnoses, items, last, contactRetentionDays] = await Promise.all([
    db.select().from(diagnosis).orderBy(asc(diagnosis.name)),
    db.select().from(catalogItem).orderBy(asc(catalogItem.label)),
    db
      .select({
        previsionId: episode.previsionId,
        procedimientoId: episode.procedimientoId,
        medicoId: episode.medicoId,
      })
      .from(episode)
      .where(isNotNull(episode.previsionId))
      .orderBy(desc(episode.createdAt))
      .limit(1),
    getContactRetentionDays(),
  ])
  const payload: CatalogsPayload = {
    diagnoses,
    items,
    defaults: last[0] ?? { previsionId: null, procedimientoId: null, medicoId: null },
    contactRetentionDays,
  }
  return Response.json(payload)
})
