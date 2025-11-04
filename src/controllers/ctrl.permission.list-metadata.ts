import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import type { PermissionAction, PermissionAllowedActionByType, PermissionTarget } from "@server/db.d";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { type Selectable } from "kysely";

export type PermissionMetadataControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export async function listPermissionMetadataController(
  ctx: PermissionMetadataControllerContext
): Promise<TErrTuple<{ actions: PermissionAction[], targets: Selectable<PermissionTarget>[], allowedActionsByType: Selectable<PermissionAllowedActionByType>[] }>> {
  try {
    const actionsPromise = ctx.db
      .selectFrom('permission_action')
      .selectAll()
      .execute();

    const targetsPromise = ctx.db
      .selectFrom('permission_target')
      .selectAll()
      .execute();

    const allowedActionsByTypePromise = ctx.db
      .selectFrom('permission_allowed_action_by_type')
      .selectAll()
      .execute();

    const [actions, targets, allowedActionsByType] = await Promise.all([actionsPromise, targetsPromise, allowedActionsByTypePromise]);


    return [{ actions, targets, allowedActionsByType }, null];
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
