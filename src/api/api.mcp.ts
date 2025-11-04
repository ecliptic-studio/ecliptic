// Controller handles HTTP related eg. routing, request validation
import { createMcpKeyController } from '@server/controllers/ctrl.mcp.create-key';
import { deleteMcpKeyController } from '@server/controllers/ctrl.mcp.delete-key';
import { listMcpKeysController } from '@server/controllers/ctrl.mcp.list';
import { updateMcpKeyController } from '@server/controllers/ctrl.mcp.update-key';
import { kysely } from '@server/db';
import { mwAuthGuard } from '@server/mw/mw.auth-guard';
import { jsonError } from '@server/server-helper';
import { Elysia, status, t } from 'elysia';

export const apiMcp = new Elysia({ prefix: '/api/v1/mcp-keys', name: 'apiMcp' })
	.use(mwAuthGuard)
	.get(
		'',
		async (ctx) => {
			
			const [result, error] = await listMcpKeysController({
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
				summary: 'Get all MCP API keys',
				description: 'Retrieve all MCP API keys for the authenticated user\'s active organization',
				tags: ['MCP']
			}
		}
	)
	.post(
		'',
		async (ctx) => {
			const [result, error] = await createMcpKeyController({
				user: ctx.user,
				session: ctx.session,
				db: kysely
			}, ctx.body)

			if (error) {
				return status(error.statusCode, jsonError(ctx, error))
			}
			return result;
		}, {
			auth: true,
			body: t.Object({
				name: t.String({ minLength: 1 }),
				permissions: t.Array(t.Object({ actionId: t.String(), targetId: t.String() }))
			}),
			detail: {
				summary: 'Create a new MCP API key',
				description: 'Generate a new MCP API key with specified permissions',
				tags: ['MCP']
			}
		}
	)
	.delete(
		'/:id',
		async (ctx) => {
			const [result, error] = await deleteMcpKeyController({
				session: ctx.session,
				db: kysely
			}, { id: ctx.params.id })

			ctx.set.headers['accept'] = 'application/json';
			if (error) {
				return status(error.statusCode, jsonError(ctx, error))
			}

			return result;
		}, {
			auth: true,
			params: t.Object({
				id: t.String({ minLength: 1 })
			}),
			detail: {
				summary: 'Delete an MCP API key',
				description: 'Delete an MCP API key by ID. The key must belong to the authenticated user\'s organization.',
				tags: ['MCP']
			}
		}
	)
	.patch(
		'/:id',
		async (ctx) => {
			const [result, error] = await updateMcpKeyController({
				session: ctx.session,
				db: kysely
			}, {
				id: ctx.params.id,
				name: ctx.body.name,
				permissions: ctx.body.permissions
			})

			ctx.set.headers['accept'] = 'application/json';
			if (error) {
				return status(error.statusCode, jsonError(ctx, error))
			}

			return result;
		}, {
			auth: true,
			params: t.Object({
				id: t.String({ minLength: 1 })
			}),
			body: t.Object({
				name: t.Optional(t.String({ minLength: 1 })),
				permissions: t.Array(t.Object({ actionId: t.String(), targetId: t.String() }))
			}),
			detail: {
				summary: 'Update an MCP API key',
				description: 'Update an MCP API key\'s name and/or permissions. When permissions are provided, all existing permission mappings will be replaced with the new ones. The key must belong to the authenticated user\'s organization.',
				tags: ['MCP']
			}
		}
	)