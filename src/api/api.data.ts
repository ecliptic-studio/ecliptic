// Controller handles HTTP related eg. routing, request validation
import { getDataController } from '@server/controllers/ctrl.data.get'
import { kysely } from '@server/db'
import { jsonError } from '@server/server-helper'
import { Elysia, status } from 'elysia'
import { mwAuthGuard } from '../mw/mw.auth-guard'

export const apiData = new Elysia({ prefix: '/api/v1/data', name: 'apiData' })
	.use(mwAuthGuard)
	.get(
		'',
		async (ctx) => {
			const [result, error] = await getDataController({
				session: ctx.session,
				db: kysely
			})

			if (error) {
				return status(error.statusCode, jsonError(ctx, error))
			}

			return result
		}, {
			auth: true,
			detail: {
				summary: 'Get all data slices',
				description: 'Returns all data slices for the user\'s active organization. Currently returns datastores only.',
				tags: ['Data']
			}
		}
	)