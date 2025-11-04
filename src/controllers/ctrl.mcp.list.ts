import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import type { TMcpKey } from "@server/dto/TMcp";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { sql } from "kysely";

export type McpKeysControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export async function listMcpKeysController(
  ctx: McpKeysControllerContext
): Promise<TErrTuple<TMcpKey[]>> {
  try {
    const result = await ctx.db
      .selectFrom('mcpkey as mk')
      .leftJoin('permission_mapping as pm', 'pm.mcpkey_id', 'mk.id')
      .leftJoin('permission_action as pa', 'pa.id', 'pm.permission_action_id')
      .leftJoin('permission_target as pt', 'pt.id', 'pm.permission_target_id')
      .leftJoin('permission_type as pty', 'pty.id', 'pt.permission_type_id')
      .select([
        'mk.id',
        'mk.internal_name',
        sql<string>`json_group_array(
          json_object(
            'action_id', pa.id,
            'action_i18n_title', pa.i18n_title,
            'action_i18n_description', pa.i18n_description,
            'target_id', pt.id,
            'target_internal_name', pt.internal_name,
            'target_datastore_id', pt.datastore_id,
            'type_id', pty.id,
            'type_i18n_title', pty.i18n_title,
            'type_i18n_description', pty.i18n_description
          )
        )`.as('permissions_json')
      ])
      .where('mk.organization_id', '=', ctx.session.activeOrganizationId!)
      .groupBy(['mk.id', 'mk.internal_name'])
      .execute();

    // Transform to TMcpKey structure
    const mcpKeys: TMcpKey[] = result.map(row => {
      const permissionsData = JSON.parse(row.permissions_json);

      return {
        id: row.id,
        internal_name: row.internal_name,
        permissions: permissionsData
          .filter((p: any) => p.action_id !== null)
          .map((p: any) => ({
            action: {
              id: p.action_id,
              i18n_title: p.action_i18n_title,
              i18n_description: p.action_i18n_description,
            },
            target: {
              id: p.target_id,
              internal_name: p.target_internal_name,
              datastore_id: p.target_datastore_id,
              permission_type: {
                id: p.type_id,
                i18n_title: p.type_i18n_title,
                i18n_description: p.type_i18n_description,
              },
            },
          })),
      };
    });

    return [mcpKeys, null];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_MCP_KEYS_LIST_FAILED)
      .internal(msg)
      .external({ en: 'Failed to list MCP keys', de: 'Fehler beim Auflisten der MCP-Schlüssel' })
      .shouldLog(true)
      .statusCode('Internal Server Error')
      .buildEntry();
    return [null, err];
  }
}
