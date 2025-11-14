import { deleteMcpKeyController } from '@server/controllers/ctrl.mcp.delete-key';
import { updateMcpKeyController } from '@server/controllers/ctrl.mcp.update-key';
import { kysely } from '@server/db';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { resolveLang } from '@server/mw/mw.lang';
import { toErrorResponse } from '@server/server-helper';
import type { BunRequest, Serve, Server } from 'bun';
import { apiTypes } from './api-types';

export const apiMcpKeysId: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/mcp-keys/:id'>, Server<undefined>, Response>>> = {
	DELETE: async (req, server) => {
		const session = await resolveSession(req.headers);
		if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
		const lang = resolveLang(req.headers);

		const [result, error] = await deleteMcpKeyController({
			session: session.session,
			db: kysely
		}, { id: req.params.id });

		if (error) {
			return toErrorResponse({req, user: session.user, session: session.session, lang, error})
		}

		return Response.json(result);
	},
	PATCH: async (req, server) => {
		const session = await resolveSession(req.headers);
		if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
		const lang = resolveLang(req.headers);

		const body = await req.json();
		const validatedBody = apiTypes['/api/v1/mcp-keys/:id'].PATCH.body.safeParse(body);

		if (!validatedBody.success) return Response.json({ error: validatedBody.error.message }, { status: 400 });

		const [result, error] = await updateMcpKeyController({
			session: session.session,
			db: kysely
		}, { id: req.params.id, name: validatedBody.data.name, permissions: validatedBody.data.permissions });

		if (error) return toErrorResponse({req, user: session.user, session: session.session, lang, error})

		return Response.json(result);
	},
}