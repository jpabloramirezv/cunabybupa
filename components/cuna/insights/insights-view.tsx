'use client'

import { useMemo, useRef, useState } from 'react'
import { BarChart3, ChevronDown, FileSpreadsheet, FileText, Loader2, SlidersHorizontal, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { defaultConfig, emptyFilters, type InsightConfig, type InsightReport } from '@/lib/insights'
import { addDaysYmd, fmtYmd, todayYmd } from '@/lib/time'
import { ConfigPanel, activeFilterCount } from '@/components/cuna/insights/config-panel'
import { ReportView } from '@/components/cuna/insights/report'
import { Notice, PrimaryButton } from '@/components/cuna/ui'

type Preset = { key: string; title: string; help: string; build: () => InsightConfig }

const PRESETS: Preset[] = [
  {
    key: 'gestion',
    title: 'Gestión mensual',
    help: 'Ingresos, egresos, ocupación y casos abiertos de los últimos 30 días.',
    build: () => {
      const to = todayYmd()
      return { ...defaultConfig(), title: 'Informe de gestión mensual', from: addDaysYmd(to, -29), to }
    },
  },
  {
    key: 'estadia',
    title: 'Estadía y complejidad',
    help: 'Egresos del último año con estadía, perfil y cruces por edad gestacional y peso.',
    build: () => {
      const to = todayYmd()
      return {
        ...defaultConfig(),
        title: 'Estadía hospitalaria y complejidad',
        from: addDaysYmd(to, -364),
        to,
        basis: 'egresos',
        sections: ['estadia', 'perfil', 'contingencia', 'alta'],
        kpis: ['cohorte', 'estadiaMediana', 'estadiaP90', 'estadiaMax', 'prematuros', 'muyBajoPeso', 'reingreso'],
      }
    },
  },
  {
    key: 'prematuros',
    title: 'Prematuros',
    help: 'Solo RN menores de 37 semanas del último año, con bilirrubina, tamizajes y alta.',
    build: () => {
      const to = todayYmd()
      return {
        ...defaultConfig(),
        title: 'Seguimiento de prematuros',
        from: addDaysYmd(to, -364),
        to,
        filters: { ...emptyFilters(), gaGroup: ['extremo', 'muy', 'moderado'] },
        sections: ['flujo', 'estadia', 'perfil', 'bilirrubina', 'tamizajes', 'alta'],
      }
    },
  },
  {
    key: 'calidad',
    title: 'Calidad del registro',
    help: 'Completitud de fichas, tiempos de registro, turnos y pendientes de los últimos 90 días.',
    build: () => {
      const to = todayYmd()
      return {
        ...defaultConfig(),
        title: 'Calidad del registro clínico',
        from: addDaysYmd(to, -89),
        to,
        sections: ['calidad', 'turnos', 'atencion', 'tamizajes'],
        kpis: ['cohorte', 'oportunidad', 'mismoTurno', 'tamizajes', 'atencion', 'prolongadas'],
      }
    },
  },
]

async function readError(res: Response) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? (res.status === 403 ? 'Tu perfil no tiene acceso a los informes.' : 'No se pudo completar la acción.')
}

export function InsightsView() {
  const [config, setConfig] = useState<InsightConfig>(() => PRESETS[0].build())
  const [report, setReport] = useState<InsightReport | null>(null)
  const [busy, setBusy] = useState<'run' | 'excel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(true)
  const reportRef = useRef<HTMLDivElement>(null)

  const stale = useMemo(() => !!report && JSON.stringify(report.config) !== JSON.stringify(config), [report, config])
  const invalid = config.from > config.to || config.sections.length === 0 && config.kpis.length === 0

  const run = async (cfg: InsightConfig = config) => {
    setBusy('run')
    setError(null)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg }),
      })
      if (!res.ok) throw new Error(await readError(res))
      setReport((await res.json()) as InsightReport)
      setShowConfig(false)
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el informe.')
    } finally {
      setBusy(null)
    }
  }

  const applyPreset = (p: Preset) => {
    const cfg = p.build()
    setConfig(cfg)
    void run(cfg)
  }

  const downloadExcel = async () => {
    if (!report) return
    setBusy('excel')
    setError(null)
    try {
      const res = await fetch('/api/insights/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: report.config }),
      })
      if (!res.ok) throw new Error(await readError(res))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `insights-neonatologia-${report.config.from}_${report.config.to}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar el Excel.')
    } finally {
      setBusy(null)
    }
  }

  const printPdf = () => {
    if (!report) return
    const previous = document.title
    document.title = `Informe ${report.config.from} a ${report.config.to}`
    const restore = () => {
      document.title = previous
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-navy text-balance">Informes estadísticos</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">
          Elige qué analizar, el período y los filtros. El sistema calcula indicadores, series de tiempo, distribuciones y pruebas estadísticas, y lo deja listo para PDF o Excel. No incluye datos de identificación.
        </p>
      </div>

      <section aria-labelledby="ins-presets" className="print:hidden">
        <h2 id="ins-presets" className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Empieza con una plantilla
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PRESETS.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => applyPreset(p)}
                className="flex h-full w-full flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-60"
              >
                <span className="text-sm font-bold text-navy">{p.title}</span>
                <span className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.help}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
        <button
          type="button"
          onClick={() => setShowConfig((v) => !v)}
          aria-expanded={showConfig}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Configuración
          <ChevronDown className={cn('size-4 transition-transform', showConfig && 'rotate-180')} aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground" aria-live="polite">
          {fmtYmd(config.from)} a {fmtYmd(config.to)} · {config.sections.length} análisis · {activeFilterCount(config.filters) ? `${activeFilterCount(config.filters)} filtros` : 'sin filtros'}
          {stale ? <span className="ml-2 font-semibold text-magenta">Cambios sin aplicar</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton className="h-11 px-5 text-sm" disabled={busy !== null || invalid} onClick={() => run()}>
            {busy === 'run' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BarChart3 className="size-4" aria-hidden />}
            {report ? (stale ? 'Actualizar informe' : 'Volver a generar') : 'Generar informe'}
          </PrimaryButton>
          <PrimaryButton variant="outline" className="h-11 px-4 text-sm" disabled={!report || busy !== null} onClick={printPdf}>
            <FileText className="size-4" aria-hidden />
            PDF
          </PrimaryButton>
          <PrimaryButton variant="outline" className="h-11 px-4 text-sm" disabled={!report || busy !== null} onClick={downloadExcel}>
            {busy === 'excel' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4" aria-hidden />}
            Excel
          </PrimaryButton>
        </div>
      </div>

      {error ? <Notice tone="danger" title="No se pudo completar">{error}</Notice> : null}

      {showConfig ? <ConfigPanel config={config} onChange={setConfig} /> : null}

      <div ref={reportRef} className="scroll-mt-24" aria-busy={busy === 'run'}>
        {report ? (
          <div className={cn('transition-opacity', busy === 'run' && 'opacity-50')}>
            {stale ? (
              <Notice tone="info" className="mb-4 print:hidden">
                Cambiaste la configuración. Este informe aún muestra la anterior; pulsa Actualizar informe para ver los cambios. El PDF y el Excel usan el informe que ves.
              </Notice>
            ) : null}
            <ReportView report={report} />
          </div>
        ) : busy === 'run' ? (
          <p className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground" role="status">
            Calculando indicadores y pruebas estadísticas…
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-16 text-center print:hidden">
            <BarChart3 className="size-8 text-primary" aria-hidden />
            <p className="text-base font-semibold text-navy">Tu informe aparecerá aquí</p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Ajusta la configuración o elige una plantilla y pulsa Generar informe. Luego podrás descargarlo en PDF o Excel.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
