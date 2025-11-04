import { CompiledQuery, Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { type DB } from "./db.d";
import { Database } from "bun:sqlite";
export const database = new Database('ecliptic.db');

const dialect = new BunSqliteDialect({
  database: database,
  onCreateConnection: async connnection => {
    await connnection.executeQuery(CompiledQuery.raw(`PRAGMA foreign_keys = ON`))
    await connnection.executeQuery(CompiledQuery.raw(`PRAGMA journal_mode = WAL`))
    await connnection.executeQuery(CompiledQuery.raw(`PRAGMA busy_timeout = 5000`))
    await connnection.executeQuery(CompiledQuery.raw(`PRAGMA synchronous = NORMAL`))
    await connnection.executeQuery(CompiledQuery.raw(`PRAGMA cache_size = 10000`))
    await connnection.executeQuery(CompiledQuery.raw(`PRAGMA temp_store = MEMORY`))
    // 256MB
    await connnection.executeQuery(CompiledQuery.raw(`PRAGMA mmap_size = 268435456`))
  },
})

export const kysely = new Kysely<DB>({
  dialect
});

export type TKysely = Kysely<DB>;