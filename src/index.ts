import { fromTypes, openapi } from '@elysiajs/openapi'
import indexHTML from '@public/index.html'
import { Elysia } from 'elysia'
import { apiData } from './api/api.data'
import { apiDatastoreId } from './api/api.datastore.:id'
import { apiDatastoreIdSchema } from './api/api.datastore.:id.schema'
import { apiDatastoreIdTableName } from './api/api.datastore.:id.table.:tableName'
import { apiMcp } from './api/api.mcp'
import { apiMcpId } from './api/api.mcp.:id'
import { apiPermission } from './api/api.permission'
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
	// .use(apiMcpServer)
	// .use(apiDatastoreTable)
	// .use(apiDatastore)
	// .use(apiMcp)
	// .use(apiPermission)

	// .use(
	// 	await staticPlugin({
	// 		prefix: '/',
	// 		indexHTML: true,
	// 		extension: false
	// 	})
	// )
	// .get('/signup', indexHTML)
	// .get('/signin', indexHTML)
	// .get('/datastore', indexHTML)
	// .get('/datastore/*', indexHTML)
	// .get('/mcp-settings', indexHTML)
	// .get('/mcp-settings/*', indexHTML)
	// .listen(3000)

export type App = typeof app

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)

const server = Bun.serve({
  routes: {
		// api routes
		'/api/v1/auth/*': {
      async GET(req) {
        return auth.handler(req);
      },
      async POST(req) {
        return auth.handler(req);
      },
    }, 
		"/api/v1/data": apiData,
		"/api/v1/datastore/:id": apiDatastoreId,
		"/api/v1/datastore/:id/table/:tableName": apiDatastoreIdTableName,
		"/api/v1/datastore/:id/schema": apiDatastoreIdSchema,
		"/api/v1/mcp-keys": apiMcp,
		"/api/v1/mcp-keys/:id": apiMcpId,
		"/api/v1/permission/targets-and-actions": apiPermission,
    // Static routes
		"/favicon.ico": new Response(await Bun.file("public/favicon.ico").bytes()),

    // Wildcard route for all routes that start with "/api/" and aren't otherwise matched
    "/api/*": Response.json({ message: "Not found" }, { status: 404 }),
		"/*": indexHTML, // fallback

  },

	port: 3000,
	development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
	idleTimeout: 10, // 10 seconds

  
});

console.log(`Server running at ${server.url}`);