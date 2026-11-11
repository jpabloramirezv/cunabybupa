'use client'

import type { FichaField } from '@/lib/hooks'
import { Choice, DecField, NumField, TextField } from '@/components/cuna/ui'

export type DynamicFieldDef = Pick<FichaField, 'key' | 'label' | 'type' | 'options' | 'required' | 'help' | 'min' | 'max'>

export const numberOrNull = (s: string | undefined) => {
  if (s === undefined || s === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const PREVIEW_PLACEHOLDER: Record<string, string> = {
  doctor: 'Se elige entre el personal inscrito',
  prevision: 'Se elige de la lista de previsiones',
  country: 'Se busca en la lista de países',
  comuna: 'Se busca entre las comunas de Chile',
  suggest: 'Sugiere respuestas de registros anteriores',
}

/** Una pregunta según su tipo. La usan la ficha de Neonatología y la vista previa del constructor. */
export function DynamicField({
  field: f,
  value: v,
  onChange,
  disabled,
  preview,
}: {
  field: DynamicFieldDef
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** En la vista previa, los tipos con lista externa muestran una indicación en vez de la lista. */
  preview?: boolean
}) {
  const common = { label: f.label, required: f.required, hint: f.help || undefined, disabled }

  if (f.type === 'select') {
    return (
      <div className="sm:col-span-2">
        <Choice
          {...common}
          options={f.options.map((o) => ({ value: o, label: o }))}
          value={v || null}
          onChange={(x) => onChange(x ?? '')}
        />
      </div>
    )
  }
  if (f.type === 'number' || f.type === 'digit') {
    const max = f.type === 'digit' ? 9 : (f.max ?? undefined)
    const min = f.type === 'digit' ? 0 : (f.min ?? undefined)
    return (
      <NumField
        {...common}
        value={numberOrNull(v)}
        min={min}
        max={max}
        onChange={(n) => onChange(n == null ? '' : String(n))}
      />
    )
  }
  if (f.type === 'decimal') {
    return (
      <DecField
        {...common}
        value={numberOrNull(v)}
        min={f.min ?? undefined}
        max={f.max ?? undefined}
        onChange={(n) => onChange(n == null ? '' : String(n))}
      />
    )
  }
  if (f.type === 'date' || f.type === 'time') {
    return <TextField {...common} type={f.type} value={v} maxLength={10} onChange={onChange} />
  }
  return (
    <TextField
      {...common}
      value={v}
      maxLength={300}
      placeholder={preview ? PREVIEW_PLACEHOLDER[f.type] : undefined}
      onChange={onChange}
    />
  )
}
