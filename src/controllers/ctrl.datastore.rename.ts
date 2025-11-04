import { toTDatastore, type TDatastore } from "@dto/TDatastore";
import type { TSession } from "@dto/TSession";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";

export type RenameDatastoreArgs = {
  id: string;
  internalName: string;
};

export type DatastoreControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

/**
 * Controller for renaming a datastore
 */
export async function renameDatastoreController(
  ctx: DatastoreControllerContext,
  args: RenameDatastoreArgs
): Promise<TErrTuple<TDatastore>> {
  // 1. Check if datastore exists and belongs to organization
  const existingDatastore = await ctx.db
    .selectFrom('datastore')
    .where('id', '=', args.id)
    .where('organization_id', '=', ctx.session.activeOrganizationId)
    .selectAll()
    .executeTakeFirst();

  if (!existingDatastore) {
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_UPDATE_NOT_FOUND)
      .internal(`Datastore ${args.id} not found`)
      .external({ en: 'Datastore not found', de: 'Datastore nicht gefunden' })
      .statusCode('Not Found')
      .buildEntry();
    return [null, err];
  }

  // 2. Check if new name is already taken (if name is actually changing)
  if (existingDatastore.internal_name !== args.internalName) {
    const duplicateDatastore = await ctx.db
      .selectFrom('datastore')
      .where('organization_id', '=', ctx.session.activeOrganizationId)
      .where('internal_name', '=', args.internalName)
      .where('id', '!=', args.id)
      .selectAll()
      .executeTakeFirst();

    if (duplicateDatastore) {
      const err = createError(ErrorCode.CONTROLLER_DATASTORE_UPDATE_UNIQUE_NAME)
        .internal(`Datastore name ${args.internalName} already exists`)
        .external({
          en: `Datastore ${args.internalName} already exists`,
          de: `Datastore ${args.internalName} existiert bereits`
        })
        .statusCode('Conflict')
        .buildEntry();
      return [null, err];
    }
  }

  // 3. Update datastore and permission targets in a transaction
  try {
    const updatedDatastore = await ctx.db
      .updateTable('datastore')
      .set({ internal_name: args.internalName })
      .where('id', '=', args.id)
      .where('organization_id', '=', ctx.session.activeOrganizationId)
      .returningAll()
      .executeTakeFirstOrThrow();

    const data = toTDatastore(updatedDatastore);
    return [data, null];
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_UPDATE_FAILED)
      .internal(msg)
      .external({ en: 'Failed to rename datastore', de: 'Fehler beim Umbenennen des Datastores' })
      .statusCode('Internal Server Error')
      .shouldLog(true)
      .buildEntry();
    return [null, err];
  }
}
