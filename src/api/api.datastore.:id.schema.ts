// Controller handles HTTP related eg. routing, request validation
import { schemaChangeDatastoreController } from '@server/controllers/ctrl.datastore.schema-change';
import { kysely } from '@server/db';
import { tExternal } from '@server/error/t-error';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { resolveLang } from '@server/mw/mw.lang';
import type { BunRequest, Serve, Server } from 'bun';
import { z } from 'zod';

export const apiDatastoreIdSchema: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/datastore/:id/schema'>, Server<undefined>, Response>>> = {
  PATCH: async (req, server) => {
    const session = await resolveSession(req.headers)
    const lang = resolveLang(req.headers)
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json();
    const validatedBody = z.union([
      z.object({
        type: z.literal('add-column'),
        table: z.string().min(1),
        column: z.string().min(1),
        db_type: z.union([
          z.literal('TEXT'),
          z.literal('INTEGER'),
          z.literal('REAL'),
          z.literal('BLOB')
        ]),
        foreign_key: z.optional(z.object({
          table: z.string().min(1),
          column: z.string().min(1)
        }))
      }),
      z.object({
        type: z.literal('drop-column'),
        table: z.string().min(1),
        column: z.string().min(1)
      }),
      z.object({
        type: z.literal('rename-column'),
        table: z.string().min(1),
        column: z.string().min(1),
        new_name: z.string().min(1)
      }),
      z.object({
        type: z.literal('rename-table'),
        table: z.string().min(1),
        new_name: z.string().min(1)
      }),
      z.object({
        type: z.literal('add-table'),
        table: z.string().min(1)
      }),
      z.object({
        type: z.literal('drop-table'),
        table: z.string().min(1)
      })
    ]).safeParse(body);

    if (!validatedBody.success) return Response.json({ error: validatedBody.error.message }, { status: 400 })

    const [result, error] = await schemaChangeDatastoreController(
      { session: session.session, db: kysely },
      { id: req.params.id, change: validatedBody.data }
    );

    if (error) return Response.json({ error: tExternal(lang, error) }, { status: 400 })

    return Response.json(result, { status: 201 })
  }
}
