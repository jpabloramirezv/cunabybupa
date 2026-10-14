import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import type { Ctx } from '@/lib/ctx'

type Action = 'crear' | 'modificar' | 'leer' | 'eliminar' | 'exportar'

/** Guarda quién hizo qué. Nunca recibe valores de datos identificatorios, solo nombres de campos. */
export async function audit(
  ctx: Pick<Ctx, 'staffId' | 'name'>,
  action: Action,
  block: string,
  episodeId?: string | null,
  detail?: string,
) {
  await db.insert(auditLog).values({
    staffId: ctx.staffId,
    staffName: ctx.name,
    action,
    block,
    episodeId: episodeId ?? null,
    detail: detail ?? null,
  })
}
