// Controller handles HTTP related eg. routing, request validation
import { deleteTableRowsController } from '@server/controllers/ctrl.datastore.rows-delete';
import { insertTableRowsController } from '@server/controllers/ctrl.datastore.rows-insert';
import { updateTableRowsController } from '@server/controllers/ctrl.datastore.rows-update';
import { getTableDataController } from '@server/controllers/ctrl.datastore.table-get';
import { kysely } from '@server/db';
import { parseQueryFn } from '@server/subroutines/datastore/query-parser.fn';


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

// Controller handles HTTP related eg. routing, request validation
import { resolveLang } from '@server/mw/mw.lang';
import { toErrorResponse } from '@server/server-helper';
import { type BunRequest, type Serve, type Server } from "bun";
import { resolveSession } from '../mw/mw.auth-guard';

export const apiDatastoreIdTableName: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/datastore/:id/table/:tableName'>, Server<undefined>, Response>>> = {
  GET: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const query = new URLSearchParams(req.url.split('?')[1])

    // Convert URLSearchParams to Record<string, string | string[]>
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

    const filters = parseQueryFn(queryRecord);

    // Parse and validate limit (default: 50, max: 1000) - Changed from 'pageSize' to 'limit'
    const limit = query.get('limit')
      ? Math.min(Math.max(Number(query.get('limit')), 1), 1000)
      : 50;


    // Call controller
    const [result, error] = await getTableDataController(
      { session: session.session, db: kysely },
      {
        datastoreId: req.params.id,
        tableName: req.params.tableName,
        filters: filters.filters,
        sort: filters.order,
        pageSize: limit, // Controller still expects 'pageSize' internally
        offset: filters.offset ?? 0,
        columns: filters.select,
      }
    );

    if (error) return toErrorResponse({req, user: session.user, session: session.session, lang, error })

    const response = new Response(JSON.stringify(result), {
      headers: {
        'Content-Range': buildContentRangeHeader(filters.offset ?? 0, filters.offset ?? 0 + result.data.length - 1, result.data.length)
      }
    })

    return response;
  },

  POST: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json();
    const isArray = Array.isArray(body);

    const [result, error] = await insertTableRowsController(
      { session: session.session, db: kysely },
      {
        datastoreId: req.params.id,
        tableName: req.params.tableName,
        row: isArray ? undefined : body,
        rows: isArray ? body : undefined,
      }
    );

    if (error) return toErrorResponse({req, user: session.user, session: session.session, lang, error })

    const response = new Response(JSON.stringify(result), {
      headers: {
        'Content-Range': buildContentRangeHeader(null, result.inserted)
      }
    })

    return response;
  },

  PATCH: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const query = new URLSearchParams(req.url.split('?')[1])

    // Convert URLSearchParams to Record<string, string | string[]>
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

    const filters = parseQueryFn(queryRecord);
    const body = await req.json();

    const [result, error] = await updateTableRowsController(
      { session: session.session, db: kysely },
      {
        datastoreId: req.params.id,
        tableName: req.params.tableName,
        set: body,
        where: filters.filters,
      }
    );

    if (error) return toErrorResponse({req, user: session.user, session: session.session, lang, error })

    const count = result.updated;
    const contentRange = count > 0
      ? buildContentRangeHeader(0, count - 1, count)
      : buildContentRangeHeader(0, 0, 0);

    const response = new Response(JSON.stringify(result), {
      headers: {
        'Content-Range': contentRange
      }
    })

    return response;
  },

  DELETE: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json();

    // Validate body has rowids array
    if (!body.rowids || !Array.isArray(body.rowids) || body.rowids.length === 0) {
      return Response.json({ error: 'rowids array is required and must contain at least one ROWID' }, { status: 400 })
    }

    const [result, error] = await deleteTableRowsController(
      { session: session.session, db: kysely },
      {
        datastoreId: req.params.id,
        tableName: req.params.tableName,
        rowids: body.rowids,
      }
    );

    if (error) return toErrorResponse({req, user: session.user, session: session.session, lang, error })

    const count = result.deleted;
    const contentRange = count > 0
      ? buildContentRangeHeader(0, count - 1, count)
      : buildContentRangeHeader(0, 0, 0);

    const response = new Response(JSON.stringify(result), {
      headers: {
        'Content-Range': contentRange
      }
    })

    return response;
  }
}