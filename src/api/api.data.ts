// Controller handles HTTP related eg. routing, request validation
import { getDataController } from '@server/controllers/ctrl.data.get'
import { kysely } from '@server/db'
import { resolveSession } from '@server/mw/mw.auth-guard'
import { resolveLang } from '@server/mw/mw.lang'
import { toErrorResponse } from '@server/server-helper'
import { type BunRequest, type Serve, type Server } from "bun"

export const apiData: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/data'>, Server<undefined>, Response>>> = {
  GET: async (req, server) => {
		const session = await resolveSession(req.headers)
		const lang = resolveLang(req.headers)
		if (!session) return Response.json({error: 'Unauthorized'}, {status: 401})

		const [result, error] = await getDataController({
			session: session.session,
			db: kysely
		})

		if (error)
			return toErrorResponse({req, user: session.user, session: session.session, lang, error})

		return Response.json(result)
	}
}