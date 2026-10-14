import type { ReactNode } from 'react'
import type { InsightReport } from '@/lib/insights'
import { fmtNum, fmtP, type Summary } from '@/lib/stats'
import { fmtYmd } from '@/lib/time'
import {
  BoxPlots,
  ChartCard,
  ContingencyView,
  Empty,
  HBars,
  HeatGrid,
  Histogram,
  LineSeries,
  StackedBars,
} from '@/components/cuna/insights/charts'

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

const fmtS = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '—' : fmtNum(v, d))

function SummaryTable({ rows }: { rows: { label: string; summary: Summary | null }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {['Grupo', 'n', 'Media', 'DE', 'Mín', 'Q1', 'Mediana', 'Q3', 'P90', 'Máx'].map((h, i) => (
              <th key={h} scope="col" className={`py-2 font-semibold ${i === 0 ? 'pr-3' : 'px-2 text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60">
              <th scope="row" className="py-2 pr-3 font-medium text-foreground">{r.label}</th>
              {r.summary ? (
                <>
                  <td className="px-2 py-2 text-right tabular-nums">{r.summary.n}</td>
                  {[r.summary.mean, r.summary.sd, r.summary.min, r.summary.q1, r.summary.median, r.summary.q3, r.summary.p90, r.summary.max].map((v, i) => (
                    <td key={i} className={`px-2 py-2 text-right tabular-nums ${i === 4 ? 'font-semibold text-navy' : ''}`}>{fmtS(v)}</td>
                  ))}
                </>
              ) : (
                <td colSpan={9} className="px-2 py-2 text-right text-muted-foreground">sin datos</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportView({ report }: { report: InsightReport }) {
  const c = report.config
  const when = new Date(report.generatedAt).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'long', timeStyle: 'short' })
  const grid2 = 'grid gap-4 lg:grid-cols-2'
  const los = report.los

  return (
    <article id="insight-report" className="flex flex-col gap-8" aria-label="Informe estadístico">
      <header className="insight-cover rounded-2xl border border-border bg-card p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Informe estadístico</p>
        <h1 className="mt-1 text-3xl font-bold text-navy text-balance">{c.title}</h1>
        {c.subtitle ? <p className="mt-1 text-base text-muted-foreground">{c.subtitle}</p> : null}
        <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-foreground">Período</dt>
            <dd className="text-muted-foreground">{fmtYmd(c.from)} a {fmtYmd(c.to)} ({report.period.days} días)</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Población</dt>
            <dd className="text-muted-foreground">{report.basisLabel} · {report.cohort.n} RN{report.cohort.beforeFilters !== report.cohort.n ? ` de ${report.cohort.beforeFilters} sin filtros` : ''}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Filtros</dt>
            <dd className="text-muted-foreground">{report.filterNotes.length ? report.filterNotes.join(' · ') : 'Sin filtros: todos los RN'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Generado</dt>
            <dd className="text-muted-foreground">{when} por {report.generatedBy}</dd>
          </div>
        </dl>
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Informe sin datos de identificación: solo código interno y variables clínicas. Los valores p son orientativos y no corrigen comparaciones múltiples.
        </p>
      </header>

      <section aria-labelledby="ins-headline" className="rounded-2xl border border-primary/30 bg-secondary p-6">
        <h2 id="ins-headline" className="text-lg font-bold text-navy">Lo más importante</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {report.headline.map((h, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-secondary-foreground text-pretty">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              {h}
            </li>
          ))}
        </ul>
        {c.notes ? (
          <div className="mt-4 border-t border-primary/20 pt-3">
            <p className="text-sm font-semibold text-navy">Observaciones</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-secondary-foreground">{c.notes}</p>
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
        <SectionBlock id="ins-flow" title="Flujo y ocupación" lead="Cuántos RN entran, salen y siguen hospitalizados a lo largo del tiempo. Los picos muestran sobrecarga; las bajadas, holgura.">
          <ChartCard title="Ingresos, egresos y hospitalizados" subtitle={`Agrupado por ${report.flow.granularity === 'dia' ? 'día' : report.flow.granularity === 'semana' ? 'semana' : 'mes'}.`}>
            <LineSeries points={report.flow.points} />
          </ChartCard>
        </SectionBlock>
      ) : null}

      {los ? (
        <SectionBlock id="ins-los" title="Estadía hospitalaria" lead={`Días entre el nacimiento y el egreso. ${los.openCount ? `${los.openCount} RN siguen hospitalizados y no se incluyen aquí.` : 'Incluye todos los egresos de la población.'} La mediana resiste mejor que el promedio a las estadías muy largas.`}>
          <div className={grid2}>
            <ChartCard title="Distribución de la estadía" subtitle="Histograma: cuántos RN por rango de días."><Histogram hist={los.hist} /></ChartCard>
            <ChartCard title="Estadía según edad gestacional" subtitle="Boxplot por grupo.">
              <BoxPlots boxes={los.byGa} />
            </ChartCard>
          </div>
          <div className={grid2}>
            <ChartCard title="Estadía según peso al nacer"><BoxPlots boxes={los.byWeight} /></ChartCard>
            <ChartCard title="Estadía según tipo de parto"><BoxPlots boxes={los.byDelivery} /></ChartCard>
          </div>
          <ChartCard title="Tabla resumen por grupo" subtitle="En días. DE: desviación estándar. Q1 y Q3: cuartiles. P90: percentil 90.">
            <SummaryTable rows={los.groupTable} />
          </ChartCard>
          <ChartCard title="Pruebas estadísticas" subtitle="No paramétricas: no suponen distribución normal.">
            <ul className="flex flex-col gap-2 text-sm leading-relaxed text-foreground">
              {los.kruskalGa ? <li><strong>Kruskal-Wallis por edad gestacional:</strong> H = {fmtNum(los.kruskalGa.h, 2)}, gl = {los.kruskalGa.df}, {fmtP(los.kruskalGa.p)}.</li> : null}
              {los.kruskalWeight ? <li><strong>Kruskal-Wallis por peso:</strong> H = {fmtNum(los.kruskalWeight.h, 2)}, gl = {los.kruskalWeight.df}, {fmtP(los.kruskalWeight.p)}.</li> : null}
              {los.spearmanGa ? <li><strong>Correlación de Spearman, EG y estadía:</strong> rho = {fmtNum(los.spearmanGa.rho, 2)} (n = {los.spearmanGa.n}), {fmtP(los.spearmanGa.p)}.</li> : null}
              {los.spearmanWeight ? <li><strong>Correlación de Spearman, peso y estadía:</strong> rho = {fmtNum(los.spearmanWeight.rho, 2)} (n = {los.spearmanWeight.n}), {fmtP(los.spearmanWeight.p)}.</li> : null}
              {!los.kruskalGa && !los.kruskalWeight && !los.spearmanGa && !los.spearmanWeight ? <li className="text-muted-foreground">No hay datos suficientes para estas pruebas.</li> : null}
            </ul>
          </ChartCard>
        </SectionBlock>
      ) : null}

      {report.profile ? (
        <SectionBlock id="ins-profile" title="Perfil de los recién nacidos" lead="Cómo son los RN de esta población al nacer: edad gestacional, peso, APGAR, sexo, parto y previsión.">
          <div className={grid2}>
            <ChartCard title="Edad gestacional" subtitle="Semanas completas."><Histogram hist={report.profile.gaHist} /></ChartCard>
            <ChartCard title="Peso al nacer"><Histogram hist={report.profile.weightHist} color="fill-magenta" /></ChartCard>
          </div>
          <div className={grid2}>
            <ChartCard title="Grupos de edad gestacional"><HBars items={report.profile.gaGroups} /></ChartCard>
            <ChartCard title="Grupos de peso"><HBars items={report.profile.weightGroups} /></ChartCard>
          </div>
          <div className={grid2}>
            <ChartCard title="APGAR a los 5 minutos"><HBars items={report.profile.apgar5} /></ChartCard>
            <ChartCard title="Sexo"><HBars items={report.profile.sex} /></ChartCard>
            <ChartCard title="Tipo de parto"><HBars items={report.profile.delivery} /></ChartCard>
            <ChartCard title="Previsión"><HBars items={report.profile.prevision} /></ChartCard>
            <ChartCard title="Procedimiento de ingreso"><HBars items={report.profile.procedimiento} /></ChartCard>
            <ChartCard title="Diagnósticos de ingreso más frecuentes"><HBars items={report.profile.dxIngreso} /></ChartCard>
          </div>
        </SectionBlock>
      ) : null}

      {report.contingency ? (
        <SectionBlock id="ins-cont" title="Cruces entre variables" lead="Tablas de contingencia con porcentajes por fila. La prueba chi-cuadrado indica si la diferencia entre filas es mayor a la esperable por azar.">
          {report.contingency.map((t) => (
            <ChartCard key={t.title} title={t.title}><ContingencyView t={t} /></ChartCard>
          ))}
        </SectionBlock>
      ) : null}

      {report.screening ? (
        <SectionBlock id="ins-scr" title="Tamizajes y vacunas" lead={`Estado de cada tamizaje en la población. Resueltos (realizado o rechazado): ${report.screening.overallPct === null ? '—' : `${fmtNum(report.screening.overallPct, 1)} %`}. Un tamizaje pendiente no es un atraso: solo indica que aún no se registra.`}>
          <ChartCard title="Estado por tamizaje"><StackedBars items={report.screening.byKind} /></ChartCard>
        </SectionBlock>
      ) : null}

      {report.bili ? (
        <SectionBlock id="ins-bili" title="Hiperbilirrubinemia" lead="Frecuencia, relación con la edad gestacional y rapidez con que se inicia la fototerapia.">
          <div className={grid2}>
            <ChartCard title="Frecuencia" subtitle="Intervalo de confianza de Wilson al 95 %.">
              <p className="text-4xl font-bold tabular-nums text-navy">{report.bili.pct === null ? '—' : `${fmtNum(report.bili.pct, 1)}%`}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.bili.withBili} de {report.bili.known} RN con dato
                {report.bili.ci ? ` · IC 95 %: ${fmtNum(report.bili.ci[0], 1)} a ${fmtNum(report.bili.ci[1], 1)} %` : ''}
              </p>
            </ChartCard>
            <ChartCard title="Según edad gestacional"><HBars items={report.bili.byGa} unit="casos" max={100} /></ChartCard>
          </div>
          <ChartCard title="Horas hasta el inicio de la fototerapia" subtitle={`${report.bili.phototherapyN} RN con fototerapia registrada.`}>
            <Histogram hist={report.bili.hist} color="fill-magenta" />
          </ChartCard>
        </SectionBlock>
      ) : null}

      {report.discharge ? (
        <SectionBlock id="ins-alta" title="Alta y destino" lead={`Cómo y hacia dónde salen los RN (${report.discharge.n} egresos en la población).`}>
          <div className={grid2}>
            <ChartCard title="Destino al alta"><HBars items={report.discharge.destino} /></ChartCard>
            <ChartCard title="Alimentación al alta"><HBars items={report.discharge.feeding} /></ChartCard>
            <ChartCard title="Diagnósticos de egreso más frecuentes"><HBars items={report.discharge.dxEgreso} /></ChartCard>
            <ChartCard title="Variación de peso desde el nacimiento" subtitle="Porcentaje respecto del peso al nacer."><Histogram hist={report.discharge.weightChange} color="fill-magenta" /></ChartCard>
          </div>
        </SectionBlock>
      ) : null}

      {report.shifts ? (
        <SectionBlock id="ins-turnos" title="Turnos y horarios" lead="Cuándo se concentra el trabajo. Sirve para dimensionar dotación y repartir cargas entre turnos de día y de noche.">
          <div className={grid2}>
            <ChartCard title="Ingresos por turno"><HBars items={report.shifts.ingresosByShift} /></ChartCard>
            <ChartCard title="Egresos por turno"><HBars items={report.shifts.egresosByShift} /></ChartCard>
          </div>
          <ChartCard title={report.shifts.heatIngresos.title}><HeatGrid heat={report.shifts.heatIngresos} /></ChartCard>
          <ChartCard title={report.shifts.heatEgresos.title}><HeatGrid heat={report.shifts.heatEgresos} /></ChartCard>
        </SectionBlock>
      ) : null}

      {report.attention ? (
        <SectionBlock id="ins-atencion" title="Casos abiertos" lead="RN hospitalizados al cierre del período con algo por resolver. No es un atraso: las hospitalizaciones pueden ser largas y es lo esperable en casos críticos. Refleja el estado actual de la ficha.">
          {report.attention.open === 0 ? (
            <Empty>No había RN hospitalizados al cierre del período con estos filtros.</Empty>
          ) : (
            <>
              <div className={grid2}>
                <ChartCard title="Motivos" subtitle={`Sobre ${report.attention.open} hospitalizados. Un RN puede tener varios.`}><HBars items={report.attention.reasons} /></ChartCard>
                <ChartCard title="Tiempo de hospitalización"><HBars items={report.attention.stayBands} /></ChartCard>
              </div>
              <ChartCard title="Hospitalizaciones más largas" subtitle="Hasta 10 casos, por código interno.">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th scope="col" className="py-2 pr-3 font-semibold">Código</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Días</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">EG</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Peso</th>
                        <th scope="col" className="py-2 pl-3 font-semibold">Motivos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.attention.longest.map((x) => (
                        <tr key={x.id} className="border-b border-border/60 align-top">
                          <th scope="row" className="py-2 pr-3 font-semibold text-navy">{x.code}</th>
                          <td className="px-2 py-2 text-right tabular-nums">{fmtNum(x.days, 0)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{x.gaWeeks === null ? '—' : `${x.gaWeeks} sem`}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{x.weightG === null ? '—' : `${fmtNum(x.weightG, 0)} g`}</td>
                          <td className="py-2 pl-3 text-muted-foreground">{x.reasons.length ? x.reasons.join(' · ') : 'Sin pendientes'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            </>
          )}
        </SectionBlock>
      ) : null}

      {report.quality ? (
        <SectionBlock id="ins-calidad" title="Calidad del registro" lead="Qué tan completas están las fichas y cuánto tardan en completarse. Ayuda a decidir dónde reforzar el registro.">
          <div className={grid2}>
            <ChartCard title="Completitud por campo" subtitle="Porcentaje de fichas con el campo completo."><HBars items={report.quality.completeness} unit="fichas" max={100} /></ChartCard>
            <div className="flex flex-col gap-4">
              <ChartCard title="Horas hasta completar la ficha" subtitle={report.quality.sameShiftPct === null ? undefined : `${fmtNum(report.quality.sameShiftPct, 0)} % se completa en el mismo turno del ingreso.`}>
                <Histogram hist={report.quality.lagHist} />
              </ChartCard>
              <ChartCard title="Según turno de ingreso"><BoxPlots boxes={report.quality.lagByShift} unit="horas" /></ChartCard>
            </div>
          </div>
        </SectionBlock>
      ) : null}

      <footer className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        Medianas y cuartiles describen mejor estadías asimétricas que el promedio. Los intervalos de confianza son de Wilson al 95 %. Los valores p provienen de pruebas no paramétricas
        (Kruskal-Wallis, Spearman) y chi-cuadrado, y deben leerse junto al tamaño de la muestra.
      </footer>
    </article>
  )
}
