import { toTDatastore, type TDatastore } from "@dto/TDatastore";
import type { TSession } from "@dto/TSession";
import { executeRollbacks } from "@error/rollback";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { createDatastoreTx } from "@server/subroutines/datastore/create-datastore.tx";
import Database from "bun:sqlite";
import { mkdir } from "fs/promises";
import { nanoid } from "nanoid";

export type CreateDatastoreArgs = {
  internalName: string;
  provider: 'sqlite' | 'turso';
};

export type DatastoreControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

/**
 * Controller for creating a new datastore
 */
export async function createDatastoreController(
  ctx: DatastoreControllerContext,
  args: CreateDatastoreArgs
):Promise<TErrTuple<TDatastore>> {

  const existingDatastore = await ctx.db.selectFrom('datastore')
   .where('organization_id', '=', ctx.session.activeOrganizationId)
   .where('internal_name', '=', args.internalName)
   .selectAll()
   .executeTakeFirst()

  if(existingDatastore) {
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_CREATE_UNIQUE_NAME)
    .internal(`Datastore ${args.internalName} exists`)
    .external({ en: `Datastore ${args.internalName} already exists`, de: `Datastore ${args.internalName} already exists` })
    .statusCode(409)
    .buildEntry()
    return [null, err]
  }

  const dbId = nanoid();
  const fileName = dbId;

  const [database, error, rollbacks] = await createDatastoreTx({ Database: Database, mkdir: mkdir }, { fileName, });

  if (error) {
    // Execute rollbacks on error
    await executeRollbacks(rollbacks);
    return [null, error]
  }

  database.close()

  try {
    const datastore = await ctx.db.transaction().execute(async (tx) => {
      const datastore = await tx.insertInto('datastore').values({
        id: dbId,
        external_id: dbId,
        external_name: dbId,
        internal_name: args.internalName,
        organization_id: ctx.session.activeOrganizationId,
        provider: args.provider,
        schema_json: JSON.stringify({tables: {}}),
        status: 'active'
      })
      .returningAll()
      .executeTakeFirstOrThrow();

      await tx.insertInto('permission_target').values({
        organization_id: ctx.session.activeOrganizationId,
        internal_name: 'datastore:*',
        permission_type_id: 'datastore',
        id: `datastore:*`,
        datastore_id: null
      }).onConflict(builder => builder.doNothing())
      .execute()

      await tx.insertInto('permission_target').values({
        organization_id: ctx.session.activeOrganizationId,
        internal_name: 'datastore:*.table:*',
        permission_type_id: 'datastore.table',
        id: `datastore:*.table:*`,
        datastore_id: null
      }).onConflict(builder => builder.doNothing())
      .execute()

      await tx.insertInto('permission_target').values({
        organization_id: ctx.session.activeOrganizationId,
        internal_name: 'datastore:*.table:*.column:*',
        permission_type_id: 'datastore.table.column',
        id: `datastore:*.table:*.column:*`,
        datastore_id: null
      }).onConflict(builder => builder.doNothing())
      .execute()
  
      await tx.insertInto('permission_target').values({
        organization_id: ctx.session.activeOrganizationId,
        internal_name: args.internalName,
        permission_type_id: 'datastore',
        id: `datastore:${dbId}`,
        datastore_id: dbId
      }).execute()

      await tx.insertInto('permission_target').values({
        organization_id: ctx.session.activeOrganizationId,
        internal_name: args.internalName + '.table:*',
        permission_type_id: 'datastore.table',
        id: `datastore:${dbId}.table:*`,
        datastore_id: dbId
      }).execute()

      await tx.insertInto('permission_target').values({
        organization_id: ctx.session.activeOrganizationId,
        internal_name: args.internalName + '.table:*' + '.column:*',
        permission_type_id: 'datastore.table.column',
        id: `datastore:${dbId}.table:*` + '.column:*',
        datastore_id: dbId
      }).execute()

      return datastore
    })

    const data = toTDatastore(datastore)
    return [data, null]
  } catch (error) {
    console.log(error)
    await executeRollbacks(rollbacks)

    const msg = error instanceof Error ? error.message : 'Unknown error'
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_CREATE_FAILED)
      .internal(msg)
      .external({ en: 'Failed to create datastore', de: 'Fehler beim Erstellen des Datastores' })
      .statusCode(500)
      .shouldLog(true)
      .buildEntry()
    return [null, err]
  }
}
