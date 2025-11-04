import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TKysely } from "@server/db";
import { toTDatastore } from "@server/dto/TDatastore";
import type { TErrTuple } from "@server/error/error-code.types";
import { z } from "zod";
import { parsePermissions } from "@subroutines/permission/parse-datastore-permissions.fn";
import { filterSchemaByPermissions } from "@subroutines/permission/filter-schema-by-permissions.fn";
import { hasDatastoreAction } from "@subroutines/permission/parse-datastore-permissions.fn";

type TPortal = {
  server: McpServer,
  db: TKysely
}

type TArgs = {
  activeOrganizationId: string;
  mcpKeyId: string;
}

export function toolDatastoreListFx(portal: TPortal, args: TArgs): TErrTuple<RegisteredTool> {

  const tool = portal.server.registerTool('datastore.list', {
    title: "List Datastores",
    description: "List all Datastores - SQL Database",
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
      readOnlyHint: true,
    },
    inputSchema: {},
    outputSchema: {
      result: z.object({
        name: z.string(),
        status: z.string(),
        schema_json: z.object({
          tables: z.record(
            z.string(),
            z.object({
              columns: z.record(
                z.string(),
                z.object({
                  name: z.string(),
                  order: z.number(),
                  db_type: z.enum(['TEXT', 'INTEGER', 'REAL', 'BLOB'])
                })
              )

            }))
        })
      }).array()
    }

  }, async () => {

    // Fetch all datastores for this organization
    const datastores = await portal.db.selectFrom('datastore')
      .where('organization_id', '=', args.activeOrganizationId)
      .selectAll()
      .execute();

    // Fetch all permissions for this MCP key
    const rawPermissions = await portal.db.selectFrom('permission_mapping')
      .where('mcpkey_id', '=', args.mcpKeyId)
      .where('permission_target_org_id', '=', args.activeOrganizationId)
      .where((eb) => eb.or([
        eb('permission_action_id', '=', 'datastore.list'),
        eb('permission_action_id', '=', 'datastore.table.list'),
        eb('permission_action_id', '=', 'datastore.table.column.select'),
      ]))
      .select(['permission_target_id', 'permission_action_id'])
      .execute();

    // Parse permissions into structured format
    const parsedPermissions = parsePermissions(rawPermissions);

    // Filter datastores and their schemas based on permissions
    const filteredDatastores = datastores
      .map(toTDatastore)
      .filter(datastore => {
        // Check if user has permission to list this datastore
        return hasDatastoreAction(
          parsedPermissions,
          datastore.id,
          'datastore.list'
        );
      })
      .map(datastore => {
        // Filter the schema based on table and column permissions
        const filteredSchema = filterSchemaByPermissions(
          datastore.schema_json,
          parsedPermissions,
          datastore.id
        );

        return {
          name: datastore.internal_name,
          status: datastore.status,
          schema_json: filteredSchema
        };
      });

    return {
      content: [],
      structuredContent: { result: filteredDatastores }
    }

  })

  return [tool, null]
}