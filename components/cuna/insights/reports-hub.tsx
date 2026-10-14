'use client'

import { useState } from 'react'
import { addDaysYmd, todayYmd } from '@/lib/time'
import { InsightsView } from '@/components/cuna/insights/insights-view'
import { BookStatsView } from '@/components/cuna/book/book-stats-view'
import { SegmentSwitch, type StatsSegment } from '@/components/cuna/segment-switch'
import { ScopePill } from '@/components/cuna/unit-banner'

const inputClass =
  'h-12 rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20'

/**
 * Informes: UCI mantiene el generador completo de siempre; Nursery y "todos los nacimientos"
 * usan los indicadores del Libro de Partos y Abortos.
 */
export function ReportsHub() {
  const [segment, setSegment] = useState<StatsSegment>('uci')
  const [to, setTo] = useState(todayYmd)
  const [from, setFrom] = useState(() => addDaysYmd(todayYmd(), -29))
  const valid = from <= to

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 print:hidden">
        <ScopePill scope="analisis" />
        <SegmentSwitch value={segment} onChange={setSegment} />
      </div>

      {segment === 'uci' ? (
        <InsightsView />
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
        </div>
      )}
    </div>
  )
}
