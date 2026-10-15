import { and, asc, eq, gte, lt } from 'drizzle-orm'
import { handle, HttpError } from '@/lib/api'
import { audit } from '@/lib/audit'
import { SCREENING_KINDS } from '@/lib/config'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { catalogItem, diagnosis, episode } from '@/lib/db/schema'
import { buildDetails } from '@/lib/server/episodes'
import { parsePanelUnit, parsePeriod } from '@/lib/server/panel'
import { fmtSheetDateTime } from '@/lib/time'

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

const cell = (v: unknown) => {
  if (v === null || v === undefined) return ''
  const raw = v instanceof Date ? v.toISOString() : String(v)
  const s = ISO_UTC.test(raw) ? fmtSheetDateTime(raw) : raw
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Exportación sin datos identificables: solo código interno y variables clínicas. */
export const GET = handle(async (req) => {
  const ctx = await requireCtx('panel')
  const params = new URL(req.url).searchParams
  const period = parsePeriod(params)
  if (!period) throw new HttpError(400, 'El período no es válido.')
  const unit = parsePanelUnit(params.get('unidad'))

  const [rows, dx, items] = await Promise.all([
    db
      .select()
      .from(episode)
      .where(
        and(
          gte(episode.createdAt, period.from),
          lt(episode.createdAt, period.to),
          unit === 'todos' ? undefined : eq(episode.unit, unit),
        ),
      )
      .orderBy(asc(episode.createdAt)),
    db.select().from(diagnosis),
    db.select().from(catalogItem),
  ])
  const details = await buildDetails(rows)
  const item = (id: number | null) => items.find((i) => i.id === id)?.label ?? ''
  const dxCode = (id: number | null) => dx.find((d) => d.id === id)?.code ?? ''

  const header = [
    'codigo', 'estado', 'ingreso', 'nacimiento', 'semanas', 'dias', 'peso_g', 'apgar1', 'apgar5',
    'sexo', 'parto', 'prevision', 'procedimiento', 'dx_ingreso', 'hiperbilirrubinemia',
    'fototerapia', 'egreso', 'peso_egreso_g', 'dx_egreso', 'destino', 'alimentacion',
    'reingreso', ...SCREENING_KINDS.map((k) => k.key),
    'nivel_cuidado', 'centro_origen_traslado', 'fecha_hora_ingreso', 'ges_notificado',
    'ges_fecha', 'medicos_tratantes', ...SCREENING_KINDS.map((k) => `fecha_${k.key}`),
    'apgar10',
  ]
  const lines = details.map((d) =>
    [
      d.code, d.status, d.createdAt, d.birthAt, d.gaWeeks, d.gaDays, d.birthWeightG, d.apgar1,
      d.apgar5, d.sex, d.deliveryType, item(d.previsionId), item(d.procedimientoId),
      (d.dxIngresoIds?.length ? d.dxIngresoIds : d.dxIngresoId != null ? [d.dxIngresoId] : [])
        .map((x) => dxCode(x))
        .filter(Boolean)
        .join(' | '),
      d.hyperbili === null ? '' : d.hyperbili ? 'si' : 'no',
      d.phototherapyAt, d.dischargeAt, d.dischargeWeightG,
      (d.dxEgresoIds?.length ? d.dxEgresoIds : d.dxEgresoId != null ? [d.dxEgresoId] : [])
        .map((x) => dxCode(x))
        .filter(Boolean)
        .join(' | '),
      item(d.destinoId), d.feedingDischarge, d.readmissionOf ? 'si' : 'no',
      ...SCREENING_KINDS.map((k) => d.screenings.find((s) => s.kind === k.key)?.status ?? ''),
      d.careLevel, d.transferOrigin, d.admissionAt,
      d.gesNotified === null ? '' : d.gesNotified ? 'si' : 'no', d.gesNotifiedAt,
      (d.medicoIds?.length ? d.medicoIds : d.medicoId != null ? [d.medicoId] : [])
        .map((id) => item(id))
        .filter(Boolean)
        .join(' | '),
      ...SCREENING_KINDS.map((k) => d.screenings.find((s) => s.kind === k.key)?.doneAt ?? ''),
      d.apgar10,
    ]
      .map(cell)
      .join(';'),
  )
  await audit(ctx, 'exportar', 'panel', null, `${details.length} registros`)
  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cuna-neonatologia.csv"',
      'Cache-Control': 'no-store',
    },
  })
})
