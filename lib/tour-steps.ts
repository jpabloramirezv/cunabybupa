export type TourId = 'neonatal' | 'maternidad'

export type TourStep = {
  id: string
  /** Ruta donde ocurre el paso; la guía navega sola si estás en otra. */
  route: string
  /** Selector CSS del elemento a resaltar. Si no existe en pantalla, el paso se muestra centrado. */
  target?: string
  /** Enmarca el elemento en rojo para llamar la atención sobre un control clave. */
  alert?: boolean
  title: string
  body: string
}

const NAV = 'nav[aria-label="Principal"]'

const LAUNCHER_STEP: TourStep = {
  id: 'launcher',
  route: '',
  target: '[data-tour="launcher"]',
  title: 'Puedes repetir esta guía',
  body: 'Cuando quieras volver a verla, usa el botón Ver guía de la parte superior.',
}

const NEONATAL_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/pizarra',
    title: 'Guía para Neonatología',
    body: 'Tu trabajo tiene dos partes: los Datos Neonatales y el Libro de Partos y Abortos, que reúne los datos neonatales y los maternos de cada nacimiento. Esta guía dura cerca de un minuto.',
  },
  {
    id: 'new-entry',
    route: '/pizarra',
    target: '[data-tour="new-entry"], [data-tour="board-new"]',
    title: '1. Crea el registro neonatal',
    body: 'Con Nuevo registro abres el ingreso de un RN de UPC o Nursery. Puedes guardarlo y seguir completándolo durante toda la estadía.',
  },
  {
    id: 'complete',
    route: '/pizarra',
    title: '2. Complétalo al 100%',
    body: 'Un registro está completo solo cuando todos sus datos están rellenados. Eso ocurre al alta, porque algunos datos se toman en ese momento. Mientras tanto queda en curso y ves cuánto avance lleva.',
  },
  {
    id: 'send',
    route: '/pizarra',
    target: '[title="Enviar este ingreso al Libro de Partos y Abortos"]',
    title: '3. Envíalo al libro',
    body: 'Cuando el registro está al 100%, usa Enviar al libro, en la columna Libro. Elige la fila de Maternidad que corresponde o crea una fila nueva. Después el registro aparece como En el libro.',
  },
  {
    id: 'book',
    route: '/libro',
    target: `${NAV} a[href="/libro"]`,
    title: 'El Libro de Partos y Abortos',
    body: 'Cada fila reúne los Datos Maternos y los Datos Neonatales del mismo nacimiento. Desde aquí puedes seguir trabajando la fila que enviaste.',
  },
  {
    id: 'search',
    route: '/libro',
    target: '#book-search',
    title: 'Busca y abre una fila',
    body: 'Busca por madre, RUT, RN o código, por ejemplo LP-00012. Abre una fila para corregirla o completar lo que falte. El libro no está pensado para gestionarse una vez creado, pero puedes editarlo cuando haga falta.',
  },
  {
    id: 'trace',
    route: '/libro',
    target: '[aria-label="Registros del libro"]',
    title: 'Todas editan, todo queda registrado',
    body: 'El libro se edita como una planilla compartida: cada matrona completa la parte de su unidad. Cada cambio queda con quién lo hizo y cuándo; lo ves al abrir la fila.',
  },
  LAUNCHER_STEP,
]

const MATERNIDAD_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/libro',
    title: 'Guía para Maternidad',
    body: 'Tu trabajo está en el Libro de Partos y Abortos. Ahí completas los Datos Maternos de cada nacimiento, y Neonatología completa los Datos Neonatales de la misma fila. Esta guía dura cerca de un minuto.',
  },
  {
    id: 'new',
    route: '/libro',
    target: '[data-tour="book-new"]',
    title: '1. Crea o continúa una fila',
    body: 'Con Nuevo Registro agregas los Datos Maternos cuando llega la madre. Si Neonatología ya empezó la fila del RN, el libro te lo avisa y puedes continuarla en vez de duplicarla.',
  },
  {
    id: 'sections',
    route: '/libro',
    target: '[aria-label="Vista de columnas"]',
    alert: true,
    title: '2. Elige qué datos ver',
    body: 'Este filtro cambia las columnas del libro: Datos neonatales, Datos maternales o Todo el Libro. Usa Datos maternales para ver y completar tu parte; Neonatología completa la suya en la misma fila. Al abrir una fila, sus pestañas muestran tu avance, por ejemplo 12/20, y un ✓ cuando está completa.',
  },
  {
    id: 'search',
    route: '/libro',
    target: '#book-search',
    title: '3. Busca una fila',
    body: 'Busca por madre, RUT, RN o código, por ejemplo LP-00012. Abre la fila para corregirla o completar lo que falte.',
  },
  {
    id: 'views',
    route: '/libro',
    target: '[aria-label="Forma de ver el libro"]',
    title: '4. Mira el libro como prefieras',
    body: 'Libro muestra todas las columnas como una planilla. Tarjetas muestra cada nacimiento en un resumen más fácil de leer.',
  },
  {
    id: 'trace',
    route: '/libro',
    target: '[aria-label="Registros del libro"]',
    title: 'Todas editan, todo queda registrado',
    body: 'El libro se edita como una planilla compartida: cada matrona completa la parte de su unidad. Cada cambio queda con quién lo hizo y cuándo; lo ves al abrir la fila.',
  },
  LAUNCHER_STEP,
]

export function tourSteps(id: TourId): TourStep[] {
  const steps = id === 'neonatal' ? NEONATAL_STEPS : MATERNIDAD_STEPS
  const home = steps[0].route
  return steps.map((s) => (s.route ? s : { ...s, route: home }))
}
