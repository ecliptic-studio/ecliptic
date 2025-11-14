## Controllers

Controllers orchestrate business logic (subroutines), handle validation, authorization, and coordinate database operations. They are **framework-agnostic** - no framework-specific types allowed.

**Naming:** `ctrl.<module>.<action>.ts`

### Signature

```typescript
export async function controllerName(
  ctx: ControllerContext,    // Dependencies (db, session, user)
  args: ArgsType             // Input parameters
): Promise<TErrTuple<ReturnType>> {
  return [result, null];     // success
  return [null, errorStruct]; // failure
}
```

### Context Pattern (First Argument)

Request-scoped dependencies, **DTOs only**:

```typescript
export type DatastoreControllerContext = {
  user: TUser;        // From @dto/TUser
  session: TSession;  // From @dto/TSession
  db: TKysely;
};
```

**Rules:**
- All types must be DTOs from `@dto/` (never framework types)
- Makes controllers testable by dependency injection

### Args Pattern (Second Argument)

All input in a single object:

```typescript
export type CreateDatastoreArgs = {
  internalName: string;
  provider: 'sqlite' | 'turso';
};
```

### Return Pattern: TErrTuple<T>

```typescript
// Success
return [data, null];

// Error
return [
  null,
  createError(ErrorCode.CONTROLLER_X_FAILED)
    .statusCode(400)
    .internal('Debug message')
    .external({ en: 'User message', fallback: 'User message' })
    .shouldLog(true)
    .buildEntry()
];
```

**Note:** Controllers return `TErrTuple` (2-tuple: result, error), NOT `TErrTriple` (3-tuple with rollbacks).

### DTO Pattern

**Always convert database entities to DTOs before returning:**

```typescript
import { toTDatastore, type TDatastore } from "@dto/TDatastore";

const dbEntity = await ctx.db.insertInto('datastore')
  .values({ ... })
  .returningAll()
  .executeTakeFirstOrThrow();

const dto = toTDatastore(dbEntity); // Convert to DTO
return [dto, null];
```

**Rules:**
- Never return raw database entities
- Each DTO exports type + `toT*` mapper (e.g., `toTDatastore`)
- DTOs hide sensitive fields (`encrypted_json`, `external_id`)

### Rollback Handling

Execute rollbacks when subroutines succeed but subsequent operations fail:

```typescript
import { executeRollbacks } from "@error/rollback";

const [result, error, rollbacks] = await createDatastoreTx(portal, args);

if (error) {
  await executeRollbacks(rollbacks);
  return [null, error];
}

try {
  const datastore = await ctx.db.insertInto('datastore')
    .values({ ... })
    .returningAll()
    .executeTakeFirstOrThrow();

  return [toTDatastore(datastore), null];
} catch (error) {
  await executeRollbacks(rollbacks); // Clean up external resources
  return [null, errorStruct];
}
```

### Error Codes

**Convention:** `CONTROLLER.<MODULE>.<ACTION>.<TYPE>`

```typescript
export enum ErrorCode {
  CONTROLLER_DATASTORE_CREATE_FAILED = 'CONTROLLER.DATASTORE.CREATE.FAILED',
  CONTROLLER_DATASTORE_NOT_FOUND = 'CONTROLLER.DATASTORE.NOT_FOUND',
}

### API Layer Integration (Bun Native)

API routes call controllers:

```typescript
// src/api/api.datastore.ts
import { apiTypes } from './api-types';
import { createDatastoreController } from '@server/controllers/ctrl.datastore.create';
import { kysely } from '@server/db';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { toErrorResponse } from '@server/server-helper';

export const apiDatastore = {
  POST: async (req, server) => {
    const session = await resolveSession(req.headers);
    if (!session) return Response.json({error: 'Unauthorized'}, {status: 401});

    const body = await req.json();
    const validated = apiTypes['/api/v1/datastore'].POST.body.safeParse(body);
    if (!validated.success) return Response.json({error: validated.error.message}, {status: 400});

    // Call controller
    const [result, error] = await createDatastoreController(
      { session: session.session, user: session.user, db: kysely },
      { provider: validated.data.provider, internalName: validated.data.internalName }
    );

    if (error) return toErrorResponse({req, user: session.user, session: session.session, error});
    return Response.json(result, {status: 201});
  }
};
```

Then register in `src/index.ts`:

```typescript
import { apiDatastore } from './api/api.datastore';

const server = Bun.serve({
  routes: {
    "/api/v1/datastore": apiDatastore,
  },
  port: 3000,
});
```

**Separation:**
- **API Layer** (`src/api/`): HTTP handling, validation (Zod), auth, error mapping
- **Controller Layer** (`src/controllers/`): Business orchestration, DTOs only
- **Subroutine Layer** (`src/subroutines/`): Pure business logic with explicit dependencies
