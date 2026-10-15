import type { ReactNode } from 'react'
import type { Box } from '@/lib/insights'
import type { LibroRate, LibroReport } from '@/lib/book-insights'
import { fmtNum, fmtP, type KruskalResult, type Summary } from '@/lib/stats'
import { fmtYmd } from '@/lib/time'
import { BoxPlots, ChartCard, ContingencyView, Empty, HBars, HeatGrid, Histogram } from '@/components/cuna/insights/charts'

function SectionBlock({ id, title, lead, children }: { id: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="insight-section flex flex-col gap-4">
      <header className="border-b border-border pb-3">
        <h2 id={id} className="text-xl font-bold text-navy text-balance">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{lead}</p>
      </header>
      {children}
    </section>
  )
}

const grid2 = 'grid gap-4 lg:grid-cols-2'
const fmtS = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : fmtNum(v, d))

function SummaryRow({ label, s }: { label: string; s: Summary | null }) {
  return (
    <tr className="border-b border-border/60">
      <th scope="row" className="py-2 pr-3 font-medium text-foreground">{label}</th>
      {s ? (
        <>
          <td className="px-2 py-2 text-right tabular-nums">{s.n}</td>
          {[s.mean, s.sd, s.min, s.q1, s.median, s.q3, s.p90, s.max].map((v, i) => (
            <td key={i} className={`px-2 py-2 text-right tabular-nums ${i === 4 ? 'font-semibold text-navy' : ''}`}>{fmtS(v)}</td>
          ))}
        </>
      ) : (
        <td colSpan={9} className="px-2 py-2 text-right text-muted-foreground">sin datos</td>
      )}
    </tr>
  )
}

function SummaryTable({ rows }: { rows: { label: string; summary: Summary | null }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {['Variable', 'n', 'Media', 'DE', 'Mín', 'Q1', 'Mediana', 'Q3', 'P90', 'Máx'].map((h, i) => (
              <th key={h} scope="col" className={`py-2 font-semibold ${i === 0 ? 'pr-3' : 'px-2 text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((r) => <SummaryRow key={r.label} label={r.label} s={r.summary} />)}</tbody>
      </table>
    </div>
  )
}

function RateTable({ rows }: { rows: LibroRate[] }) {
  if (!rows.length) return <Empty />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">Indicador</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Casos</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">Con dato</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">%</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">IC 95 %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60">
              <th scope="row" className="py-2 pr-3 font-medium text-foreground">
                {r.label}
                {r.note ? <span className="block text-xs font-normal text-muted-foreground">{r.note}</span> : null}
              </th>
              <td className="px-2 py-2 text-right tabular-nums">{r.n}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.total}</td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums text-navy">{r.pct === null ? '—' : `${fmtNum(r.pct, 1)}%`}</td>
              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.ci ? `${fmtNum(r.ci[0])} a ${fmtNum(r.ci[1])}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Kruskal({ label, k }: { label: string; k: KruskalResult | null }) {
  if (!k) return null
  return (
    <p className="text-sm text-foreground">
      <strong>{label}:</strong> H = {fmtNum(k.h, 2)}, gl = {k.df}, {fmtP(k.p)}.
    </p>
  )
}

function Activity({ flow }: { flow: NonNullable<LibroReport['flow']> }) {
  const max = Math.max(...flow.points.map((p) => p.total), 1)
  const legend = [
    { label: 'Nursery', cls: 'bg-primary' },
    { label: 'UCI Neonatal', cls: 'bg-magenta' },
    { label: 'Abortos', cls: 'bg-border' },
  ]
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {legend.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${l.cls}`} aria-hidden />
            {l.label}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <div className="flex h-44 min-w-full items-end gap-1" style={{ minWidth: Math.min(flow.points.length * 22, 1400) }}>
          {flow.points.map((p) => (
            <div
              key={p.key}
              className="flex h-full min-w-[14px] flex-1 flex-col justify-end"
              title={`${p.label}: ${p.total} (Nursery ${p.nursery}, UCI ${p.uci}, Abortos ${p.abortos})`}
            >
              <div className="flex flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(p.total / max) * 100}%` }}>
                <div className="bg-primary" style={{ flexGrow: p.nursery }} />
                <div className="bg-magenta" style={{ flexGrow: p.uci }} />
                <div className="bg-border" style={{ flexGrow: p.abortos }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{flow.points[0]?.label}</span>
          <span>{flow.points[flow.points.length - 1]?.label}</span>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-primary">Ver tabla de datos</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                {['Período', 'Nursery', 'UCI', 'Abortos', 'Total'].map((h, i) => (
                  <th key={h} scope="col" className={`py-1.5 font-semibold ${i ? 'px-2 text-right' : 'pr-3'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flow.points.map((p) => (
                <tr key={p.key} className="border-b border-border/60">
                  <th scope="row" className="py-1.5 pr-3 font-medium">{p.label}</th>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.nursery}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.uci}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.abortos}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

const boxCard = (title: string, boxes: Box[], unit: string, subtitle?: string) =>
  boxes.length ? (
    <ChartCard title={title} subtitle={subtitle}>
      <BoxPlots boxes={boxes} unit={unit} />
    </ChartCard>
  ) : null

export function BookInsightsReport({ report }: { report: LibroReport }) {
  const m = report.meta
  const when = new Date(m.generatedAt).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'long', timeStyle: 'short' })
  const { maternal, delivery, newborn, discharge } = report

  return (
    <article id="insight-report" className="flex flex-col gap-8" aria-label="Informe estadístico del Libro de Partos">
      <header className="insight-cover rounded-2xl border border-border bg-card p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Informe estadístico · Libro de Partos y Abortos</p>
        <h1 className="mt-1 text-3xl font-bold text-navy text-balance">{m.title}</h1>
        {m.subtitle ? <p className="mt-1 text-base text-muted-foreground">{m.subtitle}</p> : null}
        <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-foreground">Período</dt>
            <dd className="text-muted-foreground">{fmtYmd(m.from)} a {fmtYmd(m.to)} ({m.days} días) · {m.basisLabel}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Registros</dt>
            <dd className="text-muted-foreground">
              {m.scopeLabel} · {report.cohort.n}{report.cohort.beforeFilters !== report.cohort.n ? ` de ${report.cohort.beforeFilters} sin filtros` : ''}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Filtros</dt>
            <dd className="text-muted-foreground">
              {report.cohort.filters.length ? report.cohort.filters.map((f) => `${f.label}: ${f.values.join(', ')}`).join(' · ') : 'Sin filtros'}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Generado</dt>
            <dd className="text-muted-foreground">{when} por {m.generatedBy}</dd>
          </div>
        </dl>
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Informe sin datos de identificación: no incluye RUT, nombres ni teléfonos. Los valores p son orientativos y no corrigen comparaciones múltiples.
        </p>
      </header>

      <section aria-labelledby="lib-headline" className="rounded-2xl border border-primary/30 bg-secondary p-6">
        <h2 id="lib-headline" className="text-lg font-bold text-navy">Lo más importante</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {report.highlights.map((h, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-secondary-foreground text-pretty">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              {h}
            </li>
          ))}
        </ul>
        {m.notes ? (
          <div className="mt-4 border-t border-primary/20 pt-3">
            <p className="text-sm font-semibold text-navy">Observaciones</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-secondary-foreground">{m.notes}</p>
          </div>
        ) : null}
      </section>

      {report.kpis.length ? (
        <section aria-label="Indicadores clave" className="insight-section">
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {report.kpis.map((k) => (
              <li key={k.key} className="break-inside-avoid rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-semibold text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{k.value}</p>
                {k.sub ? <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.flow ? (
        <SectionBlock id="lib-flow" title="Actividad en el tiempo" lead="Nacimientos y abortos del período, separados por unidad del recién nacido.">
          <div className={grid2}>
            <ChartCard title={`Registros por ${report.flow.granularity === 'dia' ? 'día' : report.flow.granularity === 'semana' ? 'semana' : 'mes'}`} className="lg:col-span-2">
              <Activity flow={report.flow} />
            </ChartCard>
            <ChartCard title="Según día de la semana"><HBars items={report.flow.weekday} unit="reg." /></ChartCard>
          </div>
        </SectionBlock>
      ) : null}

      {maternal ? (
        <SectionBlock id="lib-mat" title="Perfil materno" lead="Características de las madres según las columnas de Maternidad.">
          <div className={grid2}>
            <ChartCard title="Edad materna" subtitle="Años cumplidos."><Histogram hist={maternal.age} /></ChartCard>
            <ChartCard title="Grupo de edad"><HBars items={maternal.ageBins} unit="reg." /></ChartCard>
            <ChartCard title="Estado nutricional (IMC)"><HBars items={maternal.bmi} unit="reg." /></ChartCard>
            <ChartCard title="Paridad"><HBars items={maternal.parity} unit="reg." /></ChartCard>
            <ChartCard title="País de origen"><HBars items={maternal.origin} unit="reg." /></ChartCard>
            <ChartCard title="Pueblo originario"><HBars items={maternal.indigenous} unit="reg." /></ChartCard>
            <ChartCard title="Control prenatal"><HBars items={maternal.prenatal} unit="reg." /></ChartCard>
            <ChartCard title="Previsión"><HBars items={maternal.prevision} unit="reg." /></ChartCard>
            <ChartCard title="Procedencia"><HBars items={maternal.procedencia} unit="reg." /></ChartCard>
          </div>
        </SectionBlock>
      ) : null}

      {delivery ? (
        <SectionBlock id="lib-del" title="Parto y vía de nacimiento" lead="Tipo de parto, clasificación de Robson y factores asociados a la cesárea.">
          <div className={grid2}>
            <ChartCard title="Tipo de parto"><HBars items={delivery.type} unit="partos" /></ChartCard>
            <ChartCard title="Clasificación de Robson"><HBars items={delivery.robson} unit="partos" /></ChartCard>
            <ChartCard title="Causa de cesárea"><HBars items={delivery.cesareanCause} unit="ces." /></ChartCard>
            <ChartCard title="Inducción del trabajo de parto"><HBars items={delivery.induction} unit="partos" /></ChartCard>
            <ChartCard title="Rotura prematura de membranas"><HBars items={delivery.rpm} unit="partos" /></ChartCard>
            <ChartCard title="Entrega de placenta"><HBars items={delivery.placenta} unit="partos" /></ChartCard>
            <ChartCard title="Tasa de cesárea según edad materna" subtitle="% de partos que terminaron en cesárea."><HBars items={delivery.cesareaByAge} unit="partos" max={100} /></ChartCard>
            <ChartCard title="Tasa de cesárea según paridad"><HBars items={delivery.cesareaByParity} unit="partos" max={100} /></ChartCard>
            <ChartCard title="Tasa de cesárea según previsión"><HBars items={delivery.cesareaByPrevision} unit="partos" max={100} /></ChartCard>
          </div>
        </SectionBlock>
      ) : null}

      {newborn ? (
        <SectionBlock id="lib-rn" title="Recién nacido" lead="Edad gestacional, peso, adaptación neonatal y apego, con la columna de Neonatología del libro.">
          <div className={grid2}>
            <ChartCard title="Edad gestacional" subtitle="Semanas completas."><Histogram hist={newborn.ga} /></ChartCard>
            <ChartCard title="Peso al nacer"><Histogram hist={newborn.weight} color="fill-magenta" /></ChartCard>
            <ChartCard title="Resumen numérico" className="lg:col-span-2">
              <SummaryTable
                rows={[
                  { label: 'Edad gestacional (sem)', summary: newborn.ga.summary },
                  { label: 'Peso al nacer (g)', summary: newborn.weight.summary },
                ]}
              />
            </ChartCard>
            <ChartCard title="Grupo de edad gestacional"><HBars items={newborn.gaBins} unit="RN" /></ChartCard>
            <ChartCard title="Grupo de peso"><HBars items={newborn.weightBins} unit="RN" /></ChartCard>
            <ChartCard title="Sexo"><HBars items={newborn.sex} unit="RN" /></ChartCard>
            <ChartCard title="Apgar al minuto"><HBars items={newborn.apgar1} unit="RN" /></ChartCard>
            <ChartCard title="Apgar a los 5 minutos"><HBars items={newborn.apgar5} unit="RN" /></ChartCard>
            <ChartCard title="Apego inmediato"><HBars items={newborn.apego} unit="RN" /></ChartCard>
            <ChartCard title="Lactancia en la primera hora"><HBars items={newborn.lactancia1h} unit="RN" /></ChartCard>
            <ChartCard title="Malformación congénita"><HBars items={newborn.malformacion} unit="RN" /></ChartCard>
            {boxCard('Peso según tipo de parto', newborn.weightByType, 'g')}
            {boxCard('Edad gestacional según tipo de parto', newborn.gaByType, 'sem')}
          </div>
          <Kruskal label="Kruskal-Wallis, peso por tipo de parto" k={newborn.weightTest} />
        </SectionBlock>
      ) : null}

      {report.contingency?.length ? (
        <SectionBlock id="lib-cross" title="Asociaciones entre variables" lead="Tablas cruzadas con prueba de chi-cuadrado y V de Cramér.">
          <div className="flex flex-col gap-4">
            {report.contingency.map((t) => (
              <ChartCard key={t.title} title={t.title}><ContingencyView t={t} /></ChartCard>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {report.exams ? (
        <SectionBlock id="lib-exams" title="Exámenes, profilaxis y tamizajes" lead="Positividad de exámenes maternos y cobertura de las medidas preventivas del recién nacido.">
          <div className={grid2}>
            <ChartCard title="Positividad de exámenes maternos"><RateTable rows={report.exams.maternal} /></ChartCard>
            <ChartCard title="Cobertura de profilaxis, vacunas y tamizajes"><RateTable rows={report.exams.coverage} /></ChartCard>
          </div>
        </SectionBlock>
      ) : null}

      {discharge ? (
        <SectionBlock id="lib-alta" title="Alta y estadía" lead="Estadía calculada como los días entre el parto y el alta del recién nacido.">
          <div className={grid2}>
            <ChartCard title="Distribución de la estadía"><Histogram hist={discharge.stay} /></ChartCard>
            <ChartCard title="Alimentación al alta"><HBars items={discharge.feeding} unit="RN" /></ChartCard>
            <ChartCard title="Unidad del recién nacido"><HBars items={discharge.segment} unit="RN" /></ChartCard>
            {boxCard('Estadía según unidad', discharge.stayBySegment, 'días')}
            {boxCard('Estadía según tipo de parto', discharge.stayByType, 'días')}
          </div>
          <Kruskal label="Kruskal-Wallis, estadía por tipo de parto" k={discharge.stayTest} />
        </SectionBlock>
      ) : null}

      {report.shifts ? (
        <SectionBlock id="lib-shift" title="Carga por día y franja horaria" lead="Cuándo ocurren los partos, para dimensionar la dotación de turnos.">
          <div className={grid2}>
            <ChartCard title={report.shifts.heat.title}><HeatGrid heat={report.shifts.heat} /></ChartCard>
            <ChartCard title="Por franja horaria"><HBars items={report.shifts.band} unit="reg." /></ChartCard>
          </div>
        </SectionBlock>
      ) : null}

      {report.quality ? (
        <SectionBlock id="lib-quality" title="Calidad del registro" lead="Qué tan completo está el libro. Los vacíos limitan la confiabilidad de los indicadores.">
          <div className={grid2}>
            <ChartCard title="Completitud por sección"><RateTable rows={report.quality.sections} /></ChartCard>
            <ChartCard title="Columnas con más datos faltantes">
              {report.quality.lowest.length ? (
                <ul className="flex flex-col gap-2.5">
                  {report.quality.lowest.map((l) => (
                    <li key={`${l.section}-${l.label}`}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium text-foreground" title={`${l.label} (${l.section})`}>{l.label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{l.answered}/{l.total} · {fmtNum(l.pct, 0)}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
                        <div className="h-full rounded-full bg-magenta" style={{ width: `${Math.min(100, l.pct)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty />
              )}
            </ChartCard>
          </div>
        </SectionBlock>
      ) : null}

      {report.columns?.length ? (
        <SectionBlock id="lib-cols" title="Columnas elegidas" lead="Detalle de las columnas seleccionadas, con comparación por la variable indicada.">
          <div className="flex flex-col gap-4">
            {report.columns.map((c) => (
              <ChartCard key={c.key} title={c.label} subtitle={`${c.section} · ${c.answered} respuestas`}>
                <div className="flex flex-col gap-4">
                  {c.summary ? <SummaryTable rows={[{ label: c.label, summary: c.summary }]} /> : null}
                  {c.hist ? <Histogram hist={c.hist} /> : null}
                  {c.dist.length ? <HBars items={c.dist} unit="reg." /> : null}
                  {!c.summary && !c.hist && !c.dist.length ? <Empty /> : null}
                  {c.boxes?.length ? <BoxPlots boxes={c.boxes} unit="" /> : null}
                  <Kruskal label="Kruskal-Wallis" k={c.kruskal} />
                  {c.cross ? <ContingencyView t={c.cross} /> : null}
                </div>
              </ChartCard>
            ))}
          </div>
        </SectionBlock>
      ) : null}
    </article>
  )
}
