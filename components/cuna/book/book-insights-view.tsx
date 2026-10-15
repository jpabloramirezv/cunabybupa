'use client'

import { DownloadGate } from '@/components/cuna/download-gate'
import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { BarChart3, ChevronDown, FileSpreadsheet, FileText, Loader2, SlidersHorizontal, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addDaysYmd, fmtYmd, todayYmd } from '@/lib/time'
import {
  DEFAULT_LIBRO_KPIS,
  DEFAULT_LIBRO_SECTIONS,
  type LibroCatalogField,
  type LibroConfig,
  type LibroReport,
} from '@/lib/book-insights'
import { BookInsightsConfig } from '@/components/cuna/book/book-insights-config'
import { BookInsightsReport } from '@/components/cuna/book/book-insights-report'
import { Notice, PrimaryButton } from '@/components/cuna/ui'

function baseConfig(): LibroConfig {
  const to = todayYmd()
  return {
    title: 'Informe estadístico del Libro de Partos',
    subtitle: '',
    notes: '',
    from: addDaysYmd(to, -29),
    to,
    scope: 'todos',
    basis: 'registro',
    granularity: 'auto',
    kpis: DEFAULT_LIBRO_KPIS,
    sections: DEFAULT_LIBRO_SECTIONS,
    filters: [],
    columns: [],
    by: '',
    cross: null,
  }
}

type Preset = { key: string; title: string; help: string; build: () => LibroConfig }

const PRESETS: Preset[] = [
  {
    key: 'gestion',
    title: 'Gestión mensual',
    help: 'Actividad, vía de nacimiento, recién nacidos y calidad del registro de los últimos 30 días.',
    build: () => ({ ...baseConfig(), title: 'Gestión mensual del Libro de Partos' }),
  },
  {
    key: 'cesareas',
    title: 'Cesáreas y Robson',
    help: 'Último año: tasa de cesárea, Robson, causas y su relación con edad, paridad y previsión.',
    build: () => {
      const to = todayYmd()
      return {
        ...baseConfig(),
        title: 'Cesáreas y clasificación de Robson',
        from: addDaysYmd(to, -364),
        to,
        scope: 'nacimientos',
        sections: ['parto', 'materno', 'contingencia', 'calidad'],
        kpis: ['partos', 'cesarea', 'cesareaUrgencia', 'vaginal', 'instrumental', 'induccion', 'rpm', 'primigesta', 'madre35', 'madreAdolescente'],
      }
    },
  },
  {
    key: 'madre',
    title: 'Perfil materno y control',
    help: 'Último año: edad, IMC, paridad, origen, control prenatal y exámenes maternos.',
    build: () => {
      const to = todayYmd()
      return {
        ...baseConfig(),
        title: 'Perfil materno y control prenatal',
        from: addDaysYmd(to, -364),
        to,
        sections: ['materno', 'examenes', 'calidad'],
        kpis: ['registros', 'edadMediana', 'madre35', 'madreAdolescente', 'obesidad', 'primigesta', 'controlPrenatal'],
      }
    },
  },
  {
    key: 'turnos',
    title: 'Carga por turnos',
    help: 'Últimos 90 días: mapa de calor por día y franja horaria para dimensionar la dotación.',
    build: () => {
      const to = todayYmd()
      return {
        ...baseConfig(),
        title: 'Carga de partos por día y franja horaria',
        from: addDaysYmd(to, -89),
        to,
        sections: ['flujo', 'turnos'],
        kpis: ['registros', 'partos', 'abortos', 'promedioDia', 'cesarea'],
      }
    },
  },
]

type CatalogResponse = { catalog: LibroCatalogField[] }

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo cargar.')
  return (await res.json()) as T
}

async function readError(res: Response) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? (res.status === 403 ? 'Tu perfil no tiene acceso a los informes.' : 'No se pudo completar la acción.')
}

export function BookInsightsView() {
  const [config, setConfig] = useState<LibroConfig>(baseConfig)
  const [report, setReport] = useState<LibroReport | null>(null)
  const [applied, setApplied] = useState<LibroConfig | null>(null)
  const [busy, setBusy] = useState<'run' | 'excel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(true)
  const reportRef = useRef<HTMLDivElement>(null)

  const { data: catalogData } = useSWR<CatalogResponse>(
    `/api/book/report?from=${config.from}&to=${config.to}&scope=todos`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  )
  const catalog = catalogData?.catalog ?? []

  const appliedKey = useMemo(() => (applied ? JSON.stringify(reportKey(applied)) : ''), [applied])
  const stale = !!report && appliedKey !== JSON.stringify(reportKey(config))
  const invalid = config.from > config.to || (config.sections.length === 0 && config.kpis.length === 0)

  const run = async (cfg: LibroConfig = config) => {
    setBusy('run')
    setError(null)
    try {
      const res = await fetch('/api/book/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg }),
      })
      if (!res.ok) throw new Error(await readError(res))
      setReport((await res.json()) as LibroReport)
      setApplied(cfg)
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
    if (!report || !applied) return
    setBusy('excel')
    setError(null)
    try {
      const res = await fetch('/api/book/insights/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: applied }),
      })
      if (!res.ok) throw new Error(await readError(res))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `informe-libro-partos-${report.meta.from}_${report.meta.to}.xlsx`
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
    document.title = `Informe Libro de Partos ${report.meta.from} a ${report.meta.to}`
    const restore = () => {
      document.title = previous
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  const filterCount = config.filters.filter((f) => f.values.length).length

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <h2 className="text-xl font-bold text-navy text-balance">Generador de informes estadísticos</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">
          Elige el período, los registros del libro, los indicadores y los análisis. El sistema calcula distribuciones, tasas con intervalos de confianza y pruebas estadísticas, y lo deja listo para PDF o Excel. No incluye datos de identificación.
        </p>
      </div>

      <section aria-labelledby="lib-presets" className="print:hidden">
        <h3 id="lib-presets" className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Empieza con una plantilla
        </h3>
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
          {fmtYmd(config.from)} a {fmtYmd(config.to)} · {config.sections.length} análisis · {filterCount ? `${filterCount} filtros` : 'sin filtros'}
          {stale ? <span className="ml-2 font-semibold text-magenta">Cambios sin aplicar</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton className="h-11 px-5 text-sm" disabled={busy !== null || invalid} onClick={() => run()}>
            {busy === 'run' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BarChart3 className="size-4" aria-hidden />}
            {report ? (stale ? 'Actualizar informe' : 'Volver a generar') : 'Generar informe'}
          </PrimaryButton>
          <DownloadGate>
            <PrimaryButton variant="outline" className="h-11 px-4 text-sm" disabled={!report || busy !== null} onClick={printPdf}>
              <FileText className="size-4" aria-hidden />
              PDF
            </PrimaryButton>
            <PrimaryButton variant="outline" className="h-11 px-4 text-sm" disabled={!report || busy !== null} onClick={downloadExcel}>
              {busy === 'excel' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="size-4" aria-hidden />}
              Excel
            </PrimaryButton>
          </DownloadGate>
        </div>
      </div>

      {error ? <Notice tone="danger" title="No se pudo completar">{error}</Notice> : null}

      {showConfig ? <BookInsightsConfig config={config} catalog={catalog} onChange={setConfig} /> : null}

      <div ref={reportRef} className="scroll-mt-24" aria-busy={busy === 'run'}>
        {report ? (
          <div className={cn('transition-opacity', busy === 'run' && 'opacity-50')}>
            {stale ? (
              <Notice tone="info" className="mb-4 print:hidden">
                Cambiaste la configuración. Este informe aún muestra la anterior; pulsa Actualizar informe para ver los cambios. El PDF y el Excel usan el informe que ves.
              </Notice>
            ) : null}
            <BookInsightsReport report={report} />
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

function reportKey(c: LibroConfig) {
  return { ...c, filters: c.filters.filter((f) => f.values.length) }
}
