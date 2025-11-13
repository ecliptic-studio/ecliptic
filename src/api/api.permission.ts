// Controller handles HTTP related eg. routing, request validation
import { listPermissionMetadataController } from '@server/controllers/ctrl.permission.list-metadata';
import { kysely } from '@server/db';
import { tExternal } from '@server/error/t-error';
import { resolveSession } from '@server/mw/mw.auth-guard';
import { type BunRequest, type Serve, type Server } from "bun";

export const apiPermission: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/permission/targets-and-actions'>, Server<undefined>, Response>>> = {
	GET: async (req, server) => {
		const session = await resolveSession(req.headers);
		if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

		const [result, error] = await listPermissionMetadataController({
			session: session.session,
			db: kysely
		});

		if (error) {
			return Response.json({ error: tExternal('en', error) }, { status: error.statusCode || 400 });
		}

		return Response.json(result);
	}
};