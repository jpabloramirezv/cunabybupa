'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { GROUP_LABEL, INDICATORS, type Direction, type IndicatorGroup, type Targets } from '@/lib/panel-indicators'
import { Notice, PrimaryButton, Section } from '@/components/cuna/ui'

type Draft = Record<string, { value: string; direction: Direction }>

const GROUPS = Object.keys(GROUP_LABEL) as IndicatorGroup[]

export function PanelTargetsAdmin() {
  const { data, mutate } = useSWR<{ targets: Targets }>('/api/admin/panel-targets', fetcher)
  const [draft, setDraft] = useState<Draft>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)

  useEffect(() => {
    if (!data) return
    const next: Draft = {}
    for (const i of INDICATORS) {
      const t = data.targets[i.id]
      next[i.id] = { value: t ? String(t.value) : '', direction: t?.direction ?? i.direction }
    }
    setDraft(next)
  }, [data])

  function patch(id: string, p: Partial<Draft[string]>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...p } }))
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const targets: Record<string, { value: string; direction: Direction }> = {}
      for (const [id, t] of Object.entries(draft)) if (t.value.trim() !== '') targets[id] = t
      await send('/api/admin/panel-targets', 'PUT', { targets })
      await mutate()
      setMessage({ tone: 'success', text: 'Metas guardadas. El Panel ya las usa.' })
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof ApiError ? e.message : 'No pudimos guardar las metas.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      title="Metas del Panel"
      hint="Define la meta de cada indicador. Sin meta, el Panel muestra el valor sin color de estado. El porcentaje va de 0 a 100; las horas, en horas."
    >
      {message ? <Notice tone={message.tone} title={message.text} /> : null}
      {GROUPS.map((g) => (
        <fieldset key={g} className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-navy dark:text-foreground">{GROUP_LABEL[g]}</legend>
          {INDICATORS.filter((i) => i.group === g).map((i) => {
            const d = draft[i.id]
            if (!d) return null
            const unit = i.unit === 'h' ? 'h' : '%'
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
                <label htmlFor={`meta-${i.id}`} className="min-w-0 flex-1 basis-56 text-sm font-medium text-foreground">
                  {i.label}
                </label>
                <select
                  aria-label={`Sentido de la meta de ${i.label}`}
                  value={d.direction}
                  onChange={(e) => patch(i.id, { direction: e.target.value as Direction })}
                  className="h-12 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                >
                  <option value="mayor">Al menos</option>
                  <option value="menor">A lo más</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    id={`meta-${i.id}`}
                    inputMode="decimal"
                    maxLength={5}
                    placeholder="Sin meta"
                    value={d.value}
                    onChange={(e) => patch(i.id, { value: e.target.value.replace(/[^\d.]/g, '') })}
                    className="h-12 w-28 rounded-lg border border-input bg-background px-3 text-right text-base tabular-nums focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  />
                  <span className="w-4 text-sm text-muted-foreground">{unit}</span>
                </div>
              </div>
            )
          })}
        </fieldset>
      ))}
      <PrimaryButton disabled={saving || !data} onClick={save}>
        {saving ? 'Guardando…' : 'Guardar metas'}
      </PrimaryButton>
    </Section>
  )
}
