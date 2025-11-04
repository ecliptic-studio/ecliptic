// Controller handles HTTP related eg. routing, request validation
import { deleteTableRowsController } from '@server/controllers/ctrl.datastore.rows-delete';
import { insertTableRowsController } from '@server/controllers/ctrl.datastore.rows-insert';
import { updateTableRowsController } from '@server/controllers/ctrl.datastore.rows-update';
import { getTableDataController } from '@server/controllers/ctrl.datastore.table-get';
import { kysely } from '@server/db';
import { mwAuthGuard } from '@server/mw/mw.auth-guard';
import { jsonError } from '@server/server-helper';
import { parseQueryFn } from '@server/subroutines/datastore/query-parser.fn';
import { Elysia, status, t } from 'elysia';


/**
 * Build Content-Range header (PostgREST syntax)
 *
 * @example buildContentRangeHeader(0, 49, 1234) returns "0-49/1234"
 * @example buildContentRangeHeader(0, 49) returns "0-49/*"
 * @example buildContentRangeHeader(null, 5) returns "star-slash-5" (for inserts)
 */
function buildContentRangeHeader(start: number | null, end: number, total?: number): string {
  if (start === null) {
    // Insert format: */count
    return `*/${end}`;
  }

  if (total !== undefined) {
    return `${start}-${end}/${total}`;
  }

  return `${start}-${end}/*`;
}

export const apiDatastoreTable = new Elysia({
  prefix: '/api/v1/datastore/:id/table',
  name: 'apiDatastoreTable'
})
  .use(mwAuthGuard)
  .get(
    '/:tableName',
    async (ctx) => {
      // Parse query parameters (PostgREST syntax)
      const filters = parseQueryFn(ctx.query);

      // Parse and validate limit (default: 50, max: 1000) - Changed from 'pageSize' to 'limit'
      const limit = ctx.query.limit
        ? Math.min(Math.max(Number(ctx.query.limit), 1), 1000)
        : 50;


      // Call controller
      const [result, error] = await getTableDataController(
        { session: ctx.session, db: kysely },
        {
          datastoreId: ctx.params.id,
          tableName: ctx.params.tableName,
          filters: filters.filters,
          sort: filters.order,
          pageSize: limit, // Controller still expects 'pageSize' internally
          offset: filters.offset ?? 0,
          columns: filters.select,
        }
      );

      ctx.set.headers['accept'] = 'application/json';

      // Add Content-Range header (PostgREST style)
      if (result && !error) {
        const start = filters.offset ?? 0;
        const end = (filters.offset ?? 0) + result.data.length - 1;
        ctx.set.headers['content-range'] = buildContentRangeHeader(start, end >= 0 ? end : 0);
      }

      if (error) return status('Bad Request', jsonError(ctx as any, error));

      return result;
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ minLength: 1 }),
        tableName: t.String({ minLength: 1 })
      }),
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 1000 })),
        offset: t.Optional(t.Numeric({ minimum: 0 })),
        order: t.Optional(t.String()),
        select: t.Optional(t.String())
        // Dynamic filters (e.g., column=operator.value) not validated here
        // They are parsed by parseQueryFn() and validated in the subroutine
      }, { additionalProperties: true }),
      detail: {
        summary: 'Get table data with pagination and filters (PostgREST syntax)',
        description: `
Fetches data from a datastore table with support for:
- **Pagination**: ?limit=50&offset=0 (default limit: 50, max: 1000)
- **Filtering**: ?age=gte.18&status=eq.active
- **Sorting**: ?order=name.asc,created_at.desc
- **Column selection**: ?select=id,name,email

**Supported filter operators**: eq, neq, ne, gt, gte, lt, lte, like, ilike, in, is

**Filter examples (PostgREST syntax)**:
- Equal: ?status=eq.active
- Greater than or equal: ?age=gte.18
- Pattern matching: ?email=like.*@gmail.com (use * for wildcard)
- Case-insensitive: ?name=ilike.*john*
- In list: ?status=in.(active,pending)
- NULL check: ?column=is.null

**Response headers**:
- Content-Range: {offset}-{end}/* (e.g., 0-49/*)

**Response includes**:
- data: Array of table rows (at most limit rows). Each row includes a \`_rowid\` field containing SQLite's internal ROWID.
- pagination: { pageSize, offset, hasMore }
- columns: Array of column names in result (includes \`_rowid\`)
        `.trim(),
        tags: ['Datastore', 'Table Data']
      }
    }
  )
  .post(
    '/:tableName',
    async (ctx) => {
      // PostgREST syntax: Accept direct object or array (no wrapper)
      const body = ctx.body;
      const isArray = Array.isArray(body);

      const [result, error] = await insertTableRowsController(
        { session: ctx.session, db: kysely },
        {
          datastoreId: ctx.params.id,
          tableName: ctx.params.tableName,
          row: isArray ? undefined : body,
          rows: isArray ? body : undefined,
        }
      );

      ctx.set.headers['accept'] = 'application/json';

      // Add Content-Range header (PostgREST style): */count
      if (result && !error) {
        ctx.set.headers['content-range'] = buildContentRangeHeader(null, result.inserted);
      }

      if (error) return status('Bad Request', jsonError(ctx as any, error));

      return result;
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ minLength: 1 }),
        tableName: t.String({ minLength: 1 })
      }),
      body: t.Union([
        t.Record(t.String(), t.Any()),
        t.Array(t.Record(t.String(), t.Any()))
      ]),
      detail: {
        summary: 'Insert rows into table (PostgREST syntax)',
        description: `
Insert one or multiple rows into a datastore table.

**Request body (PostgREST syntax)**:
- Single row: \`{ "column1": value1, "column2": value2 }\`
- Bulk insert: \`[{ "column1": value1 }, { "column1": value2 }]\`

**Response**:
- inserted: Number of rows inserted
- rows: Inserted rows with all columns (including ROWID)

**Response headers**:
- Content-Range: */count (e.g., */5 for 5 rows inserted)

**Validation**:
- Column names must exist in table schema
- Values must match SQLite types (TEXT, INTEGER, REAL, BLOB)
        `.trim(),
        tags: ['Datastore', 'Table Data']
      }
    }
  )
  .patch(
    '/:tableName',
    async (ctx) => {
      // PostgREST syntax: WHERE conditions from query params, update values in body
      const filters = parseQueryFn(ctx.query);

      const [result, error] = await updateTableRowsController(
        { session: ctx.session, db: kysely },
        {
          datastoreId: ctx.params.id,
          tableName: ctx.params.tableName,
          set: ctx.body, // Direct body (no 'set' wrapper)
          where: filters.filters, // Filters from query params
        }
      );

      ctx.set.headers['accept'] = 'application/json';

      // Add Content-Range header (PostgREST style)
      if (result && !error) {
        const count = result.updated;
        if (count > 0) {
          ctx.set.headers['content-range'] = buildContentRangeHeader(0, count - 1, count);
        }
      }

      if (error) return status('Bad Request', jsonError(ctx as any, error));

      return result;
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ minLength: 1 }),
        tableName: t.String({ minLength: 1 })
      }),
      query: t.Object({
        // Dynamic filters (e.g., column=operator.value) not validated here
        // They are parsed by parseQueryFn() and validated in the subroutine
      }, { additionalProperties: true }),
      body: t.Record(t.String(), t.Any()),
      detail: {
        summary: 'Update rows in table (PostgREST syntax)',
        description: `
Update existing rows in a datastore table.

**Request (PostgREST syntax)**:
\`\`\`http
PATCH /api/v1/datastore/:id/table/:tableName?id=eq.1&status=eq.active
Content-Type: application/json

{
  "column1": "newValue",
  "column2": 123
}
\`\`\`

**Query parameters (filters)**:
- Same syntax as GET: ?column=operator.value
- Multiple conditions are AND-ed together
- Supported operators: eq, neq, ne, gt, gte, lt, lte, like, ilike, in, is

**Examples**:
- Update by ID: ?id=eq.5
- Update multiple: ?status=in.(pending,draft)
- Complex filter: ?age=gte.18&country=eq.USA

**Response**:
- updated: Number of rows updated
- rows: Array of updated rows with all columns (including _rowid)

**Response headers**:
- Content-Range: 0-{count-1}/{count} (e.g., 0-4/5 for 5 rows updated)

**Validation**:
- WHERE filters required (prevents accidental full-table updates)
- Column names must exist in table schema
        `.trim(),
        tags: ['Datastore', 'Table Data']
      }
    }
  )
  .delete(
    '/:tableName',
    async (ctx) => {
      const [result, error] = await deleteTableRowsController(
        { session: ctx.session, db: kysely },
        {
          datastoreId: ctx.params.id,
          tableName: ctx.params.tableName,
          rowids: ctx.body.rowids,
        }
      );

      ctx.set.headers['accept'] = 'application/json';

      // Add Content-Range header (PostgREST style)
      if (result && !error) {
        const count = result.deleted;
        if (count > 0) {
          ctx.set.headers['content-range'] = buildContentRangeHeader(0, count - 1, count);
        }
      }

      if (error) return status('Bad Request', jsonError(ctx as any, error));

      return result;
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ minLength: 1 }),
        tableName: t.String({ minLength: 1 })
      }),
      body: t.Object({
        rowids: t.Array(t.Number({ minimum: 1 }), { minItems: 1 })
      }),
      detail: {
        summary: 'Delete rows from table by ROWID',
        description: `
Delete rows from a datastore table by their ROWIDs.

**Request body**:
\`\`\`json
{
  "rowids": [1, 2, 3]
}
\`\`\`

**Response**:
- deleted: Number of rows deleted

**Response headers**:
- Content-Range: 0-{count-1}/{count} (e.g., 0-2/3 for 3 rows deleted)

**Validation**:
- rowids array must contain at least one ROWID
- Each ROWID must be a positive number

**Example**:
\`\`\`http
DELETE /api/v1/datastore/abc123/table/users
Content-Type: application/json

{
  "rowids": [5, 10, 15]
}
\`\`\`
        `.trim(),
        tags: ['Datastore', 'Table Data']
      }
    }
  );
