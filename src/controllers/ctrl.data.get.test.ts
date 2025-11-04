import { getDataController } from "@server/controllers/ctrl.data.get";
import { setupDatabase } from "@server/test-helper/db";
import { describe, expect, test } from "bun:test";

describe("ctrl.data.get", async () => {
  test("should return empty array when user has no datastores", async () => {
    const { database, kysely, userSession } = await setupDatabase();

    const [result, error] = await getDataController({
      db: kysely,
      session: userSession.alice.session,
      user: userSession.alice.user,
    })

    expect(error).toBeNull();
    expect(result).toBeDefined();
    expect(result?.datastores).toBeDefined();
    expect(result?.datastores?.length).toBe(0);
  })

  test("should return datastores when they exist for the user's organization", async () => {
    const { database, kysely, userSession } = await setupDatabase();

    // Insert datastores for Alice's organization
    await kysely.insertInto('datastore').values([
      {
        id: 'datastore_alice_1',
        organization_id: 'org_alice',
        internal_name: 'alice-datastore-1',
        provider: 'sqlite',
        external_id: 'ext_alice_1',
        external_name: 'alice_db_1',
        schema_json: '{}',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'datastore_alice_2',
        organization_id: 'org_alice',
        internal_name: 'alice-datastore-2',
        provider: 'turso',
        external_id: 'ext_alice_2',
        external_name: 'alice_db_2',
        schema_json: '{}',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]).execute();

    const [result, error] = await getDataController({
      db: kysely,
      session: userSession.alice.session,
      user: userSession.alice.user,
    })

    expect(error).toBeNull();
    expect(result).toBeDefined();
    expect(result?.datastores).toBeDefined();
    expect(result?.datastores?.length).toBe(2);

    // Verify the returned datastores belong to Alice's organization
    expect(result?.datastores?.[0]?.id).toBe('datastore_alice_1');
    expect(result?.datastores?.[0]?.internal_name).toBe('alice-datastore-1');
    expect(result?.datastores?.[0]?.provider).toBe('sqlite');
    expect(result?.datastores?.[1]?.id).toBe('datastore_alice_2');
    expect(result?.datastores?.[1]?.internal_name).toBe('alice-datastore-2');
    expect(result?.datastores?.[1]?.provider).toBe('turso');
  })

  test("should not return datastores from other organizations", async () => {
    const { database, kysely, userSession } = await setupDatabase();

    // Insert datastores for both Alice's and Bob's organizations
    await kysely.insertInto('datastore').values([
      {
        id: 'datastore_alice_1',
        organization_id: 'org_alice',
        internal_name: 'alice-datastore-1',
        provider: 'sqlite',
        external_id: 'ext_alice_1',
        external_name: 'alice_db_1',
        schema_json: '{}',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'datastore_bob_1',
        organization_id: 'org_bob',
        internal_name: 'bob-datastore-1',
        provider: 'sqlite',
        external_id: 'ext_bob_1',
        external_name: 'bob_db_1',
        schema_json: '{}',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'datastore_bob_2',
        organization_id: 'org_bob',
        internal_name: 'bob-datastore-2',
        provider: 'turso',
        external_id: 'ext_bob_2',
        external_name: 'bob_db_2',
        schema_json: '{}',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]).execute();

    // Get datastores for Alice
    const [aliceResult, aliceError] = await getDataController({
      db: kysely,
      session: userSession.alice.session,
      user: userSession.alice.user,
    })

    expect(aliceError).toBeNull();
    expect(aliceResult).toBeDefined();
    expect(aliceResult?.datastores).toBeDefined();
    expect(aliceResult?.datastores?.length).toBe(1);
    expect(aliceResult?.datastores?.[0]?.id).toBe('datastore_alice_1');
    expect(aliceResult?.datastores?.[0]?.internal_name).toBe('alice-datastore-1');

    // Get datastores for Bob
    const [bobResult, bobError] = await getDataController({
      db: kysely,
      session: userSession.bob.session,
      user: userSession.bob.user,
    })

    expect(bobError).toBeNull();
    expect(bobResult).toBeDefined();
    expect(bobResult?.datastores).toBeDefined();
    expect(bobResult?.datastores?.length).toBe(2);
    expect(bobResult?.datastores?.[0]?.id).toBe('datastore_bob_1');
    expect(bobResult?.datastores?.[0]?.internal_name).toBe('bob-datastore-1');
    expect(bobResult?.datastores?.[1]?.id).toBe('datastore_bob_2');
    expect(bobResult?.datastores?.[1]?.internal_name).toBe('bob-datastore-2');

    // Verify Alice's results don't contain Bob's datastores
    const aliceDatastoreIds = aliceResult?.datastores?.map(d => d.id) ?? [];
    expect(aliceDatastoreIds).not.toContain('datastore_bob_1');
    expect(aliceDatastoreIds).not.toContain('datastore_bob_2');

    // Verify Bob's results don't contain Alice's datastores
    const bobDatastoreIds = bobResult?.datastores?.map(d => d.id) ?? [];
    expect(bobDatastoreIds).not.toContain('datastore_alice_1');
  })

});