## Subroutines

Subroutines are pure business logic functions that handle complex operations with side effects. They follow a strict pattern for consistency and testability.

### Subroutine Naming Convention

Subroutines **must** have a suffix that indicates their behavior for testing and mocking strategies:

- **`.tx.ts`** (Transactional): Write operations, database changes, mostly returns rollbacks if possible
  - Example: `create-datastore.tx.ts`, `update-user.tx.ts`
  - Used for: Creating, updating, deleting data
  - Rollback strategy: External rollbacks for non-DB side effects (DB transactions auto-rollback)

- **`.fx.ts`** (Effectful): Read operations with side effects, I/O operations, external system reads
  - Example: `fetch-user-data.fx.ts`, `generate-random-id.fx.ts`
  - Used for: Reading from external APIs, file system operations, non-deterministic operations
  - Generally no rollbacks needed

- **`.fn.ts`** (Pure Function): Pure functions with no side effects, deterministic
  - Example: `calculate-price.fn.ts`, `validate-email.fn.ts`
  - Used for: Calculations, validations, transformations
  - No rollbacks needed

**Why These Suffixes?**
- Enables clear testing strategies (mocking vs. testing)
- Makes it obvious what side effects to expect
- Helps determine rollback requirements
- Facilitates building test frameworks and mocking layers

### Subroutine Function Signature

```typescript
export async function subroutineName(
  portal: PortalType,
  args: ArgsType
): Promise<TErrTriple<ReturnType>> {
  const rollbacks: TExternalRollback[] = [];

  // Implementation

  return [result, null, rollbacks]; // success
  // OR
  return [null, errorStruct, rollbacks]; // failure
}
```

### The Portal Pattern

The **portal** is the first argument and provides all external dependencies:

```typescript
export type CreateDatastorePortal = {
  db: TKysely;                          // Database connection
  c: { env: typeof process.env };       // Environment variables
  // Add other external clients as needed (e.g., stripe, neon, etc.)
};
```

**Why Portal?**
- Makes subroutines testable by injecting dependencies
- All side effects must come from the portal
- Exception: Non-destructive operations like `nanoid()`, `Date.now()`, or slug generation are allowed inline

### The Args Pattern

All input parameters go in a single **args** object:

```typescript
export type CreateDatastoreArgs = {
  internalName: string;
  provider: 'sqlite' | 'turso';
  organizationId: string;
  region?: string;
  // ... other parameters
};
```

### The TErrTriple Return Pattern

Subroutines always return `TErrTriple<T>`:

```typescript
// Success case
return [data, null, rollbacks];

// Error case
return [
  null,
  createError(ErrorCode.SOME_ERROR_CODE)
    .statusCode('Bad Request')
    .internal('Internal debug message')
    .external({ en: 'User-facing message', de: 'German message' })
    .shouldLog(true)
    .buildEntry(),
  rollbacks
];
```

**Components:**
1. **Result** (`T | null`): The success data or null on error
2. **Error** (`TErrorStruct | null`): Error information or null on success
3. **Rollbacks** (`TExternalRollback[]`): Functions to undo external side effects (always include, even if empty)

### Rollback Functions

Rollbacks clean up external resources (non-database) on failure:

```typescript
// Add rollback after creating an external resource
rollbacks.push(async () => {
  try {
    await deleteExternalResource();
    return ['Cleaned up resource', null, []];
  } catch (e) {
    return [
      null,
      createError(ErrorCode.SR_ROLLBACK_FAILED)
        .internal(`Failed: ${e}`)
        .external({ en: 'Failed to clean up resource', de: 'Ressource konnte nicht bereinigt werden' })
        .shouldLog(true)
        .buildEntry(),
      []
    ];
  }
});
```

**Note:** Database rollbacks are handled by transactions, not rollback functions.

### Example Subroutine

See `@src/subroutines/datastore/create-datastore.tx.ts` for a complete reference implementation.

## Error Codes

All error codes are centralized in `@src/error-handling/error-code.enum.ts` for consistency and discoverability.

### Error Code Convention

Error codes follow the pattern: `MODULE.FUNCTION.ERROR_CODE`

```typescript
export enum ErrorCode {
  // CONTROLLER - errors from controller layer

  // SUBROUTINES - errors from subroutines
  SR_DATASTORE_CREATE_FAILED = 'SR.DATASTORE.CREATE.FAILED',
  SR_DATASTORE_ROLLBACK_DELETE_FILE_FAILED = 'SR.DATASTORE.ROLLBACK.DELETE_FILE_FAILED',
}
```

**Naming Convention:**
- `SR` = Subroutine
- `DATASTORE` = Module/feature name
- `CREATE` = Function name (optional)
- `FAILED` = Error type

### Using Error Codes in Subroutines

**Always use the ErrorCode enum instead of string literals:**

```typescript
import { ErrorCode } from "@src/error-handling/error-code.enum";
import { createError } from "@src/error-handling/t-error";

// ✅ Correct - Use ErrorCode enum
return [
  null,
  createError(ErrorCode.SR_DATASTORE_CREATE_FAILED)
    .statusCode('Internal Server Error')
    .internal(`Failed to create datastore: ${error}`)
    .external({ en: 'Failed to create datastore', de: 'Datastore konnte nicht erstellt werden' })
    .shouldLog(true)
    .buildEntry(),
  rollbacks
];

// ❌ Wrong - Don't use string literals
return [
  null,
  createError('DATASTORE.CREATE.FAILED')  // Hard to track, prone to typos
    .buildEntry(),
  rollbacks
];
```

### Adding New Error Codes

1. Open `@src/error-handling/error-code.enum.ts`
2. Add your error code following the naming convention
3. Group by category (CONTROLLER, SUBROUTINES, etc.)
4. Use descriptive names that indicate the module and error type

**Example:**
```typescript
export enum ErrorCode {
  // SUBROUTINES
  SR_DATASTORE_CREATE_FAILED = 'SR.DATASTORE.CREATE.FAILED',
  SR_DATASTORE_DELETE_FAILED = 'SR.DATASTORE.DELETE.FAILED',
  SR_USER_NOT_FOUND = 'SR.USER.NOT_FOUND',
  SR_USER_CREATE_FAILED = 'SR.USER.CREATE.FAILED',
}
```

**Benefits:**
- TypeScript autocomplete for all error codes
- Compile-time checking prevents typos
- Easy to find all usages of an error code
- Centralized error code documentation
