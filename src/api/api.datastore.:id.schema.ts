// Controller handles HTTP related eg. routing, request validation
import { schemaChangeDatastoreController } from '@server/controllers/ctrl.datastore.schema-change';
import { kysely } from '@server/db';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { resolveLang } from '@server/mw/mw.lang';
import { toErrorResponse } from '@server/server-helper';
import type { BunRequest, Serve, Server } from 'bun';
import { apiTypes } from './api-types';

export const apiDatastoreIdSchema: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/datastore/:id/schema'>, Server<undefined>, Response>>> = {
  PATCH: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json();
    const validatedBody = apiTypes['/api/v1/datastore/:id/schema'].PATCH.body.safeParse(body);

    if (!validatedBody.success) return Response.json({ error: validatedBody.error.message }, { status: 400 })

    const [result, error] = await schemaChangeDatastoreController(
      { session: session.session, db: kysely },
      { id: req.params.id, change: validatedBody.data }
    );

    if (error) return toErrorResponse({req, user: session.user, session: session.session, lang, error})

    return Response.json(result, { status: 201 })
  }
}
