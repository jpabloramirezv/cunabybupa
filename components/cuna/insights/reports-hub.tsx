'use client'

import { useState } from 'react'
import { BookOpenText, Stethoscope, type LucideIcon } from 'lucide-react'
import { addDaysYmd, todayYmd } from '@/lib/time'
import { cn } from '@/lib/utils'
import { InsightsView } from '@/components/cuna/insights/insights-view'
import { BookStatsView } from '@/components/cuna/book/book-stats-view'
import { BinomioView } from '@/components/cuna/book/binomio-view'
import { BookColumnReport, REPORT_SCOPES } from '@/components/cuna/book/book-column-report'
import { BookInsightsView } from '@/components/cuna/book/book-insights-view'
import { SegmentSwitch, type StatsSegment } from '@/components/cuna/segment-switch'
import { ScopePill } from '@/components/cuna/unit-banner'
import { Notice } from '@/components/cuna/ui'
import type { ReportScope } from '@/lib/server/book-report'

const inputClass =
  'h-12 rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20'

type Area = 'neonatologia' | 'libro'
type LibroTab = 'generador' | 'columnas' | 'indicadores'

const AREAS: { id: Area; title: string; text: string; Icon: LucideIcon }[] = [
  {
    id: 'neonatologia',
    title: 'Neonatología',
    text: 'Pizarra de UPC Neonatal y Nursery: indicadores de hospitalización, estadía y diagnósticos, y el generador de informes estadísticos con filtros.',
    Icon: Stethoscope,
  },
  {
    id: 'libro',
    title: 'Libro de Partos',
    text: 'Libro de Partos y Abortos con Maternidad y Neonatología: informes estadísticos según sus columnas, indicadores y cruces entre la madre y el recién nacido.',
    Icon: BookOpenText,
  },
]

const QUICK_PERIODS = [
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '1 año' },
]

const LIBRO_DEFAULT_COLUMNS = ['tipo_parto', 'paridad', 'sexo_rn', 'eg', 'peso']
const NEONATOLOGIA_DEFAULT_COLUMNS = ['sexo_rn', 'eg', 'peso', 'apgar5', 'alimentacion_alta']

function AreaChooser({ onPick }: { onPick: (a: Area) => void }) {
  return (
    <section aria-labelledby="areas-title" className="flex flex-col gap-4">
      <div>
        <h1 id="areas-title" className="text-2xl font-bold text-navy text-balance sm:text-3xl">
          ¿Por qué sección quieres comenzar?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Cada sección tiene sus propios informes estadísticos. Podrás cambiar en cualquier momento.
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

function PeriodControls({
  from,
  to,
  valid,
  onFrom,
  onTo,
  quick,
}: {
  from: string
  to: string
  valid: boolean
  onFrom: (v: string) => void
  onTo: (v: string) => void
  quick?: boolean
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
        Desde
        <input type="date" value={from} max={to} onChange={(e) => onFrom(e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
        Hasta
        <input type="date" value={to} min={from} onChange={(e) => onTo(e.target.value)} className={inputClass} />
      </label>
      {quick ? (
        <div role="group" aria-label="Períodos rápidos" className="inline-flex gap-1 rounded-xl bg-muted p-1">
          {QUICK_PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => {
                const end = todayYmd()
                onTo(end)
                onFrom(addDaysYmd(end, -(p.days - 1)))
              }}
              className="h-10 rounded-lg px-3.5 text-sm font-semibold text-muted-foreground transition-all hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}
      {!valid ? <p className="pb-3 text-sm text-destructive">La fecha inicial debe ser anterior a la final.</p> : null}
    </div>
  )
}

function LibroTabs({ value, onChange }: { value: LibroTab; onChange: (t: LibroTab) => void }) {
  const tabs: { id: LibroTab; label: string }[] = [
    { id: 'generador', label: 'Informe estadístico completo' },
    { id: 'columnas', label: 'Informes estadísticos por columna' },
    { id: 'indicadores', label: 'Indicadores y cruces del libro' },
  ]
  return (
    <div role="group" aria-label="Tipo de informe del libro" className="inline-flex w-full flex-wrap gap-1 rounded-xl bg-muted p-1 print:hidden sm:w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'h-11 flex-1 rounded-lg px-4 text-sm font-semibold transition-all sm:flex-none',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
            value === t.id ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Informes tiene dos familias:
 * - Neonatología: UPC mantiene el generador completo de siempre; Nursery y "todos los nacimientos"
 *   usan los indicadores del libro y un informe estadístico por columna de Neonatología.
 * - Libro de Partos: informe estadístico por cualquier columna de Maternidad o Neonatología,
 *   más los indicadores y los cruces entre la madre y el recién nacido.
 */
export function ReportsHub() {
  const [area, setArea] = useState<Area | null>(null)
  const [segment, setSegment] = useState<StatsSegment>('uci')
  const [libroScope, setLibroScope] = useState<ReportScope>('todos')
  const [libroTab, setLibroTab] = useState<LibroTab>('generador')
  const [to, setTo] = useState(todayYmd)
  const [from, setFrom] = useState(() => addDaysYmd(todayYmd(), -29))
  const valid = from <= to

  const libroSegment: StatsSegment | null = libroScope === 'aborto' || libroScope === 'nacimientos' ? null : libroScope

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 print:hidden">
        <ScopePill scope="analisis" />
        {area ? <AreaSwitch value={area} onChange={setArea} /> : null}
        {area === 'neonatologia' ? <SegmentSwitch value={segment} onChange={setSegment} /> : null}
      </div>

      {area === null ? <AreaChooser onPick={setArea} /> : null}

      {area === 'libro' ? (
        <div className="flex flex-col gap-6">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold text-navy text-balance sm:text-3xl">Informes del Libro de Partos</h1>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Se calculan con el Libro de Partos y Abortos, sin datos de identificación. Genera un informe completo con
              filtros, pruebas estadísticas, PDF y Excel, o revisa columnas e indicadores puntuales.
            </p>
          </div>
          <LibroTabs value={libroTab} onChange={setLibroTab} />
          {libroTab !== 'generador' ? <PeriodControls from={from} to={to} valid={valid} onFrom={setFrom} onTo={setTo} quick /> : null}

          {libroTab === 'generador' ? <BookInsightsView /> : null}

          {valid && libroTab !== 'generador' ? (
            <>
              <div className={cn(libroTab !== 'columnas' && 'hidden')}>
                <BookColumnReport
                  scope={libroScope}
                  onScopeChange={setLibroScope}
                  from={from}
                  to={to}
                  defaultKeys={LIBRO_DEFAULT_COLUMNS}
                  title="Informe estadístico por columna"
                  description="Marca las columnas del libro que quieres analizar. Cada una muestra su distribución o resumen numérico, y puedes compararlas según otra columna. Se puede imprimir o descargar."
                />
              </div>

              {libroTab === 'indicadores' ? (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2 print:hidden">
                    <span className="text-sm font-semibold text-foreground">Qué registros analizar</span>
                    <div role="group" aria-label="Registros a analizar" className="inline-flex w-full flex-wrap gap-1 rounded-xl bg-muted p-1 sm:w-fit">
                      {REPORT_SCOPES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          aria-pressed={libroScope === s.value}
                          onClick={() => setLibroScope(s.value)}
                          className={cn(
                            'h-10 flex-1 rounded-lg px-3.5 text-sm font-semibold transition-all sm:flex-none',
                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                            libroScope === s.value ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {libroSegment ? (
                    <>
                      <BookStatsView segment={libroSegment} from={from} to={to} />
                      <BinomioView segment={libroSegment} from={from} to={to} tools />
                    </>
                  ) : (
                    <Notice
                      tone="info"
                      title="Los indicadores y cruces no se calculan solo para abortos. Usa el informe estadístico por columna para analizarlos."
                    />
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {area !== 'neonatologia' ? null : segment === 'uci' ? (
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
              está en UPC Neonatal.
            </p>
          </div>
          <PeriodControls from={from} to={to} valid={valid} onFrom={setFrom} onTo={setTo} />
          {valid ? <BookStatsView segment={segment} from={from} to={to} /> : null}
          {valid ? (
            <BookColumnReport
              scope={segment === 'nursery' ? 'nursery' : 'nacimientos'}
              from={from}
              to={to}
              sections={['neonatal']}
              defaultKeys={NEONATOLOGIA_DEFAULT_COLUMNS}
              title="Informe estadístico por columna de Neonatología"
              description="Marca las columnas de Neonatología que quieres analizar para este período. Puedes compararlas según otra columna, imprimir o descargar el resumen."
            />
          ) : null}
          {valid ? <BinomioView segment={segment} from={from} to={to} /> : null}
        </div>
      )}
    </div>
  )
}
