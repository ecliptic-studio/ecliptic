## API Layer

The API layer is the HTTP interface of your application. It uses **ElysiaJS** to handle routing, validation, authentication, and error responses. The API layer is the **only place** where framework-specific types (ElysiaJS) should appear.

### API Route Structure

```typescript
import { Elysia, status, t } from 'elysia';
import { mwAuthGuard } from '@server/mw/mw.auth-guard';
import { kysely } from '@server/db';
import { jsonError } from '@server/server-helper';
import { controllerName } from '@server/controllers/module.controller';

export const apiModule = new Elysia({
  prefix: '/api/v1/module',
  name: 'apiModule'
})
  .use(mwAuthGuard)
  .post(
    '/endpoint',
    async (ctx) => {
      // Call controller with DTOs
      const [result, error] = await controllerName(
        { user: ctx.user, session: ctx.session, db: kysely },
        ctx.body
      );

      ctx.set.headers['accept'] = 'application/json';
      if (error) return status(error[1] ?? 400, jsonError(ctx, error));

      return result; // Return DTO
    },
    {
      auth: true,
      body: t.Object({
        // Validation schema
      }),
      detail: {
        summary: 'Endpoint description',
        description: 'Detailed description for OpenAPI',
        tags: ['Module']
      }
    }
  );
```

### Key Components

#### 1. Elysia Instance

```typescript
export const apiDatastore = new Elysia({
  prefix: '/api/v1/datastore',  // Route prefix
  name: 'apiDatastore'           // Name for plugin system
});
```

**Best Practices:**
- Use versioned prefixes: `/api/v1/...`
- Name your API instances for better debugging
- Export as `const` for use in main app

#### 2. Middleware

```typescript
.use(mwAuthGuard)
```

**`mwAuthGuard` Middleware:**
- Provides authentication via Better Auth
- Injects `user` and `session` as **DTOs** (`TUser`, `TSession`)
- Sets default organization if none is active
- Returns 401 on authentication failure

**Usage:**
- Add `.use(mwAuthGuard)` before routes that need authentication
- Mark routes with `auth: true` in options
- Access via `ctx.user` and `ctx.session`

#### 3. Route Definition

```typescript
.post('/endpoint', handler, options)
.get('/endpoint', handler, options)
.put('/endpoint', handler, options)
.delete('/endpoint', handler, options)
.patch('/endpoint', handler, options)
```

**Route Handler Pattern:**

```typescript
async (ctx) => {
  // 1. Extract data from ctx (validated by Elysia)
  const args = ctx.body;        // or ctx.params, ctx.query
  const user = ctx.user;        // From mwAuthGuard (DTO)
  const session = ctx.session;  // From mwAuthGuard (DTO)

  // 2. Call controller (framework-agnostic)
  const [result, error] = await controllerName(
    { user, session, db: kysely },
    args
  );

  // 3. Handle errors
  ctx.set.headers['accept'] = 'application/json';
  if (error) return status(error[1] ?? 400, jsonError(ctx, error));

  // 4. Return DTO
  return result;
}
```

#### 4. Request Validation

ElysiaJS uses `t` schema for compile-time and runtime validation:

```typescript
{
  body: t.Object({
    internalName: t.String({ minLength: 1, maxLength: 255 }),
    provider: t.Union([t.Literal('sqlite'), t.Literal('turso')]),
    region: t.Optional(t.String()),
    count: t.Number({ minimum: 1, maximum: 100 }),
    tags: t.Array(t.String()),
    metadata: t.Record(t.String(), t.Any())
  })
}
```

**Common Validation Types:**
- `t.String({ minLength, maxLength, pattern, format })` - String validation
- `t.Number({ minimum, maximum })` - Number validation
- `t.Boolean()` - Boolean
- `t.Array(t.String())` - Array of strings
- `t.Object({ ... })` - Object with schema
- `t.Union([t.Literal('a'), t.Literal('b')])` - Enum-like union
- `t.Optional(t.String())` - Optional field
- `t.Record(t.String(), t.Any())` - Key-value map

**Where to Validate:**
- `body` - Request body (POST/PUT/PATCH)
- `params` - URL parameters (`/user/:id`)
- `query` - Query strings (`?search=term`)
- `headers` - Request headers

#### 5. Error Handling

```typescript
if (error) return status(error[1] ?? 400, jsonError(ctx, error));
```

**`jsonError` Helper:**
- Converts `TErrorStruct` to standardized JSON response
- Logs errors to database if `shouldLog: true`
- Returns format: `[null, { code: string, message: string }]`
- Extracts user-facing message using `tExternal()`

**Response Format:**
```typescript
// Success
{ ...result }

// Error
[null, {
  code: "CONTROLLER.DATASTORE.CREATE.FAILED",
  message: "Failed to create datastore"
}]
```

**Status Codes:**
- Comes from `error[1]` (second element of `TErrorStruct`)
- Falls back to `400` if not specified
- Use `status()` from Elysia to set HTTP status

#### 6. OpenAPI Documentation

```typescript
{
  detail: {
    summary: 'Create a new datastore',
    description: 'Creates a new SQLite database in the filesystem and tracks it in the database',
    tags: ['Datastore']
  }
}
```

**Best Practices:**
- `summary` - Short one-line description
- `description` - Detailed multi-line explanation
- `tags` - Group related endpoints (used in Swagger UI)
- Elysia generates OpenAPI spec automatically from validation schema

### Complete Example

See `@src/api/api.datastore.ts` for reference:

```typescript
import { Elysia, status, t } from 'elysia';
import { mwAuthGuard } from '@server/mw/mw.auth-guard';
import { createDatastoreController } from '@server/controllers/datastore.controller';
import { kysely } from '@server/db';
import { jsonError } from '@server/server-helper';

export const apiDatastore = new Elysia({
  prefix: '/api/v1/datastore',
  name: 'apiDatastore'
})
  .use(mwAuthGuard)
  .post(
    '',
    async (ctx) => {
      // Call controller with DTOs
      const [result, error] = await createDatastoreController(
        {
          user: ctx.user,      // TUser (DTO from middleware)
          session: ctx.session, // TSession (DTO from middleware)
          db: kysely           // Database connection
        },
        ctx.body               // Validated request body
      );

      ctx.set.headers['accept'] = 'application/json';
      if (error) return status(error[1] ?? 400, jsonError(ctx, error));

      return result; // TDatastore (DTO from controller)
    },
    {
      auth: true,
      body: t.Object({
        internalName: t.String({ minLength: 1, maxLength: 255 }),
        provider: t.Union([t.Literal('sqlite')]),
      }),
      detail: {
        summary: 'Create a new datastore',
        description: 'Creates a new SQLite database in the filesystem and tracks it in the database',
        tags: ['Datastore']
      }
    }
  );
```

### Separation of Concerns

**API Layer Responsibilities:**
- HTTP routing and method handling
- Request validation (schema, types, format)
- Authentication and authorization (middleware)
- Error response formatting
- OpenAPI documentation
- Converting HTTP requests to controller calls

**What API Layer Does NOT Do:**
- Business logic (use controllers)
- Database operations (use controllers/subroutines)
- Complex validation (uniqueness checks, business rules → controller)

### Integrating with Main App

```typescript
// src/index.tsx
import { Elysia } from 'elysia';
import { apiDatastore } from './api/api.datastore';
import { apiData } from './api/api.data';

const app = new Elysia()
  .use(apiDatastore)
  .use(apiData)
  .listen(3000);
```

**Plugin System:**
- Each API module is an Elysia plugin
- Use `.use()` to compose multiple API modules
- Name your plugins for better error messages

### Route Parameters

```typescript
.get(
  '/:id',
  async (ctx) => {
    const datastoreId = ctx.params.id;

    const [result, error] = await getDatastoreController(
      { user: ctx.user, session: ctx.session, db: kysely },
      { id: datastoreId }
    );

    if (error) return status(error[1] ?? 404, jsonError(ctx, error));
    return result;
  },
  {
    auth: true,
    params: t.Object({
      id: t.String({ minLength: 1 })
    }),
    detail: {
      summary: 'Get datastore by ID',
      tags: ['Datastore']
    }
  }
);
```

### Query Parameters

```typescript
.get(
  '/search',
  async (ctx) => {
    const { query, limit, offset } = ctx.query;

    const [result, error] = await searchDatastoresController(
      { user: ctx.user, session: ctx.session, db: kysely },
      { query, limit, offset }
    );

    if (error) return status(error[1] ?? 400, jsonError(ctx, error));
    return result;
  },
  {
    auth: true,
    query: t.Object({
      query: t.String({ minLength: 1 }),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 10 })),
      offset: t.Optional(t.Number({ minimum: 0, default: 0 }))
    }),
    detail: {
      summary: 'Search datastores',
      tags: ['Datastore']
    }
  }
);
```

### Response Headers

```typescript
async (ctx) => {
  // Set response headers
  ctx.set.headers['accept'] = 'application/json';
  ctx.set.headers['cache-control'] = 'no-store';

  // ... rest of handler
}
```

### Authentication Patterns

#### Public Routes (No Auth)

```typescript
.get(
  '/public',
  async (ctx) => {
    return { message: 'Public data' };
  },
  {
    // No auth: true - this route is public
  }
);
```

#### Protected Routes (Auth Required)

```typescript
.post(
  '/protected',
  async (ctx) => {
    // ctx.user and ctx.session available here
    const [result, error] = await controllerName(
      { user: ctx.user, session: ctx.session, db: kysely },
      ctx.body
    );

    if (error) return status(error[1] ?? 400, jsonError(ctx, error));
    return result;
  },
  {
    auth: true  // Requires authentication
  }
);
```

### Error Response Standards

All error responses follow this format:

```typescript
// HTTP 400, 401, 403, 404, 500, etc.
[null, {
  code: "ERROR.CODE.HERE",
  message: "User-facing error message"
}]
```

**Example Responses:**

```json
// Success (200)
{
  "id": "abc123",
  "internalName": "my-datastore",
  "provider": "sqlite"
}

// Error (400)
[null, {
  "code": "CONTROLLER.DATASTORE.CREATE.UNIQUE_NAME",
  "message": "Datastore my-datastore already exists"
}]

// Error (500)
[null, {
  "code": "CONTROLLER.DATASTORE.CREATE.FAILED",
  "message": "Failed to create datastore"
}]
```

### Architecture Flow

```
HTTP Request
    ↓
ElysiaJS Router
    ↓
Middleware (mwAuthGuard) → Injects user/session DTOs
    ↓
Validation (t.Object) → Validates request
    ↓
API Handler → Extracts ctx.user, ctx.session, ctx.body
    ↓
Controller Call → Framework-agnostic, DTOs only
    ↓
Error Handling → jsonError + status code
    ↓
Response → DTO or error JSON
```

### Best Practices

1. **Keep API Layer Thin:**
   - No business logic in handlers
   - No database queries (except in rare cases)
   - Only HTTP concerns: validation, auth, error formatting

2. **Always Validate:**
   - Use `t.Object()` for all inputs (body, params, query)
   - Let Elysia handle validation errors automatically
   - Never trust client input

3. **Consistent Error Handling:**
   - Always use `jsonError(ctx, error)`
   - Always set status code: `status(error[1] ?? defaultCode, ...)`
   - Always set `accept: application/json` header

4. **Document Everything:**
   - Add `detail` with `summary`, `description`, and `tags`
   - Use descriptive route names
   - Group related routes with tags

5. **DTOs at the Boundary:**
   - `ctx.user` and `ctx.session` are DTOs from middleware
   - Controllers receive DTOs
   - Controllers return DTOs
   - Never leak framework types to controllers

6. **Version Your APIs:**
   - Use `/api/v1/...` prefixes
   - Makes breaking changes easier to manage
   - Allows multiple API versions to coexist

### Testing API Routes

API routes can be tested by mocking controllers:

```typescript
import { describe, it, expect, mock } from 'bun:test';
import { apiDatastore } from './api.datastore';

describe('POST /api/v1/datastore', () => {
  it('should create datastore', async () => {
    // Mock controller
    const mockController = mock(() => Promise.resolve([
      { id: '123', internalName: 'test' },
      null
    ]));

    // Test request
    const res = await apiDatastore.handle(
      new Request('http://localhost/api/v1/datastore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalName: 'test', provider: 'sqlite' })
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('123');
  });
});
```

### Common Patterns

#### GET with Pagination

```typescript
.get('/list', async (ctx) => {
  const [result, error] = await listDatastoresController(
    { user: ctx.user, session: ctx.session, db: kysely },
    { limit: ctx.query.limit, offset: ctx.query.offset }
  );

  if (error) return status(error[1] ?? 400, jsonError(ctx, error));
  return result;
}, {
  auth: true,
  query: t.Object({
    limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
    offset: t.Optional(t.Number({ minimum: 0, default: 0 }))
  })
});
```

#### DELETE by ID

```typescript
.delete('/:id', async (ctx) => {
  const [result, error] = await deleteDatastoreController(
    { user: ctx.user, session: ctx.session, db: kysely },
    { id: ctx.params.id }
  );

  if (error) return status(error[1] ?? 404, jsonError(ctx, error));
  return { deleted: true };
}, {
  auth: true,
  params: t.Object({
    id: t.String()
  })
});
```

#### PATCH (Partial Update)

```typescript
.patch('/:id', async (ctx) => {
  const [result, error] = await updateDatastoreController(
    { user: ctx.user, session: ctx.session, db: kysely },
    { id: ctx.params.id, ...ctx.body }
  );

  if (error) return status(error[1] ?? 404, jsonError(ctx, error));
  return result;
}, {
  auth: true,
  params: t.Object({
    id: t.String()
  }),
  body: t.Object({
    internalName: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
    status: t.Optional(t.Union([t.Literal('active'), t.Literal('archived')]))
  })
});
```

### Summary

The API layer is your HTTP boundary:
- **ElysiaJS types stay here** (never leak to controllers)
- **Validate all inputs** with `t.Object()`
- **Call controllers** with DTOs
- **Handle errors** consistently with `jsonError()`
- **Document with OpenAPI** using `detail`
- **Keep it thin** - no business logic
