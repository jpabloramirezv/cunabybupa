import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const ddl = [
  `CREATE TABLE IF NOT EXISTS "user" (
    id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
    "emailVerified" boolean NOT NULL DEFAULT false, image text,
    "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS session (
    id text PRIMARY KEY, "expiresAt" timestamp NOT NULL, token text NOT NULL UNIQUE,
    "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
    "ipAddress" text, "userAgent" text,
    "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS account (
    id text PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL,
    "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "accessToken" text, "refreshToken" text, "idToken" text,
    "accessTokenExpiresAt" timestamp, "refreshTokenExpiresAt" timestamp,
    scope text, password text,
    "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS verification (
    id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL,
    "expiresAt" timestamp NOT NULL,
    "createdAt" timestamp DEFAULT now(), "updatedAt" timestamp DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS staff (
    id serial PRIMARY KEY, name text NOT NULL, role text NOT NULL,
    pin_hash text NOT NULL, pin_length int NOT NULL DEFAULT 4,
    active boolean NOT NULL DEFAULT true, failed_attempts int NOT NULL DEFAULT 0,
    locked_until timestamptz, is_admin boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now())`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS person_session (
    token_hash text PRIMARY KEY, staff_id int NOT NULL, user_id text NOT NULL,
    expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS diagnosis (
    id serial PRIMARY KEY, code text NOT NULL, name text NOT NULL,
    synonyms text[] NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT true)`,
  `CREATE TABLE IF NOT EXISTS catalog_item (
    id serial PRIMARY KEY, kind text NOT NULL, label text NOT NULL,
    active boolean NOT NULL DEFAULT true)`,
  `CREATE TABLE IF NOT EXISTS app_setting (key text PRIMARY KEY, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS episode (
    id text PRIMARY KEY, seq serial NOT NULL, status text NOT NULL DEFAULT 'incompleto',
    ga_weeks int, ga_days int, birth_weight_g int, apgar1 int, apgar5 int,
    sex text, delivery_type text, birth_at timestamptz,
    prevision_id int, procedimiento_id int, dx_ingreso_id int, medico_id int,
    readmission_of text, hyperbili boolean, phototherapy_at timestamptz,
    discharge_at timestamptz, discharge_weight_g int, dx_egreso_id int,
    destino_id int, feeding_discharge text, alta_confirmed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz, created_shift text, completed_shift text, created_by int)`,
  `CREATE TABLE IF NOT EXISTS episode_block (
    episode_id text NOT NULL, block text NOT NULL, staff_id int NOT NULL,
    staff_name text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (episode_id, block))`,
  `CREATE TABLE IF NOT EXISTS screening (
    episode_id text NOT NULL, kind text NOT NULL, status text NOT NULL DEFAULT 'pendiente',
    done_at timestamptz, updated_by int, updated_by_name text,
    updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (episode_id, kind))`,
  `CREATE TABLE IF NOT EXISTS episode_identity (
    episode_id text PRIMARY KEY, patient_name text, rut text, admission_number text,
    mother_name text, mother_phone text, contact_reason text,
    contact_consent boolean NOT NULL DEFAULT false, contact_delete_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(), updated_by int)`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id serial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), staff_id int,
    staff_name text, action text NOT NULL, block text NOT NULL, episode_id text, detail text)`,
  `CREATE TABLE IF NOT EXISTS shift_closure (
    id serial PRIMARY KEY, shift_key text NOT NULL, staff_id int NOT NULL,
    staff_name text NOT NULL, closed_at timestamptz NOT NULL DEFAULT now(),
    episode_count int NOT NULL DEFAULT 0, pending_count int NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS episode_revision (
    id serial PRIMARY KEY, episode_id text NOT NULL, at timestamptz NOT NULL DEFAULT now(),
    staff_id int, staff_name text NOT NULL, role text, block text NOT NULL, field text NOT NULL,
    old_value text, new_value text, sensitive boolean NOT NULL DEFAULT false, reason text)`,
  `CREATE INDEX IF NOT EXISTS episode_revision_ep_idx ON episode_revision (episode_id, at DESC)`,
  `CREATE INDEX IF NOT EXISTS episode_created_idx ON episode (created_at)`,
  `CREATE INDEX IF NOT EXISTS episode_updated_idx ON episode (updated_at)`,
  `CREATE INDEX IF NOT EXISTS audit_at_idx ON audit_log (at DESC)`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'neonatologia'`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS specialty text`,
  `CREATE TABLE IF NOT EXISTS book_field (
    id serial PRIMARY KEY, key text NOT NULL UNIQUE, label text NOT NULL,
    section text NOT NULL, group_name text NOT NULL DEFAULT '', type text NOT NULL DEFAULT 'text',
    options text[] NOT NULL DEFAULT '{}', position int NOT NULL DEFAULT 0,
    required boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true, source text)`,
  `CREATE TABLE IF NOT EXISTS birth_record (
    id text PRIMARY KEY, seq serial NOT NULL, episode_id text,
    data jsonb NOT NULL DEFAULT '{}'::jsonb, created_by int, created_by_name text,
    updated_by_name text, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz)`,
  `CREATE INDEX IF NOT EXISTS birth_record_created_idx ON birth_record (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS birth_record_episode_idx ON birth_record (episode_id)`,
  `CREATE TABLE IF NOT EXISTS shift_note (
    id serial PRIMARY KEY, kind text NOT NULL DEFAULT 'siguiente', body text NOT NULL,
    shift_key text NOT NULL, author_id int, author_name text NOT NULL, author_role text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz, resolved_by_name text, deleted_at timestamptz)`,
  `CREATE INDEX IF NOT EXISTS shift_note_created_idx ON shift_note (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS shift_note_read (
    note_id int NOT NULL, staff_id int NOT NULL, read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (note_id, staff_id))`,
]

const diagnoses = [
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

const catalogItems = {
  prevision: ['Fonasa tramo A', 'Fonasa tramo B', 'Fonasa tramo C', 'Fonasa tramo D', 'Isapre', 'Particular', 'Sin previsión'],
  procedimiento: ['Ventilación mecánica', 'CPAP', 'Cánula nasal de alto flujo', 'Fototerapia', 'Surfactante', 'Catéter umbilical', 'Observación sin procedimiento'],
  destino: ['Domicilio', 'Hospitalización pediátrica', 'Traslado a otro centro', 'Cuidados intermedios neonatales', 'Fallecimiento'],
  profesional: ['Dr. Rodrigo Muñoz', 'Dra. Francisca Lagos', 'Dr. Andrés Salinas', 'Dra. Valentina Cortés'],
}

async function main() {
  for (const stmt of ddl) await pool.query(stmt)

  // Datos del libro en papel: ingreso, nivel de cuidado, procedencia, GES y varios médicos.
  for (const stmt of [
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'uci'`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS admission_at timestamptz`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS care_level text`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS transfer_origin text`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS ges_notified boolean`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS ges_notified_at timestamptz`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS medico_ids integer[] NOT NULL DEFAULT '{}'`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS apgar10 integer`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS birth_length_cm real`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS birth_head_cm real`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS doc_urgency_law boolean`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS doc_consent_admission boolean`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS doc_consent_mila boolean`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS maternal_hiv_result text`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS maternal_hiv_at timestamptz`,
    `ALTER TABLE screening ADD COLUMN IF NOT EXISTS done_at_2 timestamptz`,
    `ALTER TABLE screening ADD COLUMN IF NOT EXISTS cited_at timestamptz`,
    `ALTER TABLE screening ADD COLUMN IF NOT EXISTS lot text`,
    `ALTER TABLE screening ADD COLUMN IF NOT EXISTS result text`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS dx_ingreso_ids integer[] NOT NULL DEFAULT '{}'`,
    `ALTER TABLE episode ADD COLUMN IF NOT EXISTS dx_egreso_ids integer[] NOT NULL DEFAULT '{}'`,
    `UPDATE episode SET dx_ingreso_ids = ARRAY[dx_ingreso_id] WHERE dx_ingreso_id IS NOT NULL AND cardinality(dx_ingreso_ids) = 0`,
    `UPDATE episode SET dx_egreso_ids = ARRAY[dx_egreso_id] WHERE dx_egreso_id IS NOT NULL AND cardinality(dx_egreso_ids) = 0`,
    `UPDATE episode SET admission_at = created_at WHERE admission_at IS NULL`,
    `UPDATE episode SET medico_ids = ARRAY[medico_id] WHERE medico_id IS NOT NULL AND cardinality(medico_ids) = 0`,
  ])
    await pool.query(stmt)

  for (const label of ['Nursery', 'ATI', 'UCI', 'UTI', 'Traslado desde otro centro']) {
    await pool.query(
      `INSERT INTO catalog_item (kind, label)
       SELECT 'procedimiento', $1 WHERE NOT EXISTS
         (SELECT 1 FROM catalog_item WHERE kind = 'procedimiento' AND label = $1)`,
      [label],
    )
  }

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM diagnosis')
  if (rows[0].n === 0) {
    for (const [code, name, synonyms] of diagnoses) {
      await pool.query(
        'INSERT INTO diagnosis (code, name, synonyms) VALUES ($1, $2, $3)',
        [code, name, synonyms],
      )
    }
  }

  const items = await pool.query('SELECT count(*)::int AS n FROM catalog_item')
  if (items.rows[0].n === 0) {
    for (const [kind, labels] of Object.entries(catalogItems)) {
      for (const label of labels) {
        await pool.query('INSERT INTO catalog_item (kind, label) VALUES ($1, $2)', [kind, label])
      }
    }
  }

  await pool.query(
    `INSERT INTO app_setting (key, value) VALUES ('contact_retention_days', '90')
     ON CONFLICT (key) DO NOTHING`,
  )

  const t = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
  )
  console.log(t.rows.map((r) => r.table_name).join(', '))
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
