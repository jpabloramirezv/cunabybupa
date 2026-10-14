export const SEED_DIAGNOSES: [string, string, string[]][] = [
  ['P22.0', 'Síndrome de dificultad respiratoria del recién nacido', ['EMH', 'enfermedad de membrana hialina', 'SDR', 'distrés respiratorio']],
  ['P22.1', 'Taquipnea transitoria del recién nacido', ['TTRN', 'taquipnea transitoria', 'pulmón húmedo']],
  ['P52.9', 'Hemorragia intracraneal no traumática del recién nacido', ['ENH', 'hemorragia intracraneal', 'HIC', 'hemorragia intraventricular', 'HIV']],
  ['P07.2', 'Inmadurez extrema (menos de 28 semanas)', ['prematuro extremo', 'gran prematuro', 'RNPT extremo']],
  ['P07.3', 'Otros recién nacidos pretérmino', ['prematuro', 'prematurez', 'RNPT', 'pretérmino']],
  ['P07.1', 'Otro bajo peso al nacer', ['bajo peso', 'RNBP', 'muy bajo peso', 'RNMBP']],
  ['P59.9', 'Ictericia neonatal', ['hiperbilirrubinemia', 'hiperbili', 'ictericia', 'bili alta']],
  ['P36.9', 'Sepsis bacteriana del recién nacido', ['sepsis', 'sepsis neonatal', 'infección grave']],
  ['P21.9', 'Asfixia del nacimiento', ['asfixia perinatal', 'EHI', 'encefalopatía hipóxico isquémica', 'hipoxia']],
  ['P28.4', 'Otras apneas del recién nacido', ['apnea', 'apnea del prematuro']],
  ['P27.1', 'Displasia broncopulmonar originada en el período perinatal', ['DBP', 'displasia broncopulmonar', 'enfermedad pulmonar crónica']],
  ['P61.2', 'Anemia de la prematuridad', ['anemia del prematuro', 'anemia']],
  ['P70.4', 'Hipoglicemia neonatal', ['hipoglicemia', 'hipoglucemia', 'glicemia baja']],
  ['P05.9', 'Retardo del crecimiento fetal', ['RCIU', 'PEG', 'pequeño para la edad gestacional', 'CIR']],
  ['P24.0', 'Aspiración neonatal de meconio', ['SAM', 'aspiración de meconio', 'síndrome aspirativo']],
  ['P29.3', 'Hipertensión pulmonar persistente del recién nacido', ['HTPP', 'hipertensión pulmonar', 'HPPRN']],
  ['P77', 'Enterocolitis necrotizante', ['ECN', 'NEC', 'enterocolitis']],
  ['P91.0', 'Isquemia cerebral neonatal', ['isquemia cerebral', 'leucomalacia']],
]

export const SEED_CATALOG: Record<string, string[]> = {
  prevision: ['Fonasa tramo A', 'Fonasa tramo B', 'Fonasa tramo C', 'Fonasa tramo D', 'Isapre', 'Particular', 'Sin previsión'],
  procedimiento: ['Ventilación mecánica', 'CPAP', 'Cánula nasal de alto flujo', 'Fototerapia', 'Surfactante', 'Catéter umbilical', 'Observación sin procedimiento'],
  destino: ['Domicilio', 'Hospitalización pediátrica', 'Traslado a otro centro', 'Cuidados intermedios neonatales', 'Fallecimiento'],
  profesional: ['Dr. Rodrigo Muñoz', 'Dra. Francisca Lagos', 'Dr. Andrés Salinas', 'Dra. Valentina Cortés'],
}

export const DEMO_STAFF = [
  { name: 'Camila Rojas', role: 'matrona', pin: '1234' },
  { name: 'Daniela Pérez', role: 'matrona', pin: '2345' },
  { name: 'Dr. Rodrigo Muñoz', role: 'medico', pin: '4321' },
  { name: 'Marcela Soto', role: 'jefatura', pin: '123456' },
  { name: 'Pablo Araya', role: 'analista', pin: '5678' },
] as const

export const DEMO_PASSWORD = 'Cuna-Demo-2025'
