// Controller handles HTTP related eg. routing, request validation
import { listPermissionMetadataController } from '@server/controllers/ctrl.permission.list-metadata';
import { kysely } from '@server/db';
import { mwAuthGuard } from '@server/mw/mw.auth-guard';
import { jsonError } from '@server/server-helper';
import { Elysia, status } from 'elysia';

export const apiPermission = new Elysia({ prefix: '/api/v1/permission', name: 'apiPermission' })
	.use(mwAuthGuard)
	.get(
		'/targets-and-actions',
		async (ctx) => {
			
			const [result, error] = await listPermissionMetadataController({
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
				summary: 'Get all permission targets and actions',
				description: 'Retrieve all permissions for the authenticated user\'s active organization',
				tags: ['Permission']
			}
		}
	)