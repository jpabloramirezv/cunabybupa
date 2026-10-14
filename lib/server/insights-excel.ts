import ExcelJS from 'exceljs'
import { fmtYmd } from '@/lib/time'
import { fmtNum, fmtP, type BoxStats, type Summary } from '@/lib/stats'
import type { Bar, Box, ContingencyTable, DataRow, Hist, InsightReport } from '@/lib/insights'

const NAVY = 'FF0F1C55'
const PRIMARY = 'FF1B6ABF'
const SOFT = 'FFE3ECF8'

const safe = (v: unknown) => {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return `'${v}`
  return v as ExcelJS.CellValue
}

class Sheet {
  ws: ExcelJS.Worksheet
  row = 1
  constructor(wb: ExcelJS.Workbook, name: string, widths: number[]) {
    this.ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] })
    widths.forEach((w, i) => (this.ws.getColumn(i + 1).width = w))
  }
  title(text: string) {
    const r = this.ws.getRow(this.row++)
    r.getCell(1).value = text
    r.getCell(1).font = { bold: true, size: 14, color: { argb: NAVY } }
    this.row++
  }
  note(text: string) {
    const r = this.ws.getRow(this.row++)
    r.getCell(1).value = text
    r.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF5B6B85' } }
  }
  heading(text: string) {
    this.row++
    const r = this.ws.getRow(this.row++)
    r.getCell(1).value = text
    r.getCell(1).font = { bold: true, size: 12, color: { argb: PRIMARY } }
  }
  table(head: string[], body: (string | number | null)[][], barCol?: number) {
    const hr = this.ws.getRow(this.row++)
    head.forEach((h, i) => {
      const c = hr.getCell(i + 1)
      c.value = h
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle', wrapText: true }
    })
    const start = this.row
    for (const cells of body) {
      const r = this.ws.getRow(this.row++)
      cells.forEach((v, i) => {
        const c = r.getCell(i + 1)
        c.value = safe(v)
        c.alignment = { horizontal: i === 0 ? 'left' : 'right' }
        c.border = { bottom: { style: 'hair', color: { argb: 'FFB9C7DB' } } }
      })
    }
    if (barCol !== undefined && body.length) {
      const col = String.fromCharCode(65 + barCol)
      this.ws.addConditionalFormatting({
        ref: `${col}${start}:${col}${this.row - 1}`,
        rules: [
          {
            type: 'dataBar',
            priority: 1,
            minLength: 0,
            maxLength: 100,
            gradient: false,
            cfvo: [{ type: 'num', value: 0 }, { type: 'max' }],
            color: { argb: 'FF7FB2E5' },
          } as unknown as ExcelJS.ConditionalFormattingRule,
        ],
      })
    }
  }
}

const sum = (s: Summary | null) =>
  s
    ? [s.n, s.mean, s.sd, s.min, s.q1, s.median, s.q3, s.p90, s.max].map((x) =>
        x === null ? null : Math.round(x * 100) / 100,
      )
    : [0, null, null, null, null, null, null, null, null]
const SUM_HEAD = ['n', 'Media', 'DE', 'Mín', 'Q1', 'Mediana', 'Q3', 'P90', 'Máx']

const bars = (b: Bar[]) => b.map((x) => [x.label, x.n, x.pct === null ? null : Math.round(x.pct * 10) / 10])
const boxRows = (b: Box[]) =>
  b.map((x) => {
    const s: BoxStats | null = x.stats
    return [x.label, s?.n ?? 0, s ? r2(s.q1) : null, s ? r2(s.median) : null, s ? r2(s.q3) : null, s ? r2(s.whiskerLow) : null, s ? r2(s.whiskerHigh) : null, s?.outliers.length ?? 0]
  })
const r2 = (n: number) => Math.round(n * 100) / 100
const histRows = (h: Hist) => h.bins.map((b) => [`${fmtNum(b.from, 1)} a ${fmtNum(b.to, 1)}`, b.n])

function contingency(sh: Sheet, t: ContingencyTable) {
  sh.heading(t.title)
  sh.table([t.rowLabel, ...t.cols, 'Total'], [
    ...t.rows.map((r, i) => [r, ...t.cells[i], t.cells[i].reduce((a, b) => a + b, 0)]),
    ['Total', ...t.cols.map((_, j) => t.cells.reduce((a, r) => a + r[j], 0)), t.n],
  ])
  sh.note(
    t.test
      ? `Chi-cuadrado = ${fmtNum(t.test.chi2, 2)}, gl = ${t.test.df}, ${fmtP(t.test.p)}; V de Cramér = ${fmtNum(t.test.cramersV, 2)}.${t.test.lowExpectedShare > 0.2 ? ' Más del 20 % de las celdas tiene frecuencia esperada menor a 5: interpretar con cautela.' : ''}`
      : 'Datos insuficientes para la prueba de asociación.',
  )
  if (t.excluded) sh.note(`${t.excluded} RN excluidos por falta de dato en alguna de las dos variables.`)
}

export async function buildInsightsWorkbook(report: InsightReport, rows: DataRow[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cuna · Neonatología'
  wb.created = new Date(report.generatedAt)

  // Resumen
  const s0 = new Sheet(wb, 'Resumen', [46, 18, 36])
  s0.title(report.config.title)
  s0.note(report.config.subtitle)
  s0.note(`Período: ${fmtYmd(report.config.from)} a ${fmtYmd(report.config.to)} · Base: ${report.basisLabel}`)
  s0.note(`RN analizados: ${report.cohort.n} (antes de filtros: ${report.cohort.beforeFilters})`)
  s0.note(`Generado por ${report.generatedBy} el ${new Date(report.generatedAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}`)
  if (report.filterNotes.length) s0.note(`Filtros: ${report.filterNotes.join(' · ')}`)
  s0.heading('Indicadores clave')
  s0.table(['Indicador', 'Valor', 'Detalle'], report.kpis.map((k) => [k.label, k.value, k.sub ?? '']))
  s0.heading('Hallazgos automáticos')
  report.headline.forEach((h) => s0.note(`• ${h}`))
  if (report.config.notes) {
    s0.heading('Observaciones del autor')
    s0.note(report.config.notes)
  }

  if (report.flow) {
    const sh = new Sheet(wb, 'Serie temporal', [22, 14, 14, 18])
    sh.title(`Flujo y ocupación (${report.flow.granularity === 'dia' ? 'diario' : report.flow.granularity === 'semana' ? 'semanal' : 'mensual'})`)
    sh.table(['Período', 'Ingresos', 'Egresos', 'Hospitalizados al cierre'], report.flow.points.map((p) => [p.label, p.ingresos, p.egresos, p.abiertos]), 1)
  }

  if (report.los) {
    const sh = new Sheet(wb, 'Estadía', [40, 12, 12, 12, 12, 12, 12, 12, 12])
    sh.title('Estadía (días desde el nacimiento hasta el egreso)')
    sh.note(`${report.los.openCount} RN de la cohorte siguen hospitalizados y no entran en el cálculo.`)
    sh.heading('Resumen por grupo')
    sh.table(['Grupo', ...SUM_HEAD], report.los.groupTable.map((g) => [g.label, ...sum(g.summary)]))
    sh.heading('Boxplot por edad gestacional')
    sh.table(['Grupo', 'n', 'Q1', 'Mediana', 'Q3', 'Bigote inf.', 'Bigote sup.', 'Atípicos'], boxRows(report.los.byGa))
    sh.heading('Boxplot por peso al nacer')
    sh.table(['Grupo', 'n', 'Q1', 'Mediana', 'Q3', 'Bigote inf.', 'Bigote sup.', 'Atípicos'], boxRows(report.los.byWeight))
    sh.heading('Boxplot por tipo de parto')
    sh.table(['Grupo', 'n', 'Q1', 'Mediana', 'Q3', 'Bigote inf.', 'Bigote sup.', 'Atípicos'], boxRows(report.los.byDelivery))
    sh.heading('Histograma de la estadía')
    sh.table(['Rango (días)', 'RN'], histRows(report.los.hist), 1)
    sh.heading('Pruebas estadísticas')
    const tests: [string, string][] = []
    if (report.los.kruskalGa) tests.push(['Kruskal-Wallis por grupo de EG', `H = ${fmtNum(report.los.kruskalGa.h, 2)}, gl = ${report.los.kruskalGa.df}, ${fmtP(report.los.kruskalGa.p)}`])
    if (report.los.kruskalWeight) tests.push(['Kruskal-Wallis por grupo de peso', `H = ${fmtNum(report.los.kruskalWeight.h, 2)}, gl = ${report.los.kruskalWeight.df}, ${fmtP(report.los.kruskalWeight.p)}`])
    if (report.los.spearmanGa) tests.push(['Spearman EG vs estadía', `rho = ${fmtNum(report.los.spearmanGa.rho, 2)}, n = ${report.los.spearmanGa.n}, ${fmtP(report.los.spearmanGa.p)}`])
    if (report.los.spearmanWeight) tests.push(['Spearman peso vs estadía', `rho = ${fmtNum(report.los.spearmanWeight.rho, 2)}, n = ${report.los.spearmanWeight.n}, ${fmtP(report.los.spearmanWeight.p)}`])
    sh.table(['Prueba', 'Resultado'], tests.length ? tests : [['Sin datos suficientes', '']])
  }

  if (report.profile) {
    const p = report.profile
    const sh = new Sheet(wb, 'Perfil neonatal', [46, 14, 14])
    sh.title('Perfil neonatal')
    sh.heading('Edad gestacional (semanas)')
    sh.table(['Semanas', 'RN'], histRows(p.gaHist), 1)
    sh.heading('Peso al nacer (g)')
    sh.table(['Rango', 'RN'], histRows(p.weightHist), 1)
    for (const [t, b] of [
      ['Grupo de edad gestacional', p.gaGroups], ['Grupo de peso', p.weightGroups], ['APGAR a 5 minutos', p.apgar5],
      ['Sexo', p.sex], ['Tipo de parto', p.delivery], ['Previsión', p.prevision], ['Procedimiento', p.procedimiento],
      ['Diagnósticos de ingreso más frecuentes', p.dxIngreso],
    ] as [string, Bar[]][]) {
      sh.heading(t)
      sh.table(['Categoría', 'RN', '%'], bars(b), 1)
    }
  }

  if (report.contingency) {
    const sh = new Sheet(wb, 'Contingencia', [34, 16, 16, 16, 16, 16, 16, 16, 16, 16])
    sh.title('Tablas de contingencia')
    report.contingency.forEach((t) => contingency(sh, t))
  }

  if (report.screening) {
    const sh = new Sheet(wb, 'Tamizajes', [34, 14, 14, 14, 14, 14])
    sh.title('Tamizajes y vacunas')
    sh.table(['Tamizaje', 'Realizado', 'Rechazado', 'Pendiente', 'No aplica', 'Total'],
      report.screening.byKind.map((k) => [k.label, ...k.parts.map((p) => p.n), k.total]), 1)
  }

  if (report.bili) {
    const b = report.bili
    const sh = new Sheet(wb, 'Bilirrubina', [46, 14, 14])
    sh.title('Hiperbilirrubinemia')
    sh.table(['Indicador', 'Valor'], [
      ['RN con dato', b.known], ['Con hiperbilirrubinemia', b.withBili], ['Porcentaje', b.pct === null ? null : r2(b.pct)],
      ['IC 95 % inferior', b.ci ? r2(b.ci[0]) : null], ['IC 95 % superior', b.ci ? r2(b.ci[1]) : null], ['Con fototerapia', b.phototherapyN],
    ])
    sh.heading('Hiperbilirrubinemia por grupo de edad gestacional')
    sh.table(['Grupo', 'Casos', '%'], bars(b.byGa), 1)
    sh.heading('Horas hasta la fototerapia')
    sh.table(['Rango (horas)', 'RN'], histRows(b.hist), 1)
  }

  if (report.discharge) {
    const d = report.discharge
    const sh = new Sheet(wb, 'Alta y destino', [46, 14, 14])
    sh.title(`Alta y destino (${d.n} egresos)`)
    for (const [t, b] of [['Destino', d.destino], ['Alimentación al alta', d.feeding], ['Diagnósticos de egreso más frecuentes', d.dxEgreso]] as [string, Bar[]][]) {
      sh.heading(t)
      sh.table(['Categoría', 'RN', '%'], bars(b), 1)
    }
    sh.heading('Variación de peso (%)')
    sh.table(['Rango', 'RN'], histRows(d.weightChange), 1)
  }

  if (report.shifts) {
    const t = report.shifts
    const sh = new Sheet(wb, 'Turnos', [30, 12, 12, 12, 12, 12, 12, 12, 12])
    sh.title('Turnos y horarios')
    sh.heading('Ingresos por turno')
    sh.table(['Turno', 'RN', '%'], bars(t.ingresosByShift), 1)
    sh.heading('Egresos por turno')
    sh.table(['Turno', 'RN', '%'], bars(t.egresosByShift), 1)
    for (const h of [t.heatIngresos, t.heatEgresos]) {
      sh.heading(h.title)
      sh.table(['Día', ...h.cols], h.rows.map((r, i) => [r, ...h.cells[i]]))
    }
  }

  if (report.attention) {
    const a = report.attention
    const sh = new Sheet(wb, 'Casos abiertos', [34, 14, 14, 14, 60])
    sh.title(`Casos abiertos (${a.open} hospitalizados)`)
    sh.heading('Motivos')
    sh.table(['Motivo', 'RN', '%'], bars(a.reasons), 1)
    sh.heading('Tiempo de hospitalización de los RN aún abiertos')
    sh.table(['Tramo', 'RN', '%'], bars(a.stayBands), 1)
    sh.heading('Hospitalizaciones más largas')
    sh.table(['Código', 'Días', 'EG (sem)', 'Peso (g)', 'Motivos'], a.longest.map((c) => [c.code, c.days, c.gaWeeks, c.weightG, c.reasons.join('; ')]))
  }

  if (report.quality) {
    const q = report.quality
    const sh = new Sheet(wb, 'Calidad del registro', [46, 14, 14, 12, 12, 12, 12, 12])
    sh.title('Calidad del registro')
    sh.heading('Completitud por campo')
    sh.table(['Campo', 'Completos', '%'], bars(q.completeness), 1)
    sh.heading('Horas hasta completar la ficha, según turno de ingreso')
    sh.table(['Grupo', 'n', 'Q1', 'Mediana', 'Q3', 'Bigote inf.', 'Bigote sup.', 'Atípicos'], boxRows(q.lagByShift))
    sh.heading('Histograma de horas hasta completar')
    sh.table(['Rango (horas)', 'RN'], histRows(q.lagHist), 1)
  }

  // Datos anonimizados
  const data = wb.addWorksheet('Datos')
  if (rows.length) {
    const keys = Object.keys(rows[0])
    data.columns = keys.map((k) => ({ header: k, key: k, width: Math.max(14, Math.min(34, k.length + 4)) }))
    rows.forEach((r) => data.addRow(Object.fromEntries(keys.map((k) => [k, safe(r[k])]))))
    const head = data.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    data.views = [{ state: 'frozen', ySplit: 1 }]
    data.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } }
  } else {
    data.getCell(1, 1).value = 'Sin registros con estas condiciones.'
  }
  void SOFT

  return wb.xlsx.writeBuffer()
}
