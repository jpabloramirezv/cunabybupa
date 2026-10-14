import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForPool = globalThis as unknown as { __cunaPool?: Pool }

export const pool =
  globalForPool.__cunaPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 8 })

if (process.env.NODE_ENV !== 'production') globalForPool.__cunaPool = pool

export const db = drizzle(pool, { schema })
