import { CompiledQuery, Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { type DB } from "@server/db.d";
import { runmigration } from "../../scripts/run-migrations";
import { Database } from "bun:sqlite";
import type { TSession } from "@server/dto/TSession";
import type { TUser } from "@server/dto/TUser";

/**
 * Setup database with 2 users and organization (alice & bob)
 * Returns a record of userSession and db connection
 */
export async function setupDatabase() {
  const database = new Database(':memory:');
  await runmigration(database);
  const dialect = new BunSqliteDialect({
    database: database,
    onCreateConnection: async connnection => {
      await connnection.executeQuery(CompiledQuery.raw(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = 10000;
        PRAGMA temp_store = MEMORY;
        PRAGMA foreign_keys = ON;
        PRAGMA mmap_size = 268435456; --256MB;
        `));
    },
  })
  
  const kysely = new Kysely<DB>({
    dialect
  });

  await kysely.insertInto('user').values([
    {id: 'alice', name: 'Alice', role: 'user',  email: 'alice@example.com', emailVerified: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
    {id: 'bob', name: 'Bob', role: 'user', email: 'bob@example.com', emailVerified: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
  ]).execute()

  await kysely.insertInto('organization').values([
    {id: 'org_alice', name: 'Alice\'s Organization', slug: 'alice-org', createdAt: new Date().toISOString()},
    {id: 'org_bob', name: 'Bob\'s Organization', slug: 'bob-org', createdAt: new Date().toISOString()},
  ]).execute()

  await kysely.insertInto('member').values([
    {id: 'member_alice', userId: 'alice', organizationId: 'org_alice', role: 'owner', createdAt: new Date().toISOString()},
    {id: 'member_bob', userId: 'bob', organizationId: 'org_bob', role: 'owner', createdAt: new Date().toISOString()},
  ]).execute()

  const alice = await kysely.selectFrom('user').where('id', '=', 'alice').selectAll().executeTakeFirstOrThrow()
  const bob = await kysely.selectFrom('user').where('id', '=', 'bob').selectAll().executeTakeFirstOrThrow()

  const userSession: Record<'alice' | 'bob', { user: TUser; session: TSession }> = {
    alice: {
      user: {
        id: alice.id,
        createdAt: new Date(alice.createdAt),
        updatedAt: new Date(alice.updatedAt),
        email: alice.email,
        emailVerified: alice.emailVerified === 1,
        name: alice.name,
        image: alice.image,
        banned: alice.banned === 1,
        role: alice.role,
      },
      session: {
        id: 'session_alice',
        createdAt: new Date(alice.createdAt),
        updatedAt: new Date(alice.updatedAt),
        userId: alice.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        token: 'token_alice',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        impersonatedBy: null,
        activeOrganizationId: 'org_alice',
      }
    },
    bob: {
      user: {
        id: bob.id,
        createdAt: new Date(bob.createdAt),
        updatedAt: new Date(bob.updatedAt),
        email: bob.email,
        emailVerified: bob.emailVerified === 1,
        name: bob.name,
        image: bob.image,
        banned: bob.banned === 1,
        role: bob.role,
      },
      session: {
        id: 'session_bob',
        createdAt: new Date(bob.createdAt),
        updatedAt: new Date(bob.updatedAt),
        userId: bob.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        token: 'token_bob',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        impersonatedBy: null,
        activeOrganizationId: 'org_bob',
      }
    }
  }
  
  return { database, kysely, userSession };

}

export type TKysely = Kysely<DB>;