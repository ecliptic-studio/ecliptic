// Controller handles HTTP related eg. routing, request validation
import { createMcpKeyController } from '@server/controllers/ctrl.mcp.create-key';
import { listMcpKeysController } from '@server/controllers/ctrl.mcp.list';
import { kysely } from '@server/db';
import { tExternal } from '@server/error/t-error';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { resolveLang } from '@server/mw/mw.lang';
import type { BunRequest, Serve, Server } from 'bun';
import { apiTypes } from './api-types';

export const apiMcp: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/mcp-keys'>, Server<undefined>, Response>>> = {
	GET: async (req, server) => {
		const session = await resolveSession(req.headers);
		if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
		const lang = resolveLang(req.headers);

		const [result, error] = await listMcpKeysController({
			session: session.session,
			db: kysely
		});

		if (error) {
			return Response.json({ error: tExternal(lang, error) }, { status: error.statusCode || 400 });
		}

		return Response.json(result);
	},
	POST: async (req, server) => {
		const session = await resolveSession(req.headers);
		if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
		const lang = resolveLang(req.headers);

		const body = await req.json();
		const validatedBody = apiTypes['/api/v1/mcp-keys'].POST.body.safeParse(body);

		if (!validatedBody.success) return Response.json({ error: validatedBody.error.message }, { status: 400 });

		const [result, error] = await createMcpKeyController({
			user: session.user,
			session: session.session,
			db: kysely
		}, validatedBody.data);

		if (error) return Response.json({ error: tExternal(lang, error) }, { status: error.statusCode || 400 });

		return Response.json(result);
	},
}