// Controller handles HTTP related eg. routing, request validation
import { dropDatastoreController } from '@server/controllers/ctrl.datastore.drop';
import { renameDatastoreController } from '@server/controllers/ctrl.datastore.rename';
import { kysely } from '@server/db';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { resolveLang } from '@server/mw/mw.lang';
import { toErrorResponse } from '@server/server-helper';
import type { BunRequest, Serve, Server } from 'bun';
import { apiTypes } from './api-types';

export const apiDatastoreId: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/datastore/:id'>, Server<undefined>, Response>>> = {
  PATCH: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({error: 'Unauthorized'}, {status: 401})

    const body = await req.json();
    const validatedBody = apiTypes['/api/v1/datastore/:id'].PATCH.body.safeParse(body);

    if (!validatedBody.success) return Response.json({error: validatedBody.error.message}, {status: 400})

    const [result, error] = await renameDatastoreController({ session: session.session, db: kysely }, { id: req.params.id, internalName: validatedBody.data.internalName });

    if (error) return toErrorResponse({req, user: session.user, session: session.session, lang, error})

    return Response.json(result, {status: 201})
  },
  DELETE: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({error: 'Unauthorized'}, {status: 401})

    const [result, error] = await dropDatastoreController({ session: session.session, db: kysely }, { id: req.params.id });

    if (error) return toErrorResponse({req, user: session.user, session: session.session, lang, error})

    return Response.json(result, {status: 200})
  }
}
