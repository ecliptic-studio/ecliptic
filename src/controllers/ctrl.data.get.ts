import { toTDatastore, type TDatastore } from "@dto/TDatastore";
import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";

export type DataControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

export type TDataResponse = {
  datastores: TDatastore[];
};

/**
 * Controller for getting all data slices (currently only datastores)
 * for the user's active organization
 */
export async function getDataController(
  ctx: DataControllerContext
): Promise<TErrTuple<TDataResponse>> {
  try {
    // Get all datastores for the user's active organization
    const datastores = await ctx.db
      .selectFrom('datastore')
      .selectAll()
      .where('organization_id', '=', ctx.session.activeOrganizationId!)
      .execute();

    // Transform to DTOs
    const datastoreDtos = datastores.map(toTDatastore);

    return [{ datastores: datastoreDtos }, null];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_DATA_GET_FAILED)
      .internal(msg)
      .external({ en: 'Failed to retrieve data', fallback: 'Failed to retrieve data' })
      .shouldLog(true)
      .statusCode('Internal Server Error')
      .buildEntry();
    return [null, err];
  }
}
