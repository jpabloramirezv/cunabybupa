'use client'

import { useState } from 'react'
import { BarChart3, Link2 } from 'lucide-react'
import { addDaysYmd, todayYmd } from '@/lib/time'
import { cn } from '@/lib/utils'
import { InsightsView } from '@/components/cuna/insights/insights-view'
import { BookStatsView } from '@/components/cuna/book/book-stats-view'
import { BinomioView } from '@/components/cuna/book/binomio-view'
import { SegmentSwitch, type StatsSegment } from '@/components/cuna/segment-switch'
import { ScopePill } from '@/components/cuna/unit-banner'

const inputClass =
  'h-12 rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20'

type Area = 'unidad' | 'binomio'

const AREAS: { id: Area; title: string; text: string; Icon: typeof BarChart3 }[] = [
  {
    id: 'unidad',
    title: 'Informe de la unidad',
    text: 'Indicadores de hospitalización, estadía, diagnósticos y el generador de informes con filtros.',
    Icon: BarChart3,
  },
  {
    id: 'binomio',
    title: 'Binomio recién nacido + madre',
    text: 'Cruces entre los datos de la madre y del RN desde el Libro de Partos, con período, impresión y descarga.',
    Icon: Link2,
  },
]

const QUICK_PERIODS = [
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '1 año' },
]

function AreaChooser({ onPick }: { onPick: (a: Area) => void }) {
  return (
    <section aria-labelledby="areas-title" className="flex flex-col gap-4">
      <div>
        <h1 id="areas-title" className="text-2xl font-bold text-navy text-balance sm:text-3xl">
          ¿Por qué sección quieres comenzar?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Podrás cambiar de sección en cualquier momento.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {AREAS.map(({ id, title, text, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-magenta hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-magenta/10 text-magenta">
              <Icon className="size-6" aria-hidden />
            </span>
            <span className="text-lg font-bold text-navy">{title}</span>
            <span className="text-sm text-muted-foreground text-pretty">{text}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function AreaSwitch({ value, onChange }: { value: Area; onChange: (a: Area) => void }) {
  return (
    <div role="group" aria-label="Sección de informes" className="inline-flex gap-1 self-start rounded-xl bg-muted p-1">
      {AREAS.map(({ id, title }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'h-10 rounded-lg px-3.5 text-sm font-semibold transition-all',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
            value === id ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {title}
        </button>
      ))}
    </div>
  )
}

/**
 * Informes: UCI mantiene el generador completo de siempre; Nursery y "todos los nacimientos"
 * usan los indicadores del Libro de Partos y Abortos.
 */
export function ReportsHub() {
  const [area, setArea] = useState<Area | null>(null)
  const [segment, setSegment] = useState<StatsSegment>('uci')
  const [to, setTo] = useState(todayYmd)
  const [from, setFrom] = useState(() => addDaysYmd(todayYmd(), -29))
  const valid = from <= to

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 print:hidden">
        <ScopePill scope="analisis" />
        {area ? <AreaSwitch value={area} onChange={setArea} /> : null}
        {area ? <SegmentSwitch value={segment} onChange={setSegment} /> : null}
      </div>

      {area === null ? <AreaChooser onPick={setArea} /> : null}

      {area === 'binomio' ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end gap-3 print:hidden">
            <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
              Desde
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
              Hasta
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </label>
            <div role="group" aria-label="Períodos rápidos" className="inline-flex gap-1 rounded-xl bg-muted p-1">
              {QUICK_PERIODS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => {
                    const end = todayYmd()
                    setTo(end)
                    setFrom(addDaysYmd(end, -(p.days - 1)))
                  }}
                  className="h-10 rounded-lg px-3.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {!valid ? <p className="pb-3 text-sm text-destructive">La fecha inicial debe ser anterior a la final.</p> : null}
          </div>
          {valid ? <BinomioView segment={segment} from={from} to={to} tools /> : null}
        </div>
      ) : null}

      {area !== 'unidad' ? null : segment === 'uci' ? (
        <>
          <InsightsView />
          <BinomioView segment="uci" withPeriod />
        </>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-navy text-balance sm:text-3xl">
              {segment === 'nursery' ? 'Informe de Nursery' : 'Informe de todos los nacimientos'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Se calcula con el Libro de Partos y Abortos. El generador de informes personalizados con filtros y Excel
              está en UCI Neonatal.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3 print:hidden">
            <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
              Desde
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
              Hasta
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </label>
            {!valid ? <p className="pb-3 text-sm text-destructive">La fecha inicial debe ser anterior a la final.</p> : null}
          </div>
          {valid ? <BookStatsView segment={segment} from={from} to={to} /> : null}
          {valid ? <BinomioView segment={segment} from={from} to={to} /> : null}
        </div>
      )}
    </div>
  )
}
