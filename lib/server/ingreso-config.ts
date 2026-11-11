import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appSetting } from '@/lib/db/schema'
import { getIngresoField, type IngresoOverride, type IngresoOverrides } from '@/lib/ingreso-fields'

const KEY = 'ingreso_overrides_v1'

const clean = (raw: unknown): IngresoOverrides => {
  const out: IngresoOverrides = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!getIngresoField(key) || !v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const next: IngresoOverride = {}
    if (typeof o.label === 'string' && o.label.trim()) next.label = o.label.trim().slice(0, 100)
    if (typeof o.tableLabel === 'string' && o.tableLabel.trim()) next.tableLabel = o.tableLabel.trim().slice(0, 40)
    if (typeof o.help === 'string' && o.help.trim()) next.help = o.help.trim().slice(0, 300)
    if (o.hidden === true) next.hidden = true
    if (Object.keys(next).length > 0) out[key] = next
  }
  return out
}

export async function getIngresoOverrides(): Promise<IngresoOverrides> {
  const [row] = await db.select().from(appSetting).where(eq(appSetting.key, KEY)).limit(1)
  if (!row) return {}
  try {
    return clean(JSON.parse(row.value))
  } catch {
    return {}
  }
}

/** Reemplaza lo configurado para una pregunta. `null` la devuelve a su versión original. */
export async function setIngresoOverride(key: string, next: IngresoOverride | null) {
  const all = await getIngresoOverrides()
  if (next && Object.keys(next).length > 0) all[key] = next
  else delete all[key]
  const value = JSON.stringify(clean(all))
  await db.insert(appSetting).values({ key: KEY, value }).onConflictDoUpdate({ target: appSetting.key, set: { value } })
  return all
}
