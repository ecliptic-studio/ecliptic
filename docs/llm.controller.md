## Controllers

Controllers are the orchestration layer between the API routes and business logic (subroutines). They handle request validation, authorization, and coordinate calls to subroutines. Controllers are **framework-agnostic** and must never contain framework-specific types (like ElysiaJS).
All controllers have a ctrl.<module>.<action> prefix filename

### Controller Function Signature

```typescript
export async function controllerName(
  ctx: ControllerContext,
  args: ArgsType
): Promise<TErrTuple<ReturnType>> {
  // Implementation

  return [result, null]; // success
  // OR
  return [null, errorStruct]; // failure
}
```

### The Context Pattern

The **context** is the first argument and provides request-scoped dependencies:

```typescript
export type DatastoreControllerContext = {
  user: TUser;        // Authenticated user (DTO)
  session: TSession;  // User session (DTO)
  db: TKysely;        // Database connection
  // Add other request-scoped dependencies as needed
};
```

**Key Principles:**
- **All user/session types must be DTOs** from `@src/dto/` (never framework types)
- Context provides authenticated user, session, and database access
- Keeps controllers testable by injecting dependencies
- Context should not include framework-specific objects (e.g., no `Context` from ElysiaJS)

### The Args Pattern

All input parameters go in a single **args** object:

```typescript
export type CreateDatastoreArgs = {
  internalName: string;
  provider: 'sqlite' | 'turso';
  region?: string;
  // ... other parameters
};
```

**Why Args?**
- Clear separation of auth context vs input data
- Easy to extend without breaking function signature
- Simple to validate and type-check

### The TErrTuple Return Pattern

Controllers always return `TErrTuple<T>` (2-tuple):

```typescript
// Success case
return [data, null];

// Error case
return [
  null,
  createError(ErrorCode.CONTROLLER_DATASTORE_CREATE_FAILED)
    .statusCode(400)
    .internal('Internal debug message')
    .external({ en: 'User-facing message', de: 'German message' })
    .shouldLog(true)
    .buildStructWithStatusCode()
];
```

**Components:**
1. **Result** (`T | null`): The success data (a DTO) or null on error
2. **Error** (`TErrorStruct | null`): Error information or null on success

**Note:** Controllers return `TErrTuple` (2-tuple), not `TErrTriple` (3-tuple). Rollbacks are handled internally within the controller.

### DTO Pattern (Data Transfer Objects)

**All inputs and outputs must use DTOs from `@src/dto/`:**

```typescript
import { toTDatastore, type TDatastore } from "@dto/TDatastore";
import type { TSession } from "@dto/TSession";
import type { TUser } from "@dto/TUser";

export async function createDatastoreController(
  ctx: DatastoreControllerContext,
  args: CreateDatastoreArgs
): Promise<TErrTuple<TDatastore>> {
  // ... business logic

  // Convert database entity to DTO before returning
  const datastore = await ctx.db.insertInto('datastore')
    .values({ ... })
    .returningAll()
    .executeTakeFirstOrThrow();

  const data = toTDatastore(datastore); // Convert to DTO
  return [data, null];
}
```

**DTO Rules:**
- **Never return raw database entities** - always convert to DTOs using mapper functions
- DTOs are defined in `@src/dto/` directory
- Each DTO file exports the type and a `toT*` mapper function (e.g., `toTDatastore`)
- DTOs hide internal fields (e.g., `encrypted_json`, `external_id`) from clients
- DTOs are framework-agnostic and can be used anywhere

**Example DTO:**
```typescript
// src/dto/TDatastore.ts
import type { Datastore } from "@server/db.d";
import type { Selectable } from "kysely";

export type TDatastore = Omit<Selectable<Datastore>, 'encrypted_json' | 'external_id'> & {
  schema_json: { /* typed structure */ }
}

export function toTDatastore(datastore: Selectable<Datastore>): TDatastore {
  const { encrypted_json, external_id, schema_json, ...rest } = datastore;
  return {
    ...rest,
    schema_json: JSON.parse(schema_json) as TDatastore['schema_json'],
  };
}
```

### No Framework Leakage

**Controllers must be framework-agnostic:**

```typescript
// ✅ Correct - Framework-agnostic controller
export async function createDatastoreController(
  ctx: DatastoreControllerContext,  // Custom context with DTOs
  args: CreateDatastoreArgs          // Plain object
): Promise<TErrTuple<TDatastore>> {  // DTO return type
  // Business logic
}

// ❌ Wrong - ElysiaJS leaking into controller
export async function createDatastoreController(
  ctx: Context  // ElysiaJS Context type
): Promise<TErrTuple<TDatastore>> {
  const args = ctx.body;  // Framework-specific access
}
```

**Why?**
- Controllers can be reused across different frameworks (ElysiaJS, Express, Fastify, etc.)
- Easier to test without framework mocking
- Clear separation of concerns: API layer handles framework, controllers handle logic

### Rollback Handling

Controllers are responsible for executing rollbacks from subroutines:

```typescript
import { executeRollbacks } from "@error/rollback";

export async function createDatastoreController(
  ctx: DatastoreControllerContext,
  args: CreateDatastoreArgs
): Promise<TErrTuple<TDatastore>> {
  // Call subroutine (returns TErrTriple with rollbacks)
  const [result, error, rollbacks] = await createDatastoreTx(portal, subroutineArgs);

  if (error) {
    // Execute rollbacks on error
    await executeRollbacks(rollbacks);
    return [null, error];
  }

  // Clean up resources if needed
  result.close();

  try {
    // Persist to database
    const datastore = await ctx.db.insertInto('datastore')
      .values({ ... })
      .returningAll()
      .executeTakeFirstOrThrow();

    return [toTDatastore(datastore), null];
  } catch (error) {
    // Execute rollbacks on failure
    await executeRollbacks(rollbacks);

    const err = createError(ErrorCode.CONTROLLER_DATASTORE_CREATE_FAILED)
      .internal(error instanceof Error ? error.message : 'Unknown error')
      .external({ en: 'Failed to create datastore' })
      .shouldLog(true)
      .buildStructWithStatusCode();

    return [null, err];
  }
}
```

**Rollback Best Practices:**
- Always execute rollbacks when a subroutine succeeds but subsequent operations fail
- Use `executeRollbacks(rollbacks)` helper to run them in reverse order
- Rollbacks handle external resources (files, API calls) - database uses transactions

### Validation and Business Rules

Controllers handle validation and business rules:

```typescript
export async function createDatastoreController(
  ctx: DatastoreControllerContext,
  args: CreateDatastoreArgs
): Promise<TErrTuple<TDatastore>> {
  // Validate uniqueness
  const existingDatastore = await ctx.db
    .selectFrom('datastore')
    .where('organization_id', '=', ctx.session.activeOrganizationId)
    .where('internal_name', '=', args.internalName)
    .selectAll()
    .executeTakeFirst();

  if (existingDatastore) {
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_CREATE_UNIQUE_NAME)
      .internal(`Datastore ${args.internalName} exists`)
      .external({ en: `Datastore ${args.internalName} already exists` })
      .buildStructWithStatusCode();
    return [null, err];
  }

  // Continue with creation...
}
```

### Error Codes for Controllers

Use the `ErrorCode` enum with `CONTROLLER_` prefix:

```typescript
import { ErrorCode } from "@server/error/error-code.enum";

export enum ErrorCode {
  // CONTROLLER - errors from controller layer
  CONTROLLER_DATASTORE_CREATE_FAILED = 'CONTROLLER.DATASTORE.CREATE.FAILED',
  CONTROLLER_DATASTORE_CREATE_UNIQUE_NAME = 'CONTROLLER.DATASTORE.CREATE.UNIQUE_NAME',
  CONTROLLER_DATASTORE_NOT_FOUND = 'CONTROLLER.DATASTORE.NOT_FOUND',
  CONTROLLER_DATASTORE_DELETE_FAILED = 'CONTROLLER.DATASTORE.DELETE.FAILED',
}
```

**Naming Convention:**
- `CONTROLLER` = Layer prefix
- `DATASTORE` = Module/feature name
- `CREATE` = Function name (optional)
- `FAILED` / `NOT_FOUND` / `UNIQUE_NAME` = Error type

### Complete Example

See `@src/controllers/datastore.controller.ts` for a reference implementation:

```typescript
import { toTDatastore, type TDatastore } from "@dto/TDatastore";
import type { TSession } from "@dto/TSession";
import type { TUser } from "@dto/TUser";
import { executeRollbacks } from "@error/rollback";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { createDatastoreTx } from "@server/subroutines/datastore/create-datastore.fx";
import { nanoid } from "nanoid";
import slug from "slug";

export type CreateDatastoreArgs = {
  internalName: string;
  provider: 'sqlite' | 'turso';
};

export type DatastoreControllerContext = {
  user: TUser;
  session: TSession;
  db: TKysely;
};

export async function createDatastoreController(
  ctx: DatastoreControllerContext,
  args: CreateDatastoreArgs
): Promise<TErrTuple<TDatastore>> {
  // 1. Validate uniqueness
  const existingDatastore = await ctx.db
    .selectFrom('datastore')
    .where('organization_id', '=', ctx.session.activeOrganizationId)
    .where('internal_name', '=', args.internalName)
    .selectAll()
    .executeTakeFirst();

  if (existingDatastore) {
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_CREATE_UNIQUE_NAME)
      .internal(`Datastore ${args.internalName} exists`)
      .external({ en: `Datastore ${args.internalName} already exists` })
      .buildStructWithStatusCode();
    return [null, err];
  }

  // 2. Generate IDs and names
  const dbId = nanoid();
  const externalName = slug(args.internalName);
  const fileName = externalName + '-' + dbId;

  // 3. Call subroutine to create external resource
  const [database, error, rollbacks] = await createDatastoreTx({}, { fileName });

  if (error) {
    await executeRollbacks(rollbacks);
    return [null, error];
  }

  database.close();

  // 4. Persist to database
  try {
    const datastore = await ctx.db
      .insertInto('datastore')
      .values({
        id: dbId,
        external_id: dbId,
        external_name: externalName,
        internal_name: args.internalName,
        organization_id: ctx.session.activeOrganizationId,
        provider: args.provider,
        schema_json: JSON.stringify({ tables: {} }),
        status: 'active',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // 5. Convert to DTO and return
    const data = toTDatastore(datastore);
    return [data, null];
  } catch (error) {
    await executeRollbacks(rollbacks);

    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_CREATE_FAILED)
      .internal(msg)
      .external({ en: 'Failed to create datastore' })
      .shouldLog(true)
      .buildStructWithStatusCode();
    return [null, err];
  }
}
```

### Testing Controllers

Controllers are designed to be easily testable by injecting all dependencies through the context. All side effects (database, external APIs, etc.) are passed via `ctx`, making it simple to use real or mock implementations.

#### Test Setup Helper

Use the `setupDatabase()` helper from `@server/test-helper/db` to create an in-memory database with pre-configured test users:

```typescript
import { describe, test, expect } from "bun:test";
import { setupDatabase } from "@server/test-helper/db";
import { getDataController } from "@server/controllers/ctrl.data.get";

describe("ctrl.data.get", async () => {
  test("should return datastores for user's organization", async () => {
    // Setup creates in-memory DB with Alice & Bob users/sessions
    const { database, kysely, userSession } = await setupDatabase();

    // Test data setup
    await kysely.insertInto('datastore').values({
      id: 'datastore_1',
      organization_id: 'org_alice',
      internal_name: 'my-datastore',
      provider: 'sqlite',
      external_id: 'ext_1',
      external_name: 'my_db',
      schema_json: '{}',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).execute();

    // Call controller with injected dependencies
    const [result, error] = await getDataController({
      db: kysely,
      session: userSession.alice.session,
      user: userSession.alice.user,
    });

    expect(error).toBeNull();
    expect(result?.datastores).toBeDefined();
    expect(result?.datastores?.length).toBe(1);
    expect(result?.datastores?.[0]?.id).toBe('datastore_1');
  });
});
```

#### What setupDatabase() Provides

The `setupDatabase()` helper creates:

1. **In-memory SQLite database** with all migrations applied
2. **Two test users** (Alice and Bob):
   - User IDs: `'alice'`, `'bob'`
   - Emails: `'alice@example.com'`, `'bob@example.com'`
3. **Two organizations**:
   - `'org_alice'` (Alice's Organization)
   - `'org_bob'` (Bob's Organization)
4. **Pre-configured sessions** with `activeOrganizationId` set
5. **Kysely instance** connected to the test database

**Available objects:**
```typescript
const { database, kysely, userSession } = await setupDatabase();

// Access Alice's context
userSession.alice.user      // TUser DTO
userSession.alice.session   // TSession DTO with activeOrganizationId: 'org_alice'

// Access Bob's context
userSession.bob.user        // TUser DTO
userSession.bob.session     // TSession DTO with activeOrganizationId: 'org_bob'
```

#### Key Testing Principles

**1. All Side Effects in Context**

Controllers receive all dependencies through `ctx`, making them easy to test:

```typescript
// ✅ Good - All dependencies injected via context
const [result, error] = await createDatastoreController(
  {
    db: kysely,              // Injected database
    session: userSession.alice.session,  // Injected session
    user: userSession.alice.user,        // Injected user
  },
  {
    internalName: 'test-datastore',
    provider: 'sqlite',
  }
);
```

**2. No Framework Mocking Required**

Because controllers are framework-agnostic, you don't need to mock ElysiaJS or other framework types:

```typescript
// ❌ Not needed - No framework mocking required
// jest.mock('elysia');

// ✅ Just call the controller function directly
const [result, error] = await getDataController(ctx, args);
```

**3. Test Organization Isolation**

Always test that users can only access their own organization's data:

```typescript
test("should not return datastores from other organizations", async () => {
  const { kysely, userSession } = await setupDatabase();

  // Insert data for both Alice and Bob
  await kysely.insertInto('datastore').values([
    {
      id: 'datastore_alice',
      organization_id: 'org_alice',
      internal_name: 'alice-data',
      // ... other fields
    },
    {
      id: 'datastore_bob',
      organization_id: 'org_bob',
      internal_name: 'bob-data',
      // ... other fields
    },
  ]).execute();

  // Test Alice's access
  const [aliceResult, aliceError] = await getDataController({
    db: kysely,
    session: userSession.alice.session,
    user: userSession.alice.user,
  });

  expect(aliceResult?.datastores?.length).toBe(1);
  expect(aliceResult?.datastores?.[0]?.id).toBe('datastore_alice');

  // Test Bob's access
  const [bobResult, bobError] = await getDataController({
    db: kysely,
    session: userSession.bob.session,
    user: userSession.bob.user,
  });

  expect(bobResult?.datastores?.length).toBe(1);
  expect(bobResult?.datastores?.[0]?.id).toBe('datastore_bob');

  // Verify isolation
  const aliceIds = aliceResult?.datastores?.map(d => d.id) ?? [];
  expect(aliceIds).not.toContain('datastore_bob');
});
```

#### Test Scenarios to Cover

1. **Empty State** - No data exists for user:
```typescript
test("should return empty array when user has no data", async () => {
  const { kysely, userSession } = await setupDatabase();

  const [result, error] = await getDataController({
    db: kysely,
    session: userSession.alice.session,
    user: userSession.alice.user,
  });

  expect(error).toBeNull();
  expect(result?.datastores?.length).toBe(0);
});
```

2. **Data Retrieval** - User has data:
```typescript
test("should return user's data", async () => {
  const { kysely, userSession } = await setupDatabase();

  // Setup test data
  await kysely.insertInto('datastore').values({
    id: 'ds_1',
    organization_id: 'org_alice',
    // ... other fields
  }).execute();

  const [result, error] = await getDataController({
    db: kysely,
    session: userSession.alice.session,
    user: userSession.alice.user,
  });

  expect(error).toBeNull();
  expect(result?.datastores?.length).toBe(1);
});
```

3. **Organization Isolation** - Users can't see other orgs' data (shown above)

4. **Error Handling** - Controller handles errors properly:
```typescript
test("should handle database errors", async () => {
  const { kysely, userSession } = await setupDatabase();

  // Close database to force error
  kysely.destroy();

  const [result, error] = await getDataController({
    db: kysely,
    session: userSession.alice.session,
    user: userSession.alice.user,
  });

  expect(result).toBeNull();
  expect(error).not.toBeNull();
  expect(error?.[0]?.code).toBe('CONTROLLER.DATA.GET.FAILED');
});
```

5. **Validation Errors** - Invalid input is rejected:
```typescript
test("should reject invalid input", async () => {
  const { kysely, userSession } = await setupDatabase();

  const [result, error] = await createDatastoreController(
    {
      db: kysely,
      session: userSession.alice.session,
      user: userSession.alice.user,
    },
    {
      internalName: '', // Invalid empty name
      provider: 'sqlite',
    }
  );

  expect(result).toBeNull();
  expect(error).not.toBeNull();
});
```

#### Testing Best Practices

**Use snake_case for DTO properties:**
```typescript
// ✅ Correct - DTOs use snake_case (matching database)
expect(result?.datastores?.[0]?.internal_name).toBe('my-datastore');

// ❌ Wrong - Don't use camelCase
expect(result?.datastores?.[0]?.internalName).toBe('my-datastore');
```

**Test file naming convention:**
```
ctrl.<module>.<action>.test.ts

Examples:
- ctrl.data.get.test.ts
- ctrl.datastore.create.test.ts
- ctrl.datastore.schema-change.test.ts
```

**Clean up resources:**
```typescript
import { afterEach, beforeEach, describe, test } from "bun:test";

describe("controller tests", () => {
  let db: Database;

  beforeEach(async () => {
    const { database, kysely } = await setupDatabase();
    db = database;
  });

  afterEach(() => {
    db.close(); // Clean up
  });

  test("test case", async () => {
    // Test implementation
  });
});
```

**Run tests:**
```bash
# Run all tests
bun test

# Run specific test file
CLAUDECODE=1 bun test src/controllers/ctrl.data.get.test.ts

# Run tests with coverage
bun test --coverage
```

### Controller vs Subroutine

**When to use Controllers:**
- Orchestrating multiple subroutines
- Request-level validation (uniqueness, permissions)
- Handling rollbacks from subroutines
- Converting database entities to DTOs
- Entry point from API routes

**When to use Subroutines:**
- Complex business logic with side effects
- Database transactions
- External API calls
- Reusable logic across multiple controllers

### API Layer Integration

The API layer (ElysiaJS) bridges HTTP requests to controllers:

```typescript
// src/routes/datastore.routes.ts (API layer - ElysiaJS)
app.post('/api/datastore', async ({ body, user, session, db }) => {
  // Extract and validate from ElysiaJS context
  const args: CreateDatastoreArgs = {
    internalName: body.internalName,
    provider: body.provider,
  };

  const ctx: DatastoreControllerContext = {
    user: user,        // Already a DTO
    session: session,  // Already a DTO
    db: db,
  };

  // Call controller (framework-agnostic)
  const [data, error] = await createDatastoreController(ctx, args);

  if (error) {
    const [errorEntry, statusCode] = error;
    return new Response(JSON.stringify(errorEntry), {
      status: statusCode || 500
    });
  }

  return data; // Return DTO
});
```

**Separation of Concerns:**
- **API Layer**: Framework-specific HTTP handling, auth middleware, request/response mapping
- **Controller Layer**: Framework-agnostic business orchestration, DTOs only
- **Subroutine Layer**: Pure business logic with explicit dependencies

**Benefits:**
- Controllers can be tested without HTTP mocking
- Easy to migrate to different frameworks
- Clear boundaries between layers
- Type-safe end-to-end
