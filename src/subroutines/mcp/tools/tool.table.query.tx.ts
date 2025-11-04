import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { schemaChangeDatastoreController } from "@server/controllers/ctrl.datastore.schema-change";
import type { TKysely } from "@server/db";
import type { TErrTuple } from "@server/error/error-code.types";
import { openDatastoreConnectionTx } from "@server/subroutines/datastore/open-connection.tx";
import { checkSqlFn } from "@server/subroutines/permission/check-sql.fn";
import { parsePermissions } from "@subroutines/permission/parse-datastore-permissions.fn";
import { Database } from "bun:sqlite";
import { z } from "zod";
import { paginateQueryFn } from "../paginate-query";

type TPortal = {
  server: McpServer,
  db: TKysely
}

type TArgs = {
  activeOrganizationId: string;
  mcpKeyId: string;
}

export function toolTableQueryTx(portal: TPortal, args: TArgs): TErrTuple<RegisteredTool> {

  const tool = portal.server.registerTool('table.query', {
    title: "Query Table",
    description: "Query a Table by Datastore - SQL Database using sqlite3 syntax. Offset and Limit only support for SELECT queries.",
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
      readOnlyHint: true,
    },
    inputSchema: { datastoreName: z.string().min(1), query: z.string().min(1), limit: z.number().optional(), offset: z.number().optional() },
    // outputSchema: {
    //   data: z.array(z.record(z.string(), z.any()))
    // }

  }, async ({ datastoreName, query, limit, offset }) => {

    const datastore = await portal.db.selectFrom('datastore')
      .where('organization_id', '=', args.activeOrganizationId)
      .where('internal_name', '=', datastoreName)
      .selectAll()
      .executeTakeFirst();

    if (!datastore) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Datastore ${datastoreName} not found`
        }],
      }
    }

    // Fetch all permissions for this MCP key
    const rawPermissions = await portal.db.selectFrom('permission_mapping')
      .where('mcpkey_id', '=', args.mcpKeyId)
      .where((eb) => eb.or([
        eb('permission_target_id', 'like', `datastore:${datastore.id}.table:%`),
        eb('permission_target_id', 'like', 'datastore:*.table:%')
      ]))
      .select(['permission_target_id', 'permission_action_id'])
      .execute();

    // Parse permissions into structured format
    const parsedPermissions = parsePermissions(rawPermissions);

    const results = checkSqlFn(query, parsedPermissions, datastore.id);

    // Check if all statements are allowed
    if(!results.every(r => r.allowed)) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: 'Permission denied'
        }],
      }
    }

    // Check if any of the statements are DDL operations
    const ddlResults = results.filter(r => r.isDdl);
    if(ddlResults.length > 0) {
      // Process all DDL operations
      for(const ddlResult of ddlResults) {
        if(!ddlResult.isDdl) continue;

        const [, errorCtrl] = await schemaChangeDatastoreController(
          { db: portal.db, session: {activeOrganizationId: args.activeOrganizationId}},
          { id: datastore.id, change: ddlResult.operation }
        )
        if(errorCtrl) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: 'Failed to change datastore schema'
            }],
          }
        }
      }

      return {
        content: [{
          type: 'text',
          text: `Schema change successful`
        }],
      }
    }

    const [database, error, rollback] = openDatastoreConnectionTx({ Database }, { fileName: datastore.external_id, readOnly: false })
    if(error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: 'Failed to open database connection'
        }],
      }
    }

    try {
      const paginatedQueries = paginateQueryFn(query, limit, offset);
      const response: any[] = [];
      for(const paginatedQuery of paginatedQueries) {
        const result = database.prepare(paginatedQuery).all();
        response.push(result);
      }
      return {
        content: [],
        structuredContent: {result: response, limit: limit ?? 10, offset: offset ?? 0}
      }
    } finally {
      database.close();
    }


  })

  return [tool, null]
}