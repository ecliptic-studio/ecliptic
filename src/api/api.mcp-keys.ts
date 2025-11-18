// Controller handles HTTP related eg. routing, request validation
import { createMcpKeyController } from '@server/controllers/ctrl.mcp.create-key';
import { listMcpKeysController } from '@server/controllers/ctrl.mcp.list';
import { kysely } from '@server/db';
import { resolveAuth } from '@server/mw/mw.auth';
import { resolveLang } from '@server/mw/mw.lang';
import { toErrorResponse } from '@server/server-helper';
import type { BunRequest, Serve, Server } from 'bun';
import { apiTypes } from './api-types';

export const apiMcpKeys: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/mcp-keys'>, Server<undefined>, Response>>> = {
	GET: async (req, server) => {
		const auth = await resolveAuth(req.headers);
		if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
		const lang = resolveLang(req.headers);

		const [result, error] = await listMcpKeysController({
			session: auth.session,
			db: kysely
		});

		if (error) {
			return toErrorResponse({req, auth, lang, error})
		}

		return Response.json(result);
	},
	POST: async (req, server) => {
		const auth = await resolveAuth(req.headers);
		if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
		const lang = resolveLang(req.headers);

		const body = await req.json();
		const validatedBody = apiTypes['/api/v1/mcp-keys'].POST.body.safeParse(body);

		if (!validatedBody.success) return Response.json({ error: validatedBody.error.message }, { status: 400 });

		const [result, error] = await createMcpKeyController({
			user: auth.user,
			session: auth.session,
			db: kysely
		}, validatedBody.data);

		if (error) return toErrorResponse({req, auth, lang, error})

		return Response.json(result);
	},
}