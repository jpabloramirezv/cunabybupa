import ExcelJS from 'exceljs'
import { fmtYmd } from '@/lib/time'
import { fmtNum, fmtP } from '@/lib/stats'
import type { Bar, Box } from '@/lib/insights'
import type { LibroRate, LibroReport } from '@/lib/book-insights'
import { Sheet, SUM_HEAD, bars, boxRows, contingency, histRows, sum } from '@/lib/server/insights-excel'

const BOX_HEAD = ['Grupo', 'n', 'Q1', 'Mediana', 'Q3', 'Bigote inf.', 'Bigote sup.', 'Atípicos']
const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)
const rateRows = (list: LibroRate[]) =>
  list.map((r) => [r.label, r.n, r.total, r1(r.pct), r.ci ? `${fmtNum(r.ci[0])} a ${fmtNum(r.ci[1])} %` : '', r.note ?? ''])
const RATE_HEAD = ['Indicador', 'Casos', 'Con dato', '%', 'IC 95 %', 'Nota']

export async function buildLibroWorkbook(report: LibroReport, data: Record<string, string>[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cuna · Libro de Partos y Abortos'
  wb.created = new Date(report.meta.generatedAt)

  const s0 = new Sheet(wb, 'Resumen', [46, 18, 36])
  s0.title(report.meta.title)
  if (report.meta.subtitle) s0.note(report.meta.subtitle)
  s0.note(`Período: ${fmtYmd(report.meta.from)} a ${fmtYmd(report.meta.to)} · Criterio: ${report.meta.basisLabel} · Alcance: ${report.meta.scopeLabel}`)
  s0.note(`Registros analizados: ${report.cohort.n} (antes de filtros: ${report.cohort.beforeFilters})`)
  s0.note(`Generado por ${report.meta.generatedBy} el ${new Date(report.meta.generatedAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`)
  if (report.cohort.filters.length) s0.note(`Filtros: ${report.cohort.filters.map((f) => `${f.label}: ${f.values.join(', ')}`).join(' · ')}`)
  s0.heading('Indicadores clave')
  s0.table(['Indicador', 'Valor', 'Detalle'], report.kpis.map((k) => [k.label, k.value, k.sub ?? '']))
  s0.heading('Hallazgos automáticos')
  report.highlights.forEach((h) => s0.note(`• ${h}`))
  if (report.meta.notes) {
    s0.heading('Observaciones del autor')
    s0.note(report.meta.notes)
  }

  if (report.flow) {
    const sh = new Sheet(wb, 'Actividad', [24, 14, 14, 14, 14])
    sh.title(`Actividad (${report.flow.granularity === 'dia' ? 'diaria' : report.flow.granularity === 'semana' ? 'semanal' : 'mensual'})`)
    sh.table(['Período', 'Nursery', 'UCI Neonatal', 'Abortos', 'Total'], report.flow.points.map((p) => [p.label, p.nursery, p.uci, p.abortos, p.total]), 4)
    sh.heading('Por día de la semana')
    sh.table(['Día', 'Registros', '%'], bars(report.flow.weekday), 1)
  }

  const dist = (sh: Sheet, title: string, b: Bar[]) => {
    sh.heading(title)
    sh.table(['Categoría', 'Registros', '%'], bars(b), 1)
  }
  const boxes = (sh: Sheet, title: string, b: Box[]) => {
    if (!b.length) return
    sh.heading(title)
    sh.table(BOX_HEAD, boxRows(b))
  }

  if (report.maternal) {
    const m = report.maternal
    const sh = new Sheet(wb, 'Perfil materno', [46, 14, 14])
    sh.title('Perfil materno')
    sh.heading('Edad materna (años)')
    sh.table(['Rango', 'Registros'], histRows(m.age), 1)
    sh.table(['n', 'Media', 'DE', 'Mín', 'Mediana', 'Máx'], m.age.summary ? [[m.age.summary.n, r1(m.age.summary.mean), r1(m.age.summary.sd), m.age.summary.min, r1(m.age.summary.median), m.age.summary.max]] : [])
    dist(sh, 'Grupo de edad', m.ageBins)
    dist(sh, 'Estado nutricional (IMC)', m.bmi)
    dist(sh, 'Paridad', m.parity)
    dist(sh, 'País de origen', m.origin)
    dist(sh, 'Pueblo originario', m.indigenous)
    dist(sh, 'Control prenatal', m.prenatal)
    dist(sh, 'Previsión', m.prevision)
    dist(sh, 'Procedencia', m.procedencia)
  }

  if (report.delivery) {
    const d = report.delivery
    const sh = new Sheet(wb, 'Parto', [46, 14, 14])
    sh.title('Parto y vía de nacimiento')
    dist(sh, 'Tipo de parto', d.type)
    dist(sh, 'Clasificación de Robson', d.robson)
    dist(sh, 'Causa de cesárea', d.cesareanCause)
    dist(sh, 'Inducción', d.induction)
    dist(sh, 'Rotura prematura de membranas', d.rpm)
    dist(sh, 'Entrega de placenta', d.placenta)
    for (const [t, b] of [
      ['Tasa de cesárea según edad materna', d.cesareaByAge],
      ['Tasa de cesárea según paridad', d.cesareaByParity],
      ['Tasa de cesárea según previsión', d.cesareaByPrevision],
    ] as const) {
      sh.heading(t)
      sh.table(['Grupo', 'Partos', '% cesárea'], bars(b), 2)
    }
  }

  if (report.newborn) {
    const n = report.newborn
    const sh = new Sheet(wb, 'Recién nacido', [46, 14, 14, 12, 12, 12, 12, 12, 12])
    sh.title('Recién nacido')
    sh.heading('Edad gestacional (semanas)')
    sh.table(['Semanas', 'RN'], histRows(n.ga), 1)
    sh.heading('Peso al nacer (g)')
    sh.table(['Rango', 'RN'], histRows(n.weight), 1)
    sh.heading('Resumen numérico')
    sh.table(['Variable', ...SUM_HEAD], [['Edad gestacional', ...sum(n.ga.summary)], ['Peso al nacer', ...sum(n.weight.summary)]])
    dist(sh, 'Grupo de edad gestacional', n.gaBins)
    dist(sh, 'Grupo de peso', n.weightBins)
    dist(sh, 'Sexo', n.sex)
    dist(sh, "Apgar al minuto", n.apgar1)
    dist(sh, "Apgar a los 5 minutos", n.apgar5)
    dist(sh, 'Apego inmediato', n.apego)
    dist(sh, 'Lactancia en la primera hora', n.lactancia1h)
    dist(sh, 'Malformación congénita', n.malformacion)
    boxes(sh, 'Peso según tipo de parto', n.weightByType)
    boxes(sh, 'Edad gestacional según tipo de parto', n.gaByType)
    if (n.weightTest) sh.note(`Kruskal-Wallis peso por tipo de parto: H = ${fmtNum(n.weightTest.h, 2)}, gl = ${n.weightTest.df}, ${fmtP(n.weightTest.p)}`)
  }

  if (report.contingency?.length) {
    const sh = new Sheet(wb, 'Asociaciones', [34, 16, 16, 16, 16, 16, 16, 16])
    sh.title('Tablas cruzadas y pruebas de asociación')
    report.contingency.forEach((t) => contingency(sh, t))
  }

  if (report.exams) {
    const sh = new Sheet(wb, 'Exámenes y coberturas', [52, 12, 12, 12, 20, 28])
    sh.title('Exámenes, profilaxis y tamizajes')
    sh.heading('Positividad de exámenes maternos')
    sh.table(RATE_HEAD, rateRows(report.exams.maternal))
    sh.heading('Coberturas')
    sh.table(RATE_HEAD, rateRows(report.exams.coverage))
  }

  if (report.discharge) {
    const d = report.discharge
    const sh = new Sheet(wb, 'Alta y estadía', [46, 14, 14, 12, 12, 12, 12, 12])
    sh.title('Alta y estadía')
    dist(sh, 'Alimentación al alta', d.feeding)
    dist(sh, 'Unidad del recién nacido', d.segment)
    sh.heading('Estadía (días entre el parto y el alta)')
    sh.table(['Días', 'RN'], histRows(d.stay), 1)
    boxes(sh, 'Estadía según unidad', d.stayBySegment)
    boxes(sh, 'Estadía según tipo de parto', d.stayByType)
    if (d.stayTest) sh.note(`Kruskal-Wallis estadía por tipo de parto: H = ${fmtNum(d.stayTest.h, 2)}, gl = ${d.stayTest.df}, ${fmtP(d.stayTest.p)}`)
  }

  if (report.shifts) {
    const sh = new Sheet(wb, 'Día y franja', [18, 14, 14, 14, 14])
    sh.title(report.shifts.heat.title)
    sh.table(['Día', ...report.shifts.heat.cols], report.shifts.heat.rows.map((r, i) => [r, ...report.shifts!.heat.cells[i]]))
    dist(sh, 'Por franja horaria', report.shifts.band)
  }

  if (report.quality) {
    const sh = new Sheet(wb, 'Calidad', [52, 14, 14, 12, 20, 28])
    sh.title('Calidad del registro')
    sh.table(RATE_HEAD, rateRows(report.quality.sections))
    sh.heading('Columnas con más datos faltantes')
    sh.table(['Columna', 'Grupo', 'Con dato', 'Esperados', '% completo'], report.quality.lowest.map((l) => [l.label, l.section, l.answered, l.total, l.pct]))
  }

  if (report.columns?.length) {
    const sh = new Sheet(wb, 'Columnas elegidas', [40, 14, 14, 12, 12, 12, 12, 12, 12])
    sh.title('Columnas elegidas')
    for (const c of report.columns) {
      sh.heading(`${c.label} · ${c.answered} respuestas`)
      if (c.summary) sh.table(['', ...SUM_HEAD], [['Resumen', ...sum(c.summary)]])
      if (c.dist.length) sh.table(['Categoría', 'Registros', '%'], bars(c.dist), 1)
      if (c.hist) sh.table(['Rango', 'Registros'], histRows(c.hist), 1)
      if (c.boxes) boxes(sh, 'Comparación por grupo', c.boxes)
      if (c.kruskal) sh.note(`Kruskal-Wallis: H = ${fmtNum(c.kruskal.h, 2)}, gl = ${c.kruskal.df}, ${fmtP(c.kruskal.p)}`)
      if (c.cross) contingency(sh, c.cross)
    }
  }

  const identifying = new Set(['rut', 'nombre', 'ap_paterno', 'ap_materno', 'run_rn', 'ap_paterno_rn', 'ap_materno_rn', 'fono', 'n_admision', 'rn_episodio'])
  const keys = report.catalog.filter((c) => !identifying.has(c.key)).map((c) => c.key)
  const ds = wb.addWorksheet('Datos', { views: [{ state: 'frozen', ySplit: 1 }] })
  ds.addRow(['Unidad', ...keys.map((k) => report.catalog.find((c) => c.key === k)?.label ?? k)])
  ds.getRow(1).font = { bold: true }
  for (const row of data) {
    ds.addRow([row.unidad, ...keys.map((k) => (/^[=+\-@]/.test(row[k] ?? '') ? `'${row[k]}` : (row[k] ?? '')))])
  }
  ds.columns.forEach((c) => (c.width = 18))

  return wb.xlsx.writeBuffer()
}
