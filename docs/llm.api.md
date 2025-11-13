## API Layer

The API layer is the HTTP interface of your application. It uses **Bun's native HTTP server** to handle routing, validation, authentication, and error responses. The API layer is the **only place** where HTTP-specific types should appear.

### API Route Structure

```typescript
import { kysely } from '@server/db';
import { tExternal } from '@server/error/t-error';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { resolveLang } from '@server/mw/mw.lang';
import { type BunRequest, type Serve, type Server } from 'bun';
import { apiTypes } from './api-types';
import { controllerName } from '@server/controllers/module.controller';

export const apiModule: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/module'>, Server<undefined>, Response>>> = {
  POST: async (req, server) => {
    // 1. Authentication
    const session = await resolveSession(req.headers);
    const lang = resolveLang(req.headers);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Parse and validate request body
    const body = await req.json();
    const validatedBody = apiTypes['/api/v1/module'].POST.body.safeParse(body);
    if (!validatedBody.success) return Response.json({ error: validatedBody.error.message }, { status: 400 });

    // 3. Call controller
    const [result, error] = await controllerName(
      { session: session.session, db: kysely },
      validatedBody.data
    );

    // 4. Handle errors
    if (error) return Response.json({ error: tExternal(lang, error) }, { status: 400 });

    // 5. Return result
    return Response.json(result, { status: 201 });
  }
};
```

### Key Components

#### 1. Handler Export

```typescript
export const apiDatastore: Partial<Record<Serve.HTTPMethod, Serve.Handler<
  BunRequest<'/api/v1/datastore/:id'>,
  Server<undefined>,
  Response
>>> = {
  GET: async (req, server) => { /* handler */ },
  POST: async (req, server) => { /* handler */ },
  PATCH: async (req, server) => { /* handler */ },
  DELETE: async (req, server) => { /* handler */ }
};
```

**Best Practices:**
- Export as `const` object with HTTP methods as keys
- Use Bun's native types: `BunRequest`, `Serve.Handler`, `Server`
- Return type is always `Response` (Bun's native Response object)
- Use `Partial<Record<>>` since not all methods may be implemented

#### 2. Authentication Middleware

```typescript
const session = await resolveSession(req.headers);
const lang = resolveLang(req.headers);
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
```

**Authentication Flow:**
- `resolveSession()` validates session from cookies/headers
- Returns `{ user: TUser, session: TSession }` or `null`
- `resolveLang()` extracts preferred language from headers
- Return 401 immediately if no valid session

**Usage:**
- Add at the start of handlers that need authentication
- Access user and session DTOs: `session.user`, `session.session`

#### 3. Route Handlers

**Route Handler Pattern:**

```typescript
POST: async (req, server) => {
  // 1. Authentication
  const session = await resolveSession(req.headers);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Parse body
  const body = await req.json();

  // 3. Validate with Zod
  const validatedBody = apiTypes['/api/v1/endpoint'].POST.body.safeParse(body);
  if (!validatedBody.success) {
    return Response.json({ error: validatedBody.error.message }, { status: 400 });
  }

  // 4. Call controller (framework-agnostic)
  const [result, error] = await controllerName(
    { session: session.session, db: kysely },
    validatedBody.data
  );

  // 5. Handle errors
  if (error) {
    const lang = resolveLang(req.headers);
    return Response.json({ error: tExternal(lang, error) }, { status: 400 });
  }

  // 6. Return DTO
  return Response.json(result, { status: 201 });
}
```

#### 4. Request Validation with Zod

All validation schemas are defined in `api-types.ts`:

```typescript
// api-types.ts
export const apiTypes = {
  '/api/v1/datastore/:id': {
    params: {
      id: z.string().min(1)
    },
    PATCH: {
      body: z.object({
        internalName: z.string().min(1).max(255),
      })
    }
  },
  '/api/v1/mcp-keys': {
    POST: {
      body: z.object({
        name: z.string().min(1),
        permissions: z.array(z.object({
          actionId: z.string(),
          targetId: z.string()
        }))
      })
    }
  }
};
```

**Common Validation Types:**
- `z.string().min(1).max(255)` - String with length constraints
- `z.number().min(0).max(100)` - Number with range
- `z.boolean()` - Boolean
- `z.array(z.string())` - Array of strings
- `z.object({ ... })` - Object with schema
- `z.union([z.literal('a'), z.literal('b')])` - Enum-like union
- `z.optional(z.string())` - Optional field

**Where to Validate:**
- Define all schemas centrally in `api-types.ts`
- Reference them in handlers: `apiTypes['/api/v1/endpoint'].METHOD.body.safeParse(body)`
- Validate params, body, query as needed

#### 5. Error Handling

```typescript
if (error) {
  return Response.json(
    { error: tExternal(lang, error) },
    { status: error.statusCode || 400 }
  );
}
```

**`tExternal` Helper:**
- Converts `TErrorStruct` to user-facing error message
- Supports internationalization via `lang` parameter
- Returns localized error string

**Response Format:**
```typescript
// Success
{ ...result }

// Error
{ error: "User-facing error message" }
```

**Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request (validation/business logic errors)
- 401: Unauthorized (missing/invalid session)
- 404: Not Found
- 500: Internal Server Error

#### 6. URL Parameters

```typescript
GET: async (req, server) => {
  const session = await resolveSession(req.headers);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Access route params from req.params
  const datastoreId = req.params.id;

  const [result, error] = await getDatastoreController(
    { session: session.session, db: kysely },
    { id: datastoreId }
  );

  if (error) {
    const lang = resolveLang(req.headers);
    return Response.json({ error: tExternal(lang, error) }, { status: 404 });
  }

  return Response.json(result);
}
```

### Complete Example

See `src/api/api.datastore.:id.ts` for reference:

```typescript
import { renameDatastoreController } from '@server/controllers/ctrl.datastore.rename';
import { dropDatastoreController } from '@server/controllers/ctrl.datastore.drop';
import { kysely } from '@server/db';
import { tExternal } from '@server/error/t-error';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { resolveLang } from '@server/mw/mw.lang';
import type { BunRequest, Serve, Server } from 'bun';
import { apiTypes } from './api-types';

export const apiDatastoreId: Partial<Record<
  Serve.HTTPMethod,
  Serve.Handler<BunRequest<'/api/v1/datastore/:id'>, Server<undefined>, Response>
>> = {
  PATCH: async (req, server) => {
    const session = await resolveSession(req.headers);
    const lang = resolveLang(req.headers);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const validatedBody = apiTypes['/api/v1/datastore/:id'].PATCH.body.safeParse(body);

    if (!validatedBody.success) {
      return Response.json({ error: validatedBody.error.message }, { status: 400 });
    }

    const [result, error] = await renameDatastoreController(
      { session: session.session, db: kysely },
      { id: req.params.id, internalName: validatedBody.data.internalName }
    );

    if (error) return Response.json({ error: tExternal(lang, error) }, { status: 400 });

    return Response.json(result, { status: 201 });
  },

  DELETE: async (req, server) => {
    const session = await resolveSession(req.headers);
    const lang = resolveLang(req.headers);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [result, error] = await dropDatastoreController(
      { session: session.session, db: kysely },
      { id: req.params.id }
    );

    if (error) return Response.json({ error: tExternal(lang, error) }, { status: 400 });

    return Response.json(result, { status: 200 });
  }
};
```

### Separation of Concerns

**API Layer Responsibilities:**
- HTTP routing and method handling
- Request validation (schema, types, format)
- Authentication and authorization
- Error response formatting
- Converting HTTP requests to controller calls

**What API Layer Does NOT Do:**
- Business logic (use controllers)
- Database operations (use controllers/subroutines)
- Complex validation (uniqueness checks, business rules → controller)

### Query Parameters

```typescript
GET: async (req, server) => {
  const session = await resolveSession(req.headers);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Parse query parameters from URL
  const query = new URLSearchParams(req.url.split('?')[1]);

  // Convert to object
  const queryRecord: Record<string, string | string[]> = {};
  for (const [key, value] of query.entries()) {
    if (queryRecord[key]) {
      // Handle duplicate keys by converting to array
      if (Array.isArray(queryRecord[key])) {
        (queryRecord[key] as string[]).push(value);
      } else {
        queryRecord[key] = [queryRecord[key] as string, value];
      }
    } else {
      queryRecord[key] = value;
    }
  }

  // Extract specific query params
  const limit = query.get('limit') ? Math.min(Math.max(Number(query.get('limit')), 1), 1000) : 50;
  const offset = query.get('offset') ? Number(query.get('offset')) : 0;

  const [result, error] = await searchDatastoresController(
    { session: session.session, db: kysely },
    { limit, offset }
  );

  if (error) {
    const lang = resolveLang(req.headers);
    return Response.json({ error: tExternal(lang, error) }, { status: 400 });
  }

  return Response.json(result);
}
```

### Response Headers

```typescript
GET: async (req, server) => {
  // ... handler logic

  // Create response with custom headers
  const response = new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Range': `0-49/1234`,
      'Cache-Control': 'no-store'
    }
  });

  return response;
}
```

**Example: Content-Range for Pagination (PostgREST style)**

```typescript
POST: async (req, server) => {
  // ... insert logic

  const response = new Response(JSON.stringify(result), {
    headers: {
      'Content-Range': `*/${result.inserted}` // Insert format: */count
    }
  });

  return response;
}
```

### Authentication Patterns

#### Public Routes (No Auth)

```typescript
export const apiPublic: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/public'>, Server<undefined>, Response>>> = {
  GET: async (req, server) => {
    // No authentication check
    return Response.json({ message: 'Public data' });
  }
};
```

#### Protected Routes (Auth Required)

```typescript
export const apiProtected: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/protected'>, Server<undefined>, Response>>> = {
  POST: async (req, server) => {
    // Authentication required
    const session = await resolveSession(req.headers);
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // session.user and session.session available here
    const [result, error] = await controllerName(
      { session: session.session, db: kysely },
      await req.json()
    );

    if (error) {
      const lang = resolveLang(req.headers);
      return Response.json({ error: tExternal(lang, error) }, { status: 400 });
    }

    return Response.json(result);
  }
};
```

### Error Response Standards

All error responses follow this format:

```typescript
// HTTP 400, 401, 403, 404, 500, etc.
{
  error: "User-facing error message"
}
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
{
  "error": "Datastore my-datastore already exists"
}

// Error (401)
{
  "error": "Unauthorized"
}

// Error (500)
{
  "error": "Failed to create datastore"
}
```

### Architecture Flow

```
HTTP Request
    ↓
Bun HTTP Server Router
    ↓
Resolve Session (resolveSession) → Injects user/session DTOs
    ↓
Parse Request Body (req.json())
    ↓
Validation (Zod safeParse) → Validates request
    ↓
API Handler → Extracts params, body, query
    ↓
Controller Call → Framework-agnostic, DTOs only
    ↓
Error Handling → tExternal + status code
    ↓
Response → DTO or error JSON
```

### Best Practices

1. **Keep API Layer Thin:**
   - No business logic in handlers
   - No database queries (except in rare cases)
   - Only HTTP concerns: validation, auth, error formatting

2. **Always Validate:**
   - Define schemas in `api-types.ts` using Zod
   - Use `safeParse()` for all inputs (body, params, query)
   - Return 400 with error message on validation failure
   - Never trust client input

3. **Consistent Error Handling:**
   - Always use `tExternal(lang, error)` for error messages
   - Always set appropriate status code
   - Return `{ error: string }` format for errors

4. **Centralized Validation:**
   - All validation schemas in `api-types.ts`
   - Reference schemas from handlers: `apiTypes[endpoint].METHOD.body`
   - Single source of truth for validation logic

5. **DTOs at the Boundary:**
   - `session.user` and `session.session` are DTOs from resolveSession
   - Controllers receive DTOs
   - Controllers return DTOs
   - Never leak framework types to controllers

6. **Version Your APIs:**
   - Use `/api/v1/...` prefixes
   - Makes breaking changes easier to manage
   - Allows multiple API versions to coexist

7. **Use Bun's Native Types:**
   - Import from `'bun'`: `BunRequest`, `Serve`, `Server`, `Response`
   - Don't mix with other HTTP libraries
   - Leverage Bun's performance optimizations

### Frontend Integration

Create typed API client functions in `public/api-calls.ts`:

```typescript
import { apiTypes } from '@server/api/api-types';
import { z } from 'zod';

type InferZodType<T> = T extends z.ZodType<infer U> ? U : never;

type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: string;
};

async function apiFetch<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: data.error || `HTTP ${response.status}` };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

const apis = {
  '/api/v1/datastore/:id': {
    PATCH: async (
      params: { id: string },
      body: InferZodType<typeof apiTypes['/api/v1/datastore/:id']['PATCH']['body']>
    ) => {
      const validated = apiTypes['/api/v1/datastore/:id'].PATCH.body.safeParse(body);
      if (!validated.success) {
        return { data: null, error: validated.error.message } as const;
      }

      return apiFetch<{ success: boolean }>(`/api/v1/datastore/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validated.data)
      });
    }
  }
};

export default apis;
```

**Usage in Frontend:**

```typescript
import apis from '@public/api-calls';

// Rename datastore
const { data, error } = await apis['/api/v1/datastore/:id'].PATCH(
  { id: 'ds123' },
  { internalName: 'new-name' }
);

if (error) {
  console.error(error);
} else {
  console.log('Success:', data);
}
```

### Common Patterns

#### GET with Pagination

```typescript
GET: async (req, server) => {
  const session = await resolveSession(req.headers);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const query = new URLSearchParams(req.url.split('?')[1]);
  const limit = query.get('limit') ? Math.min(Number(query.get('limit')), 100) : 20;
  const offset = query.get('offset') ? Number(query.get('offset')) : 0;

  const [result, error] = await listDatastoresController(
    { session: session.session, db: kysely },
    { limit, offset }
  );

  if (error) {
    const lang = resolveLang(req.headers);
    return Response.json({ error: tExternal(lang, error) }, { status: 400 });
  }

  return Response.json(result);
}
```

#### DELETE by ID

```typescript
DELETE: async (req, server) => {
  const session = await resolveSession(req.headers);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const [result, error] = await deleteDatastoreController(
    { session: session.session, db: kysely },
    { id: req.params.id }
  );

  if (error) {
    const lang = resolveLang(req.headers);
    return Response.json({ error: tExternal(lang, error) }, { status: 404 });
  }

  return Response.json({ deleted: true });
}
```

#### PATCH (Partial Update)

```typescript
PATCH: async (req, server) => {
  const session = await resolveSession(req.headers);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const validatedBody = apiTypes['/api/v1/datastore/:id'].PATCH.body.safeParse(body);

  if (!validatedBody.success) {
    return Response.json({ error: validatedBody.error.message }, { status: 400 });
  }

  const [result, error] = await updateDatastoreController(
    { session: session.session, db: kysely },
    { id: req.params.id, ...validatedBody.data }
  );

  if (error) {
    const lang = resolveLang(req.headers);
    return Response.json({ error: tExternal(lang, error) }, { status: 404 });
  }

  return Response.json(result);
}
```

### Summary

The API layer is your HTTP boundary:
- **Bun native types only** (never leak to controllers)
- **Validate all inputs** with Zod schemas in `api-types.ts`
- **Call controllers** with DTOs
- **Handle errors** consistently with `tExternal()`
- **Keep it thin** - no business logic
- **Frontend integration** via typed `api-calls.ts` that reuses Zod schemas
