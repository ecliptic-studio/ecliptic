import indexHTML from '@public/index.html'
import { apiData } from './api/api.data'
import { apiDatastoreId } from './api/api.datastore.:id'
import { apiDatastoreIdSchema } from './api/api.datastore.:id.schema'
import { apiDatastoreIdTableName } from './api/api.datastore.:id.table.:tableName'
import { apiMcp } from './api/api.mcp'
import { apiMcpKeys } from './api/api.mcp-keys'
import { apiMcpKeysId } from './api/api.mcp-keys.:id'
import { apiPermission } from './api/api.permission'
import { auth } from './auth'

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
		"/api/v1/mcp-keys": apiMcpKeys,
		"/api/v1/mcp-keys/:id": apiMcpKeysId,
		"/api/v1/permission/targets-and-actions": apiPermission,
		"/mcp": apiMcp,
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