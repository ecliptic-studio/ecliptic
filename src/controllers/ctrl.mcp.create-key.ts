import type { TMcpKey } from "@dto/TMcp";
import type { TSession } from "@dto/TSession";
import type { TUser } from "@dto/TUser";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { nanoid } from "nanoid";
import { listMcpKeysController } from "./ctrl.mcp.list";

export type McpKeysControllerContext = {
  user: Pick<TUser, 'id'>;
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export async function createMcpKeyController(
  ctx: McpKeysControllerContext,
  args: { name: string, permissions: { actionId: string, targetId: string }[] }
): Promise<TErrTuple<TMcpKey>> {
  try {
    const mcpKeyId = await ctx.db.transaction().execute(async (tx) => {
      const mcp = await tx.insertInto('mcpkey')
        .values({
          id: nanoid(),
          organization_id: ctx.session.activeOrganizationId!,
          user_id: ctx.user.id,
          internal_name: args.name,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await tx.insertInto('permission_mapping')
        .values(args.permissions.map(permission => ({
          mcpkey_id: mcp.id,
          permission_action_id: permission.actionId,
          permission_target_id: permission.targetId,
          permission_target_org_id: ctx.session.activeOrganizationId,
        })))
        .returningAll()
        .execute();

      return mcp.id;
    })

    const [mcpKeys, error] = await listMcpKeysController(ctx);
    if (error) {
      return [null, error];
    }

    const mcpKey = mcpKeys.find(key => key.id === mcpKeyId);

    if (!mcpKey) {
      return [null, createError(ErrorCode.CONTROLLER_MCP_KEY_CREATE_FAILED)
        .internal('MCP key not found after creation')
        .external({ en: 'Failed to create MCP key', de: 'Fehler beim Erstellen des MCP-Schlüssels' })
        .shouldLog(true)
        .statusCode(500)
        .buildEntry()];
    }

    return [mcpKey, null];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_MCP_KEY_CREATE_FAILED)
      .internal(msg)
      .external({ en: 'Failed to create MCP key', de: 'Fehler beim Erstellen des MCP-Schlüssels' })
      .shouldLog(true)
      .statusCode(500)
      .buildEntry();
    return [null, err];
  }
}
