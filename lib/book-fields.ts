export type BookSection = 'materno' | 'neonatal'
export type BookFieldType = 'text' | 'number' | 'decimal' | 'date' | 'time' | 'select'

export const BOOK_SECTION_LABEL: Record<BookSection, string> = {
  materno: 'Maternidad',
  neonatal: 'Neonatología',
}

export const BOOK_FIELD_TYPES: { value: BookFieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número entero' },
  { value: 'decimal', label: 'Número con decimales' },
  { value: 'date', label: 'Fecha' },
  { value: 'time', label: 'Hora' },
  { value: 'select', label: 'Lista de opciones' },
]

/**
 * Datos que se completan solos desde el episodio de UCI vinculado.
 * `user` rellena con el nombre de quien crea el registro.
 */
export const BOOK_SOURCES: { value: string; label: string }[] = [
  { value: 'user', label: 'Nombre de quien crea el registro' },
  { value: 'identity.admissionNumber', label: 'UCI/Nursery: N° de admisión del recién nacido' },
  { value: 'patient.paterno', label: 'UCI/Nursery: apellido paterno del recién nacido' },
  { value: 'patient.materno', label: 'UCI/Nursery: apellido materno del recién nacido' },
  { value: 'mother.nombre', label: 'UCI/Nursery: nombre de la madre' },
  { value: 'mother.paterno', label: 'UCI/Nursery: apellido paterno de la madre' },
  { value: 'mother.materno', label: 'UCI/Nursery: apellido materno de la madre' },
  { value: 'birth.date', label: 'UCI/Nursery: fecha de nacimiento' },
  { value: 'birth.time', label: 'UCI/Nursery: hora de nacimiento' },
  { value: 'previsionLabel', label: 'UCI/Nursery: previsión' },
  { value: 'medicoLabel', label: 'UCI/Nursery: médico tratante' },
  { value: 'deliveryLabel', label: 'UCI/Nursery: tipo de parto (si es inequívoco)' },
  { value: 'identity.rut', label: 'UCI: RUN del recién nacido' },
  { value: 'identity.motherPhone', label: 'UCI: teléfono de la madre' },
  { value: 'sex', label: 'UCI: sexo' },
  { value: 'gaWeeks', label: 'UCI: edad gestacional (semanas)' },
  { value: 'birthWeightG', label: 'UCI: peso al nacer (g)' },
  { value: 'birthLengthCm', label: 'UCI: talla (cm)' },
  { value: 'birthHeadCm', label: 'UCI: perímetro cefálico (cm)' },
  { value: 'apgar1', label: "UCI: Apgar 1'" },
  { value: 'apgar5', label: "UCI: Apgar 5'" },
  { value: 'feedingDischarge', label: 'UCI: alimentación al alta' },
  { value: 'dischargeWeightG', label: 'UCI: peso al alta (g)' },
  { value: 'dischargeAt', label: 'UCI: fecha de alta' },
  { value: 'hospitalized', label: 'UCI: hospitalizado (SI si hay episodio)' },
  { value: 'screening.VHB', label: 'UCI: vacuna VHB' },
  { value: 'screening.BCG', label: 'UCI: vacuna BCG' },
  { value: 'screening.Nirsevimab', label: 'UCI: nirsevimab' },
  { value: 'screening.METABOLICO', label: 'UCI: screening metabólico (TSH/PKU)' },
  { value: 'screening.PEA', label: 'UCI: screening auditivo (realizado)' },
  { value: 'screening.PEA.result', label: 'UCI: resultado screening auditivo' },
  { value: 'screening.CARDIO', label: 'UCI: screening cardiológico' },
]

export type BookFieldDef = {
  key: string
  label: string
  section: BookSection
  group: string
  type: BookFieldType
  options?: string[]
  source?: string
}

const SN = ['SI', 'NO']
const NEG_POS = ['NEGATIVO', 'POSITIVO']

const M = 'materno' as const
const N = 'neonatal' as const

/** Las 69 columnas del libro (la columna N° se calcula sola). Todas son editables desde Administración. */
export const DEFAULT_BOOK_FIELDS: BookFieldDef[] = [
  // Identificación y admisión
  { key: 'fecha', label: 'Fecha', section: M, group: 'Admisión', type: 'date', source: 'birth.date' },
  { key: 'hora', label: 'Hora', section: M, group: 'Admisión', type: 'time', source: 'birth.time' },
  { key: 'n_admision', label: 'N° admisión', section: M, group: 'Admisión', type: 'text' },
  { key: 'prevision', label: 'Previsión', section: M, group: 'Admisión', type: 'text' },
  { key: 'rut', label: 'RUT', section: M, group: 'Datos de la madre', type: 'text' },
  { key: 'nombre', label: 'Nombre', section: M, group: 'Datos de la madre', type: 'text', source: 'mother.nombre' },
  { key: 'ap_paterno', label: 'Apellido paterno', section: M, group: 'Datos de la madre', type: 'text', source: 'mother.paterno' },
  { key: 'ap_materno', label: 'Apellido materno', section: M, group: 'Datos de la madre', type: 'text', source: 'mother.materno' },
  { key: 'edad', label: 'Edad', section: M, group: 'Datos de la madre', type: 'number' },
  { key: 'imc', label: 'IMC', section: M, group: 'Datos de la madre', type: 'decimal' },
  { key: 'pais_origen', label: 'País de origen', section: M, group: 'Datos de la madre', type: 'text' },
  { key: 'pueblo_originario', label: 'Pueblo originario', section: M, group: 'Datos de la madre', type: 'select', options: SN },
  // Parto o aborto
  {
    key: 'tipo_parto',
    label: 'Tipo de parto',
    section: M,
    group: 'Parto o aborto',
    type: 'select',
    options: ['PARTO VAGINAL', 'CESÁREA ELECTIVA', 'CESÁREA DE URGENCIA', 'PARTO INSTRUMENTAL', 'ABORTO'],
  },
  { key: 'robson', label: 'Clasificación Robson', section: M, group: 'Parto o aborto', type: 'text' },
  { key: 'causa_cesarea', label: 'Causa de cesárea', section: M, group: 'Parto o aborto', type: 'text' },
  { key: 'induccion', label: 'Inducción', section: M, group: 'Parto o aborto', type: 'select', options: SN },
  { key: 'rpm', label: 'RPM', section: M, group: 'Parto o aborto', type: 'select', options: SN },
  { key: 'tiempo_rpm', label: 'Tiempo de RPM', section: M, group: 'Parto o aborto', type: 'text' },
  { key: 'profilaxis_rpm', label: 'Profilaxis RPM', section: M, group: 'Parto o aborto', type: 'select', options: SN },
  // Antecedentes obstétricos
  {
    key: 'paridad',
    label: 'Paridad',
    section: M,
    group: 'Antecedentes obstétricos',
    type: 'select',
    options: ['PRIMIGESTA', 'MULTÍPARA'],
  },
  { key: 'slg', label: 'SLG', section: M, group: 'Antecedentes obstétricos', type: 'select', options: SN },
  { key: 'cca', label: 'CCA', section: M, group: 'Antecedentes obstétricos', type: 'number' },
  { key: 'procedencia', label: 'Procedencia', section: M, group: 'Antecedentes obstétricos', type: 'text' },
  { key: 'control_prenatal', label: 'Control prenatal', section: M, group: 'Antecedentes obstétricos', type: 'select', options: SN },
  // Exámenes
  { key: 'elisa_n', label: 'N° ELISA', section: M, group: 'Exámenes', type: 'number' },
  { key: 'elisa_res', label: 'ELISA: resultado', section: M, group: 'Exámenes', type: 'select', options: NEG_POS },
  { key: 'vdrl_n', label: 'N° VDRL', section: M, group: 'Exámenes', type: 'number' },
  { key: 'vdrl_res', label: 'VDRL: resultado', section: M, group: 'Exámenes', type: 'select', options: ['NO REACTIVO', 'REACTIVO'] },
  { key: 'sgb', label: 'SGB', section: M, group: 'Exámenes', type: 'select', options: SN },
  { key: 'sgb_res', label: 'SGB: resultado', section: M, group: 'Exámenes', type: 'select', options: NEG_POS },
  { key: 'prof_sgb', label: 'Profilaxis SGB', section: M, group: 'Exámenes', type: 'select', options: ['SI', 'NO', 'NO APLICA'] },
  { key: 'hb', label: 'Hepatitis B', section: M, group: 'Exámenes', type: 'select', options: SN },
  { key: 'hb_res', label: 'Hepatitis B: resultado', section: M, group: 'Exámenes', type: 'select', options: NEG_POS },
  { key: 'chagas', label: 'Chagas', section: M, group: 'Exámenes', type: 'select', options: SN },
  { key: 'chagas_res', label: 'Chagas: resultado', section: M, group: 'Exámenes', type: 'select', options: NEG_POS },
  // Placenta y equipo
  { key: 'entrega_placenta', label: 'Entrega de placenta', section: M, group: 'Placenta y equipo', type: 'select', options: SN },
  { key: 'medico', label: 'Médico', section: M, group: 'Placenta y equipo', type: 'text' },
  { key: 'ayudante', label: 'Ayudante', section: M, group: 'Placenta y equipo', type: 'text' },
  { key: 'anestesista', label: 'Anestesista', section: M, group: 'Placenta y equipo', type: 'text' },
  { key: 'neonatologo', label: 'Neonatólogo', section: M, group: 'Placenta y equipo', type: 'text', source: 'medicoLabel' },
  { key: 'matrona_quirurgica', label: 'Matrona equipo quirúrgico', section: M, group: 'Placenta y equipo', type: 'text' },

  // Neonatología
  { key: 'matrona_neo_ati', label: 'Matrona neo ATI', section: N, group: 'Equipo', type: 'text', source: 'user' },
  { key: 'rn_episodio', label: 'RN episodio', section: N, group: 'Recién nacido', type: 'text', source: 'identity.admissionNumber' },
  { key: 'run_rn', label: 'RUN del recién nacido', section: N, group: 'Recién nacido', type: 'text', source: 'identity.rut' },
  { key: 'ap_paterno_rn', label: 'Apellido paterno RN', section: N, group: 'Recién nacido', type: 'text', source: 'patient.paterno' },
  { key: 'ap_materno_rn', label: 'Apellido materno RN', section: N, group: 'Recién nacido', type: 'text', source: 'patient.materno' },
  {
    key: 'sexo_rn',
    label: 'Sexo',
    section: N,
    group: 'Recién nacido',
    type: 'select',
    options: ['FEMENINO', 'MASCULINO', 'INDETERMINADO'],
    source: 'sex',
  },
  { key: 'eg', label: 'Edad gestacional (semanas)', section: N, group: 'Recién nacido', type: 'number', source: 'gaWeeks' },
  { key: 'peso', label: 'Peso (g)', section: N, group: 'Recién nacido', type: 'number', source: 'birthWeightG' },
  { key: 'talla', label: 'Talla (cm)', section: N, group: 'Recién nacido', type: 'decimal', source: 'birthLengthCm' },
  { key: 'cc', label: 'Circunferencia craneana (cm)', section: N, group: 'Recién nacido', type: 'decimal', source: 'birthHeadCm' },
  { key: 'apgar1', label: "Apgar 1'", section: N, group: 'Evaluación al nacer', type: 'number', source: 'apgar1' },
  { key: 'apgar5', label: "Apgar 5'", section: N, group: 'Evaluación al nacer', type: 'number', source: 'apgar5' },
  { key: 'apego', label: 'Apego', section: N, group: 'Evaluación al nacer', type: 'select', options: SN },
  { key: 'lm_1h', label: 'Lactancia en la primera hora', section: N, group: 'Evaluación al nacer', type: 'select', options: SN },
  { key: 'malformacion', label: 'Malformación congénita', section: N, group: 'Evaluación al nacer', type: 'select', options: SN },
  { key: 'prevision_rn', label: 'Previsión RN', section: N, group: 'Alta', type: 'text', source: 'previsionLabel' },
  { key: 'hospitalizado', label: 'Hospitalización', section: N, group: 'Alta', type: 'select', options: SN, source: 'hospitalized' },
  { key: 'fecha_alta_rn', label: 'Fecha de alta RN', section: N, group: 'Alta', type: 'date', source: 'dischargeAt' },
  { key: 'peso_alta', label: 'Peso al alta (g)', section: N, group: 'Alta', type: 'number', source: 'dischargeWeightG' },
  {
    key: 'alimentacion_alta',
    label: 'Alimentación al alta',
    section: N,
    group: 'Alta',
    type: 'select',
    options: ['LACTANCIA EXCLUSIVA', 'LACTANCIA MIXTA', 'FÓRMULA', 'OTRA'],
    source: 'feedingDischarge',
  },
  { key: 'fono', label: 'Teléfono de contacto', section: N, group: 'Alta', type: 'text', source: 'identity.motherPhone' },
  { key: 'vhb', label: 'Vacuna VHB', section: N, group: 'Vacunas y tamizajes', type: 'select', options: SN, source: 'screening.VHB' },
  { key: 'bcg', label: 'Vacuna BCG', section: N, group: 'Vacunas y tamizajes', type: 'select', options: SN, source: 'screening.BCG' },
  { key: 'nirsevimab', label: 'Nirsevimab', section: N, group: 'Vacunas y tamizajes', type: 'select', options: SN, source: 'screening.Nirsevimab' },
  { key: 'tsh_pku', label: 'TSH / PKU', section: N, group: 'Vacunas y tamizajes', type: 'select', options: SN, source: 'screening.METABOLICO' },
  { key: 'peat', label: 'PEAT', section: N, group: 'Vacunas y tamizajes', type: 'select', options: SN, source: 'screening.PEA' },
  {
    key: 'peat_resultado',
    label: 'PEAT: resultado',
    section: N,
    group: 'Vacunas y tamizajes',
    type: 'select',
    options: ['PASA', 'REFIERE'],
    source: 'screening.PEA.result',
  },
  { key: 'ic_cardiologia', label: 'IC cardiología', section: N, group: 'Vacunas y tamizajes', type: 'select', options: SN, source: 'screening.CARDIO' },
]
