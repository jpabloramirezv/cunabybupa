import { and, desc, isNull } from 'drizzle-orm'
import { assertEpisodeId, handle, HttpError } from '@/lib/api'
import { linkCode } from '@/lib/book-flow'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { birthRecord } from '@/lib/db/schema'
import { episodeSummary, getBookFields, resolveLinked } from '@/lib/server/book'

export type SendSuggestion = {
  id: string
  code: string
  mother: string
  fecha: string
  hora: string
  tipo: string
  updatedAt: string
  updatedByName: string | null
  score: number
  reasons: string[]
}

export type SendSuggestPayload = {
  episode: { code: string; motherName: string | null; patientName: string | null; createdAt: string; unit: 'uci' | 'nursery' }
  /** Cantidad de datos que se precargarán desde el ingreso. */
  prefillCount: number
  suggestions: SendSuggestion[]
}

const norm = (s: string | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const firstToken = (s: string | undefined) => norm((s ?? '').trim().split(/\s+/)[0])
const dayMs = (ymd: string | undefined) => (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? Date.parse(`${ymd}T00:00:00Z`) : NaN)

const MAX = 25

/**
 * Propone filas del libro sin ingreso vinculado que podrían ser el mismo recién nacido, para que la persona
 * decida entre incorporar a una existente o crear una nueva antes de enviar.
 */
export const GET = handle(async (req) => {
  const ctx = await requireCtx()
  if (!ctx.canBook || !ctx.canEditNeonatal) throw new HttpError(403, 'Tu perfil no puede enviar registros al libro.')
  const episodeId = new URL(req.url).searchParams.get('episodeId') ?? ''
  assertEpisodeId(episodeId)

  const ep = await episodeSummary(episodeId)
  if (!ep) throw new HttpError(404, 'No encontramos ese ingreso.')
  const fields = await getBookFields()
  const linked = (await resolveLinked([episodeId], fields)).get(episodeId) ?? {}

  const rows = await db
    .select()
    .from(birthRecord)
    .where(and(isNull(birthRecord.deletedAt), isNull(birthRecord.episodeId)))
    .orderBy(desc(birthRecord.updatedAt))
    .limit(300)

  const epDay = dayMs(linked.fecha)
  const scored = rows.map((r): SendSuggestion => {
    const d = (r.data ?? {}) as Record<string, string>
    const reasons: string[] = []
    let score = 0
    if (linked.rut && d.rut && norm(linked.rut) === norm(d.rut)) {
      score += 5
      reasons.push('Mismo RUT de la madre')
    }
    const pat = linked.ap_paterno && d.ap_paterno && norm(linked.ap_paterno) === norm(d.ap_paterno)
    const mat = linked.ap_materno && d.ap_materno && norm(linked.ap_materno) === norm(d.ap_materno)
    const nom = linked.nombre && d.nombre && firstToken(linked.nombre) === firstToken(d.nombre)
    if (pat) score += 2
    if (mat) score += 1
    if (nom) score += 2
    if (pat && nom) reasons.push('Misma madre')
    else if (pat || nom) reasons.push('Nombre de la madre parecido')
    const rd = dayMs(d.fecha)
    if (!Number.isNaN(epDay) && !Number.isNaN(rd)) {
      const diff = Math.abs(rd - epDay) / 864e5
      if (diff === 0) {
        score += 2
        reasons.push('Misma fecha de nacimiento')
      } else if (diff <= 1) {
        score += 1
        reasons.push('Fecha de nacimiento ±1 día')
      }
    }
    const mother = [d.nombre, d.ap_paterno, d.ap_materno].filter(Boolean).join(' ')
    return {
      id: r.id,
      code: linkCode(r.seq),
      mother: mother || 'Madre sin nombre',
      fecha: d.fecha ?? '',
      hora: d.hora ?? '',
      tipo: d.tipo_parto ?? '',
      updatedAt: r.updatedAt.toISOString(),
      updatedByName: r.updatedByName,
      score,
      reasons,
    }
  })

  const matches = scored.filter((s) => s.score >= 2).sort((a, b) => b.score - a.score)
  const recent = scored.filter((s) => s.score < 2) // ya vienen ordenadas por última modificación
  const suggestions = [...matches, ...recent].slice(0, MAX)

  const payload: SendSuggestPayload = {
    episode: {
      code: ep.code,
      motherName: ep.identity?.motherName ?? null,
      patientName: ep.identity?.patientName ?? null,
      createdAt: ep.createdAt,
      unit: ep.unit,
    },
    prefillCount: Object.keys(linked).length,
    suggestions,
  }
  return Response.json(payload)
})
