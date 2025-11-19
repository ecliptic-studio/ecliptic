// Controller handles HTTP related eg. routing, request validation
import { listMailboxEmailsController } from '@server/controllers/ctrl.mailbox.list.emails'
import { kysely } from '@server/db'
import { resolveAuth } from '@server/mw/mw.auth'
import { resolveLang } from '@server/mw/mw.lang'
import { toErrorResponse } from '@server/server-helper'
import { type BunRequest, type Serve, type Server } from "bun"

export const apiMailboxEmail: Partial<Record<Serve.HTTPMethod, Serve.Handler<BunRequest<'/api/v1/mailbox/:email'>, Server<undefined>, Response>>> = {
  GET: async (req, server) => {
		const auth = await resolveAuth(req.headers)
		const lang = resolveLang(req.headers)
		if (!auth) return Response.json({error: 'Unauthorized'}, {status: 401})

		const [result, error] = await listMailboxEmailsController({
			session: auth.session,	
			db: kysely
		}, { mailboxEmail: req.params.email })

		if (error)
			return toErrorResponse({req, auth, lang, error})

		return Response.json(result)
	}
}
