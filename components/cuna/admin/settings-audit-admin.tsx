'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { AUDIT_BLOCK_LABELS } from '@/lib/audit-text'
import { fmtDateTime } from '@/lib/time'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'
import { Highlight } from '@/components/cuna/highlight'
import { ChipToggle, SearchField } from '@/components/cuna/search-field'
import { Notice, PrimaryButton, Section, TextField } from '@/components/cuna/ui'

export function SettingsAdmin() {
  const { data, mutate } = useSWR<{ contactRetentionDays: number }>('/api/admin/settings', fetcher)
  const [days, setDays] = useState('')
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)

  useEffect(() => {
    if (data) setDays(String(data.contactRetentionDays))
  }, [data])

  async function save() {
    setMessage(null)
    try {
      await send('/api/admin/settings', 'PATCH', { contactRetentionDays: Number(days) })
      await mutate()
      setMessage({ tone: 'success', text: 'Plazo guardado.' })
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof ApiError ? e.message : 'No pudimos guardar.' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {message ? <Notice tone={message.tone} title={message.text} /> : null}
      <Section
        title="Retención de contacto"
        hint="Días que se conserva el teléfono de la madre antes de borrarse automáticamente."
      >
        <TextField label="Plazo en días (1 a 365)" inputMode="numeric" maxLength={3} value={days} onChange={(v) => setDays(v.replace(/\D/g, ''))} />
        <PrimaryButton disabled={!days} onClick={save}>
          Guardar plazo
        </PrimaryButton>
      </Section>
    </div>
  )
}

type AuditRow = {
  id: number
  at: string
  staffName: string | null
  action: string
  block: string
  episodeId: string | null
  code: string | null
  detail: string | null
}

export function AuditAdmin() {
  const [vista, setVista] = useState<'cambios' | 'accesos'>('cambios')
  const { data, error, isLoading } = useSWR<AuditRow[]>(`/api/admin/audit?vista=${vista}`, fetcher)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState<string | null>(null)
  const terms = parseQuery(query)
  const actions = Array.from(new Set((data ?? []).map((r) => r.action))).sort()
  const rows = (data ?? []).filter(
    (r) =>
      (!action || r.action === action) &&
      matchesAll(haystackOf(`${r.staffName ?? 'Sistema'} ${r.action} ${r.block} ${AUDIT_BLOCK_LABELS[r.block] ?? ''} ${r.code ?? ''} ${r.detail ?? ''} ${fmtDateTime(r.at)}`), terms),
  )
  return (
    <Section
      title={vista === 'cambios' ? 'Trazabilidad: últimos 200 cambios' : 'Accesos a datos sensibles: últimos 200'}
      hint={
        vista === 'cambios'
          ? 'Quién creó, modificó, eliminó o exportó registros, campos, turnos y administración, con el valor anterior y el nuevo. Nunca muestra el contenido de datos de identificación. No se registran consultas generales como abrir el libro o ver indicadores.'
          : 'Quién abrió los datos de identificación de un paciente y quién inició sesión. Varias aperturas del mismo registro por la misma persona en 15 minutos cuentan una vez.'
      }
    >
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tipo de auditoría">
        <ChipToggle
          pressed={vista === 'cambios'}
          onClick={() => {
            setVista('cambios')
            setAction(null)
          }}
        >
          Cambios y trazabilidad
        </ChipToggle>
        <ChipToggle
          pressed={vista === 'accesos'}
          onClick={() => {
            setVista('accesos')
            setAction(null)
          }}
        >
          Accesos a datos sensibles
        </ChipToggle>
      </div>
      {error ? <Notice tone="danger" title="No pudimos cargar la auditoría." /> : null}
      {isLoading ? <p className="text-muted-foreground">Cargando…</p> : null}
      {data && data.length === 0 ? (
        <p className="text-muted-foreground">Aún no hay movimientos en esta vista.</p>
      ) : null}
      {data && data.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SearchField
            id="audit-search"
            label="Buscar en la auditoría"
            placeholder="Buscar por persona, acción, bloque, fecha o detalle"
            value={query}
            onChange={setQuery}
          />
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por acción">
            {actions.map((a) => (
              <ChipToggle key={a} pressed={action === a} onClick={() => setAction(action === a ? null : a)}>
                {a}
              </ChipToggle>
            ))}
            <span className="ml-1 text-sm text-muted-foreground" aria-live="polite">
              {rows.length} de {data.length}
            </span>
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-semibold">Cuándo</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Quién</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Acción</th>
              <th scope="col" className="py-2 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {data && rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  Ningún movimiento coincide con la búsqueda.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 align-top last:border-0">
                <td className="whitespace-nowrap py-2 pr-4 tabular-nums">{fmtDateTime(r.at)}</td>
                <td className="py-2 pr-4">
                  <Highlight text={r.staffName ?? 'Sistema'} terms={terms} />
                </td>
                <td className="py-2 pr-4">
                  <Highlight text={r.action} terms={terms} /> ·{' '}
                  <Highlight text={AUDIT_BLOCK_LABELS[r.block] ?? r.block} terms={terms} />
                  {r.code ? (
                    <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                      <Highlight text={r.code} terms={terms} />
                    </span>
                  ) : null}
                </td>
                <td className="max-w-xl py-2 leading-relaxed text-muted-foreground">
                  <Highlight text={r.detail ?? 'Sin detalle adicional.'} terms={terms} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
