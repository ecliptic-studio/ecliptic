// Controller handles HTTP related eg. routing, request validation
import { dropDatastoreController } from '@server/controllers/ctrl.datastore.drop';
import { renameDatastoreController } from '@server/controllers/ctrl.datastore.rename';
import { kysely } from '@server/db';
import { tExternal } from '@server/error/t-error';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { resolveLang } from '@server/mw/mw.lang';
import type { BunRequest, Serve, Server } from 'bun';
import { z } from 'zod';

export const apiDatastoreId: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/datastore/:id'>, Server<undefined>, Response>>> = {
  PATCH: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({error: 'Unauthorized'}, {status: 401})

    const body = await req.json();
    const validatedBody = z.object({
      internalName: z.string().min(1).max(255),
    }).safeParse(body);

    if (!validatedBody.success) return Response.json({error: validatedBody.error.message}, {status: 400})

    const [result, error] = await renameDatastoreController({ session: session.session, db: kysely }, { id: req.params.id, internalName: validatedBody.data.internalName });

    if (error) return Response.json({error: tExternal(lang, error)}, {status: 400})

    return Response.json(result, {status: 201})
  },
  DELETE: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({error: 'Unauthorized'}, {status: 401})

    const [result, error] = await dropDatastoreController({ session: session.session, db: kysely }, { id: req.params.id });

    if (error) return Response.json({error: tExternal(lang, error)}, {status: 400})

    return Response.json(result, {status: 200})
  }
}
