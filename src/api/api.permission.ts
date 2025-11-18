// Controller handles HTTP related eg. routing, request validation
import { listPermissionMetadataController } from '@server/controllers/ctrl.permission.list-metadata';
import { kysely } from '@server/db';
import { resolveAuth } from '@server/mw/mw.auth';
import { resolveLang } from '@server/mw/mw.lang';
import { toErrorResponse } from '@server/server-helper';
import { type BunRequest, type Serve, type Server } from "bun";

export const apiPermission: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/permission/targets-and-actions'>, Server<undefined>, Response>>> = {
	GET: async (req, server) => {
		const auth = await resolveAuth(req.headers);
		if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
		const lang = resolveLang(req.headers);
		
		const [result, error] = await listPermissionMetadataController({
			session: auth.session,
			db: kysely
		});

		if (error) {
			return toErrorResponse({req, auth, lang, error})
		}

		return Response.json(result);
	}
};