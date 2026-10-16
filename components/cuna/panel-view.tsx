'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Download } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { useMe } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { startOfDay } from '@/lib/time'
import { PERIOD_OPTIONS, type PanelPeriod } from '@/lib/panel-indicators'
import type { DashboardPayload } from '@/lib/server/panel-dashboard'
import { SegmentSwitch, type StatsSegment } from '@/components/cuna/segment-switch'
import { ScopePill } from '@/components/cuna/unit-banner'
import { Notice } from '@/components/cuna/ui'
import { TodayStrip } from '@/components/cuna/panel/today-strip'
import { ReviewList } from '@/components/cuna/panel/review-list'
import { QualityTable } from '@/components/cuna/panel/quality-table'
import { ActivitySection } from '@/components/cuna/panel/activity-section'
import { CrossesSection } from '@/components/cuna/panel/crosses-section'

const dmy = (ymd: string) => ymd.split('-').reverse().join('/')

export function PanelView() {
  const { data: me } = useMe()
  const [segment, setSegment] = useState<StatsSegment>('uci')
  const [period, setPeriod] = useState<PanelPeriod>('30')
  const { data, error, isLoading, isValidating } = useSWR<DashboardPayload>(
    me?.canPanel ? `/api/panel/dashboard?unidad=${segment}&periodo=${period}` : null,
    fetcher,
    { refreshInterval: 120000, keepPreviousData: true },
  )

  if (me && !me.canPanel) {
    return <Notice tone="danger" title="Tu rol no tiene acceso al panel." />
  }

  const exportFrom = data ? startOfDay(data.period.from)?.toISOString() : null
  const exportHref = exportFrom ? `/api/export?from=${encodeURIComponent(exportFrom)}&unidad=${segment}` : null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <ScopePill scope="analisis" />
          <h1 className="text-2xl font-bold text-navy sm:text-3xl dark:text-foreground">Panel clínico</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Qué atender hoy, qué revisar y cómo vamos frente a las metas. Sin datos de identificación.
          </p>
        </div>
        {me?.canAdmin && exportHref ? (
          <a
            href={exportHref}
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-primary bg-card px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <Download className="size-4" aria-hidden />
            Exportar CSV
          </a>
        ) : null}
      </div>

      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 print:static">
        <SegmentSwitch value={segment} onChange={setSegment} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label="Período" className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
            {PERIOD_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={period === o.value}
                onClick={() => setPeriod(o.value)}
                className={cn(
                  'h-10 rounded-lg px-3 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                  period === o.value ? 'bg-card text-navy shadow-sm dark:text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {data ? (
            <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
              {data.period.from === data.period.to ? dmy(data.period.from) : `${dmy(data.period.from)} al ${dmy(data.period.to)}`}
              {isValidating ? ' · actualizando…' : ''}
            </p>
          ) : null}
        </div>
      </div>

      {error && !data ? <Notice tone="danger" title="No pudimos calcular el panel." /> : null}
      {isLoading && !data ? <p className="py-10 text-center text-muted-foreground">Calculando…</p> : null}

      {data ? (
        <>
          <TodayStrip data={data} />
          <ReviewList data={data} />
          <QualityTable data={data} />
          <ActivitySection data={data} />
          <CrossesSection data={data} />
        </>
      ) : null}
    </div>
  )
}
