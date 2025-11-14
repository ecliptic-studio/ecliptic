import type { TSession } from "@dto/TSession";
import { executeRollbacks } from "@error/rollback";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { datastoreDropTx } from "@server/subroutines/datastore/drop-datastore.tx";

export type DropDatastoreArgs = {
  id: string;
};

export type DatastoreControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

/**
 * Controller for dropping a datastore
 */
export async function dropDatastoreController(
  ctx: DatastoreControllerContext,
  args: DropDatastoreArgs
): Promise<TErrTuple<{ deleted: boolean }>> {

  // 1. Check if datastore exists and belongs to user's organization
  const datastore = await ctx.db
    .selectFrom('datastore')
    .where('id', '=', args.id)
    .where('organization_id', '=', ctx.session.activeOrganizationId)
    .selectAll()
    .executeTakeFirst();

  if (!datastore) {
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_DELETE_NOT_FOUND)
      .internal(`Datastore ${args.id} not found`)
      .external({
        en: `Datastore not found`,
        de: `Datastore nicht gefunden`
      })
      .statusCode(404)
      .buildEntry();
    return [null, err];
  }

  // 2. Construct the file name from the datastore record
  const fileName = datastore.external_id;

  // 3. Call subroutine to delete the file
  const [result, error, rollbacks] = await datastoreDropTx(
    { Bun: Bun },
    { fileName }
  );

  if (error) {
    await executeRollbacks(rollbacks);
    return [null, error];
  }

  // 4. Delete from database
  try {
    await ctx.db
      .deleteFrom('datastore')
      .where('id', '=', args.id)
      .where('organization_id', '=', ctx.session.activeOrganizationId)
      .execute();

    return [{ deleted: true }, null];
  } catch (error) {
    // If DB deletion fails, execute rollbacks to restore file
    await executeRollbacks(rollbacks);

    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_DELETE_FAILED)
      .internal(msg)
      .external({
        en: 'Failed to delete datastore',
        de: 'Fehler beim Löschen des Datastores'
      })
      .statusCode(500)
      .shouldLog(true)
      .buildEntry();
    return [null, err];
  }
}
