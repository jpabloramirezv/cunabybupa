import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// --- Better Auth (cuenta institucional de la unidad) ------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- Personal de la unidad (PIN personal) -----------------------------------

const tz = { withTimezone: true } as const

export const staff = pgTable('staff', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(), // matrona | medico | medico_jefe | jefatura | analista
  pinHash: text('pin_hash').notNull(),
  pinLength: integer('pin_length').notNull().default(4),
  active: boolean('active').notNull().default(true),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', tz),
  // Matrona Administradora: conserva rol y nombre de matrona, con los permisos de Jefatura.
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

export const personSession = pgTable('person_session', {
  tokenHash: text('token_hash').primaryKey(),
  staffId: integer('staff_id').notNull(),
  userId: text('user_id').notNull(),
  expiresAt: timestamp('expires_at', tz).notNull(),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
})

// --- Catálogos ---------------------------------------------------------------

export const diagnosis = pgTable('diagnosis', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  synonyms: text('synonyms').array().notNull().default([]),
  active: boolean('active').notNull().default(true),
})

export const catalogItem = pgTable('catalog_item', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(), // prevision | procedimiento | destino | profesional
  label: text('label').notNull(),
  active: boolean('active').notNull().default(true),
  /** Solo en 'profesional': usuario de la app (médico o médico jefe) al que corresponde. */
  staffId: integer('staff_id'),
})

export const appSetting = pgTable('app_setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

// --- Bloque clínico (sin identificadores) -----------------------------------

export const episode = pgTable('episode', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  status: text('status').notNull().default('incompleto'),
  gaWeeks: integer('ga_weeks'),
  gaDays: integer('ga_days'),
  birthWeightG: integer('birth_weight_g'),
  apgar1: integer('apgar1'),
  apgar5: integer('apgar5'),
  apgar10: integer('apgar10'),
  birthLengthCm: real('birth_length_cm'),
  birthHeadCm: real('birth_head_cm'),
  docUrgencyLaw: boolean('doc_urgency_law'),
  docConsentAdmission: boolean('doc_consent_admission'),
  docConsentMila: boolean('doc_consent_mila'),
  maternalHivResult: text('maternal_hiv_result'),
  maternalHivAt: timestamp('maternal_hiv_at', tz),
  sex: text('sex'),
  deliveryType: text('delivery_type'),
  birthAt: timestamp('birth_at', tz),
  previsionId: integer('prevision_id'),
  procedimientoId: integer('procedimiento_id'),
  dxIngresoId: integer('dx_ingreso_id'),
  dxIngresoIds: integer('dx_ingreso_ids').array().notNull().default([]),
  medicoId: integer('medico_id'),
  medicoIds: integer('medico_ids').array().notNull().default([]),
  admissionAt: timestamp('admission_at', tz),
  careLevel: text('care_level'),
  transferOrigin: text('transfer_origin'),
  gesNotified: boolean('ges_notified'),
  gesNotifiedAt: timestamp('ges_notified_at', tz),
  readmissionOf: text('readmission_of'),
  hyperbili: boolean('hyperbili'),
  phototherapyAt: timestamp('phototherapy_at', tz),
  dischargeAt: timestamp('discharge_at', tz),
  dischargeWeightG: integer('discharge_weight_g'),
  dxEgresoId: integer('dx_egreso_id'),
  dxEgresoIds: integer('dx_egreso_ids').array().notNull().default([]),
  destinoId: integer('destino_id'),
  feedingDischarge: text('feeding_discharge'),
  altaConfirmedAt: timestamp('alta_confirmed_at', tz),
  createdAt: timestamp('created_at', tz).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  completedAt: timestamp('completed_at', tz),
  createdShift: text('created_shift'),
  completedShift: text('completed_shift'),
  createdBy: integer('created_by'),
})

export const episodeBlock = pgTable(
  'episode_block',
  {
    episodeId: text('episode_id').notNull(),
    block: text('block').notNull(), // ingreso | seguimiento | alta | identidad
    staffId: integer('staff_id').notNull(),
    staffName: text('staff_name').notNull(),
    updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.block] })],
)

export const screening = pgTable(
  'screening',
  {
    episodeId: text('episode_id').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('pendiente'),
    doneAt: timestamp('done_at', tz),
    doneAt2: timestamp('done_at_2', tz),
    citedAt: timestamp('cited_at', tz),
    lot: text('lot'),
  result: text('result'),
  /** Screening cardiológico: saturación pre y post ductal (%). */
  preDuctal: integer('pre_ductal'),
  postDuctal: integer('post_ductal'),
  updatedBy: integer('updated_by'),
    updatedByName: text('updated_by_name'),
    updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.kind] })],
)

// --- Bloque identificatorio (separado) --------------------------------------

export const episodeIdentity = pgTable('episode_identity', {
  episodeId: text('episode_id').primaryKey(),
  patientName: text('patient_name'),
  rut: text('rut'),
  admissionNumber: text('admission_number'),
  motherName: text('mother_name'),
  motherPhone: text('mother_phone'),
  contactReason: text('contact_reason'),
  contactConsent: boolean('contact_consent').notNull().default(false),
  contactDeleteAt: timestamp('contact_delete_at', tz),
  updatedAt: timestamp('updated_at', tz).notNull().defaultNow(),
  updatedBy: integer('updated_by'),
})

// --- Auditoría y turnos ------------------------------------------------------

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  at: timestamp('at', tz).notNull().defaultNow(),
  staffId: integer('staff_id'),
  staffName: text('staff_name'),
  action: text('action').notNull(), // crear | modificar | leer | eliminar
  block: text('block').notNull(),
  episodeId: text('episode_id'),
  detail: text('detail'),
})

/** Historial de ediciones: qué campo cambió, de qué valor a cuál, quién, cuándo y por qué. */
export const episodeRevision = pgTable('episode_revision', {
  id: serial('id').primaryKey(),
  episodeId: text('episode_id').notNull(),
  at: timestamp('at', tz).notNull().defaultNow(),
  staffId: integer('staff_id'),
  staffName: text('staff_name').notNull(),
  role: text('role'),
  block: text('block').notNull(),
  field: text('field').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  sensitive: boolean('sensitive').notNull().default(false),
  reason: text('reason'),
})

export const shiftClosure = pgTable('shift_closure', {
  id: serial('id').primaryKey(),
  shiftKey: text('shift_key').notNull(),
  staffId: integer('staff_id').notNull(),
  staffName: text('staff_name').notNull(),
  closedAt: timestamp('closed_at', tz).notNull().defaultNow(),
  episodeCount: integer('episode_count').notNull().default(0),
  pendingCount: integer('pending_count').notNull().default(0),
})
