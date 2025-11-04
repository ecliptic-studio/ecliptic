import type { TMcpKey } from "@dto/TMcp";
import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { listMcpKeysController } from "./ctrl.mcp.list";

export type McpKeyUpdateControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export type UpdateMcpKeyArgs = {
  id: string;
  name?: string;
  permissions: { actionId: string; targetId: string }[];
};

export async function updateMcpKeyController(
  ctx: McpKeyUpdateControllerContext,
  args: UpdateMcpKeyArgs
): Promise<TErrTuple<TMcpKey>> {
  try {
    // First, verify the MCP key exists and belongs to the user's organization
    const existingKey = await ctx.db
      .selectFrom('mcpkey')
      .where('id', '=', args.id)
      .where('organization_id', '=', ctx.session.activeOrganizationId!)
      .selectAll()
      .executeTakeFirst();

    if (!existingKey) {
      return [
        null,
        createError(ErrorCode.CONTROLLER_MCP_KEY_UPDATE_NOT_FOUND)
          .internal(`MCP key ${args.id} not found`)
          .external({ en: 'MCP key not found', de: 'MCP-Schlüssel nicht gefunden' })
          .statusCode('Not Found')
          .buildEntry()
      ];
    }

    // Update the MCP key and its permissions in a transaction
    await ctx.db.transaction().execute(async (tx) => {
      // Update the name if provided
      if (args.name !== undefined) {
        await tx
          .updateTable('mcpkey')
          .set({ internal_name: args.name })
          .where('id', '=', args.id)
          .execute();
      }

      // If permissions are provided, replace all existing mappings
      // Delete all existing permission mappings
      await tx
        .deleteFrom('permission_mapping')
        .where('mcpkey_id', '=', args.id)
        .execute();

      // Insert new permission mappings (if any)
      if (args.permissions.length > 0) {
        await tx
          .insertInto('permission_mapping')
          .values(
            args.permissions.map((permission) => ({
              mcpkey_id: args.id,
              permission_action_id: permission.actionId,
              permission_target_id: permission.targetId,
              permission_target_org_id: ctx.session.activeOrganizationId,
            }))
          )
          .execute();
      }
    });

    // Fetch and return the updated MCP key with its new permissions
    const [mcpKeys, error] = await listMcpKeysController(ctx);
    if (error) {
      return [null, error];
    }

    const updatedKey = mcpKeys.find((key) => key.id === args.id);

    if (!updatedKey) {
      return [
        null,
        createError(ErrorCode.CONTROLLER_MCP_KEY_UPDATE_FAILED)
          .internal('MCP key not found after update')
          .external({ en: 'Failed to update MCP key', de: 'Fehler beim Aktualisieren des MCP-Schlüssels' })
          .shouldLog(true)
          .statusCode('Internal Server Error')
          .buildEntry()
      ];
    }

    return [updatedKey, null];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_MCP_KEY_UPDATE_FAILED)
      .internal(msg)
      .external({ en: 'Failed to update MCP key', de: 'Fehler beim Aktualisieren des MCP-Schlüssels' })
      .shouldLog(true)
      .statusCode('Internal Server Error')
      .buildEntry();
    return [null, err];
  }
}
