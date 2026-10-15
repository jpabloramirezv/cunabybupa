'use client'

import { useMemo, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { Download } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { useMe } from '@/lib/hooks'
import { addDaysYmd, startOfDay, todayYmd } from '@/lib/time'
import type { PanelPayload, Stat } from '@/lib/types'
import type { StatsSegment } from '@/lib/server/book-stats'
import { BookStatsView } from '@/components/cuna/book/book-stats-view'
import { BinomioView } from '@/components/cuna/book/binomio-view'
import { SegmentSwitch } from '@/components/cuna/segment-switch'
import { ScopePill } from '@/components/cuna/unit-banner'
import { Choice, Notice } from '@/components/cuna/ui'

const RANGES = [
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '1 año' },
]

const pct = (n: number | null) => (n === null ? 'Sin datos' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`)
const num = (n: number | null, unit = '') =>
  n === null ? 'Sin datos' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })}${unit}`

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className ?? ''}`}>
      <h2 className="mb-4 text-base font-bold text-navy">{title}</h2>
      {children}
    </section>
  )
}

function Big({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold tabular-nums text-primary">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function StatTable({ rows }: { rows: Stat[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-semibold">Grupo</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">RN</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold">Mediana</th>
            <th scope="col" className="py-2 text-right font-semibold">P90</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60 last:border-0">
              <th scope="row" className="py-2 pr-4 font-medium text-foreground">{r.label}</th>
              <td className="py-2 pr-4 text-right tabular-nums">{r.n}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{num(r.median, ' d')}</td>
              <td className="py-2 text-right tabular-nums">{num(r.p90, ' d')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PanelView() {
  const { data: me } = useMe()
  const [days, setDays] = useState('30')
  const from = useMemo(() => {
    return startOfDay(addDaysYmd(todayYmd(), -Number(days)))!.toISOString()
  }, [days])
  const query = `from=${encodeURIComponent(from)}`
  const [segment, setSegment] = useState<StatsSegment>('uci')
  const { data, error, isLoading } = useSWR<PanelPayload>(
    me?.canPanel ? `/api/panel?${query}&unidad=${segment}` : null,
    fetcher,
  )

  if (me && !me.canPanel) {
    return <Notice tone="danger" title="Tu rol no tiene acceso al panel." />
  }

  const uci = true
  const showBook = segment !== 'uci'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <ScopePill scope="analisis" />
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">Panel de indicadores</h1>
          <p className="text-sm text-muted-foreground">
            {segment === 'uci'
              ? 'Calculado sobre los ingresos a UCI Neonatal del período. Sin datos de identificación.'
              : segment === 'nursery'
                ? 'Calculado sobre los recién nacidos de Nursery del período. Sin datos de identificación.'
                : 'Calculado sobre UCI Neonatal y Nursery juntos, más el Libro de Partos y Abortos. Sin datos de identificación.'}
          </p>
        </div>
        {uci ? (
          <a
            href={`/api/export?${query}&unidad=${segment}`}
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-primary bg-card px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <Download className="size-4" aria-hidden />
            Exportar CSV
          </a>
        ) : null}
      </div>

      <SegmentSwitch value={segment} onChange={setSegment} />

      <Choice label="Período" columns={3} options={RANGES} value={days} onChange={(v) => v && setDays(v)} />

      {showBook ? <BookStatsView segment={segment} days={Number(days)} /> : null}

      {uci && error ? <Notice tone="danger" title="No pudimos calcular los indicadores." /> : null}
      {uci && isLoading ? <p className="py-10 text-center text-muted-foreground">Calculando…</p> : null}

      {uci && data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Movimiento" className="lg:col-span-2">
            <div className="grid grid-cols-3 gap-4">
              <Big value={data.totals.admitted} label="Ingresos" />
              <Big value={data.totals.discharged} label="Altas" />
              <Big value={data.totals.open} label="Abiertos" />
            </div>
          </Card>

          <Card title="Estadía (días)">
            <StatTable rows={[data.los.overall, ...data.los.byGa, ...data.los.byWeight]} />
          </Card>

          <Card title="Distribución por peso al nacer">
            <ul className="flex flex-col gap-3">
              {data.weightDist.map((w) => (
                <li key={w.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-foreground">{w.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {w.n} · {pct(w.pct)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted" role="presentation">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, w.pct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Tamizajes completados" className="lg:col-span-2">
            <p className="mb-4 text-sm text-muted-foreground">
              Cumplimiento global: <strong className="text-foreground">{pct(data.screening.overallPct)}</strong> ({data.screening.n} RN)
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.screening.byKind.map((k) => (
                <li key={k.kind}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-foreground">{k.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {k.done}/{k.total} · {pct(k.pct)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted" role="presentation">
                    <div className="h-full rounded-full bg-magenta" style={{ width: `${Math.min(100, k.pct ?? 0)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Hiperbilirrubinemia">
            <div className="grid grid-cols-2 gap-4">
              <Big value={pct(data.bili.pct)} label={`${data.bili.withBili} de ${data.bili.n} RN`} />
              <Big value={data.bili.phototherapyN} label="Con fototerapia" />
              <Big value={num(data.bili.medianHours, ' h')} label="Mediana hasta fototerapia" />
              <Big value={num(data.bili.p90Hours, ' h')} label="P90 hasta fototerapia" />
            </div>
          </Card>

          <Card title="Otros indicadores">
            <div className="grid grid-cols-2 gap-4">
              <Big value={pct(data.feeding.pct)} label={`Lactancia exclusiva al alta (${data.feeding.exclusive}/${data.feeding.n})`} />
              <Big value={pct(data.readmission.pct)} label={`Reingresos (${data.readmission.readmitted}/${data.readmission.n})`} />
              <Big value={num(data.timeliness.medianHours, ' h')} label="Mediana hasta completar el registro" />
              <Big value={pct(data.timeliness.sameShiftPct)} label="Completados en el mismo turno" />
            </div>
          </Card>
        </div>
      ) : null}

      <BinomioView segment={segment} days={Number(days)} />
    </div>
  )
}
