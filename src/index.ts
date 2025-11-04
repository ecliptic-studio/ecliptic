import { fromTypes, openapi } from '@elysiajs/openapi'
import { staticPlugin } from '@elysiajs/static'
import indexHTML from '@public/index.html'
import { Elysia } from 'elysia'
import { apiData } from './api/api.data'
import { apiDatastore } from './api/api.datastore'
import { apiDatastoreTable } from './api/api.datastore.table'
import { apiMcp } from './api/api.mcp'
import { apiPermission } from './api/api.permission'
import { apiMcpServer } from './api/mcp'
import { auth } from './auth'

export const app = new Elysia()
	.onError(({ error, code }) => {
		if (code === 'VALIDATION') return error.detail(error.message)
	})
	.use(
		openapi({
			references: fromTypes(),
		})
	)
	.get("/api/v1/auth/:some", r => auth.handler(r.request))
	.get("/api/v1/auth/:some/:other", r => auth.handler(r.request))
	.post("/api/v1/auth/:some/:other", r => auth.handler(r.request))
	.post("/api/v1/auth/:some", r => auth.handler(r.request))
	.use(apiMcpServer)
	.use(apiData)
	.use(apiDatastoreTable)
	.use(apiDatastore)
	.use(apiMcp)
	.use(apiPermission)

	.use(
		await staticPlugin({
			prefix: '/',
			indexHTML: true,
			extension: false
		})
	)
	.get('/signup', indexHTML)
	.get('/signin', indexHTML)
	.get('/datastore', indexHTML)
	.get('/datastore/*', indexHTML)
	.get('/mcp-settings', indexHTML)
	.get('/mcp-settings/*', indexHTML)
	.listen(3000)

export type App = typeof app

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
