import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TKysely } from "@server/db";
import { toTDatastore } from "@server/dto/TDatastore";
import type { TErrTuple } from "@server/error/error-code.types";
import { z } from "zod";
import { parsePermissions } from "@subroutines/permission/parse-datastore-permissions.fn";
import { filterSchemaByPermissions } from "@subroutines/permission/filter-schema-by-permissions.fn";

type TPortal = {
  server: McpServer,
  db: TKysely
}

type TArgs = {
  activeOrganizationId: string;
  mcpKeyId: string;
}

export function toolTableListFx(portal: TPortal, args: TArgs): TErrTuple<RegisteredTool> {

  const tool = portal.server.registerTool('table.list', {
    title: "List Tables",
    description: "List all Tables by Datastore - SQL Database",
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
      readOnlyHint: true,
    },
    inputSchema: { datastoreName: z.string().min(1) },
    outputSchema: {
      tables: z.record(
        z.string(),
        z.object({
          columns: z.record(
            z.string(),
            z.object({
              name: z.string(),
              order: z.number(),
              db_type: z.string()
            })
          )
        }))
    }

  }, async ({ datastoreName }) => {

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

    const { schema_json } = toTDatastore(datastore)

    // Fetch all permissions for this MCP key
    const rawPermissions = await portal.db.selectFrom('permission_mapping')
      .where('mcpkey_id', '=', args.mcpKeyId)
      .where((eb) => eb.or([
        eb('permission_target_id', 'like', `datastore:${datastore.id}.table:%`),
        eb('permission_target_id', 'like', 'datastore:*.table:%')
      ]))
      .where((eb) => eb.or([
        eb('permission_action_id', '=', 'datastore.table.list'),
        eb('permission_action_id', '=', 'datastore.table.column.select'),
      ]))
      .select(['permission_target_id', 'permission_action_id'])
      .execute();

    // Parse permissions into structured format
    const parsedPermissions = parsePermissions(rawPermissions);

    // Filter schema based on permissions
    const filteredSchema = filterSchemaByPermissions(
      schema_json,
      parsedPermissions,
      datastore.id
    );

    return {
      content: [],
      structuredContent: filteredSchema
    }

  })

  return [tool, null]
}