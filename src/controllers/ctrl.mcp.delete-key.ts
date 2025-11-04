import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";

export type McpKeyDeleteControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export async function deleteMcpKeyController(
  ctx: McpKeyDeleteControllerContext,
  args: { id: string }
): Promise<TErrTuple<{ deleted: true }>> {
  try {
    // First, verify the MCP key exists and belongs to the user's organization
    const mcpKey = await ctx.db
      .selectFrom('mcpkey')
      .where('id', '=', args.id)
      .where('organization_id', '=', ctx.session.activeOrganizationId!)
      .selectAll()
      .executeTakeFirst();

    if (!mcpKey) {
      return [
        null,
        createError(ErrorCode.CONTROLLER_MCP_KEY_DELETE_NOT_FOUND)
          .internal(`MCP key ${args.id} not found`)
          .external({ en: 'MCP key not found', de: 'MCP-Schlüssel nicht gefunden' })
          .statusCode('Not Found')
          .buildEntry()
      ];
    }

    // Delete the MCP key and its associated permission mappings in a transaction
    await ctx.db
      .deleteFrom('mcpkey')
      .where('id', '=', args.id)
      .where('organization_id', '=', ctx.session.activeOrganizationId!)
      .execute();

    return [{ deleted: true }, null];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_MCP_KEY_DELETE_FAILED)
      .internal(msg)
      .external({ en: 'Failed to delete MCP key', de: 'Fehler beim Löschen des MCP-Schlüssels' })
      .shouldLog(true)
      .statusCode('Internal Server Error')
      .buildEntry();
    return [null, err];
  }
}
