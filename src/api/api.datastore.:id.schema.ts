// Controller handles HTTP related eg. routing, request validation
import { schemaChangeDatastoreController } from '@server/controllers/ctrl.datastore.schema-change';
import { kysely } from '@server/db';
import { resolveAuth } from '@server/mw/mw.auth';
import { resolveLang } from '@server/mw/mw.lang';
import { toErrorResponse } from '@server/server-helper';
import type { BunRequest, Serve, Server } from 'bun';
import { apiTypes } from './api-types';

export const apiDatastoreIdSchema: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/datastore/:id/schema'>, Server<undefined>, Response>>> = {
  PATCH: async (req, server) => {
    const auth = await resolveAuth(req.headers)
    const lang = resolveLang(req.headers)
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json();
    const validatedBody = apiTypes['/api/v1/datastore/:id/schema'].PATCH.body.safeParse(body);

    if (!validatedBody.success) return Response.json({ error: validatedBody.error.message }, { status: 400 })

    const [result, error] = await schemaChangeDatastoreController(
      { session: auth.session, db: kysely },
      { id: req.params.id, change: validatedBody.data }
    );

    if (error) return toErrorResponse({req, auth, lang, error})

    return Response.json(result, { status: 201 })
  }
}
