import { toTDatastore, type TDatastore } from "@dto/TDatastore";
import type { TSession } from "@dto/TSession";
import { executeRollbacks } from "@error/rollback";
import { createError } from "@error/t-error";
import { type TKysely } from "@server/db";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple, TExternalRollback } from "@server/error/error-code.types";
import { buildSchemaChangeQueryFn, type TDatastoreSchemaChange } from "@server/subroutines/datastore/build-schema-change-query.fn";
import { datastoreGetSchemaFx } from "@server/subroutines/datastore/get-schema.fx";
import { openDatastoreConnectionTx } from "@server/subroutines/datastore/open-connection.tx";
import Database from "bun:sqlite";
import { sql } from "kysely";

export type SchemaChangeDatastoreArgs = {
  id: string
  change: TDatastoreSchemaChange
};

export type DatastoreControllerContext = {
  session: Pick<TSession, 'activeOrganizationId'>;
  db: TKysely;
};

/**
 * Controller for creating a new datastore
 */
export async function schemaChangeDatastoreController(
  ctx: DatastoreControllerContext,
  args: SchemaChangeDatastoreArgs
):Promise<TErrTuple<TDatastore>> {
  const rollbacks: TExternalRollback[] = [];

  const existingDatastore = await ctx.db.selectFrom('datastore')
   .where('organization_id', '=', ctx.session.activeOrganizationId)
   .where('id', '=', args.id)
   .selectAll()
   .executeTakeFirst()

  if(!existingDatastore) {
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_SCHEMA_CHANGE_NOT_FOUND)
    .internal(`Datastore ${args.id} not found`)
    .external({ en: `Datastore ${args.id} not found`, de: `Datastore ${args.id} nicht gefunden` })
    .statusCode('Not Found')
    .buildEntry()
    return [null, err]
  }

  try {
    const { query, rollback: rollbackQuery } = buildSchemaChangeQueryFn(args.change)
    const [database, error, rb] = openDatastoreConnectionTx({ Database }, { fileName: existingDatastore.external_id, readOnly: false });

    rollbacks.push(...rb)
    if(error) {
      await executeRollbacks(rollbacks)
      return [null, error]
    }

    database.run(query)
    if(rollbackQuery) {
      rollbacks.push(async () => {
        database.run(rollbackQuery)
        return ['Rolled back schema change', null, []]
      })
    }
    const [schema, error2] = datastoreGetSchemaFx( { db: database })
    if(error2) {
      await executeRollbacks(rollbacks)
      return [null, error2]
    }

    const datastore = await ctx.db.transaction().execute(async (tx) => {
      const datastore = await tx.updateTable('datastore')
      .where('id', '=', args.id)
      .set({
        schema_json: JSON.stringify(schema)
      })
      .returningAll()
      .executeTakeFirstOrThrow()

      switch(args.change.type) {
        case 'add-table':
          await tx.insertInto('permission_target').values([{
            organization_id: ctx.session.activeOrganizationId,
            internal_name: datastore.internal_name + '.table.' + args.change.table,
            permission_type_id: 'datastore.table',
            id: `datastore:${args.id}.table:${args.change.table}`,
            datastore_id: args.id
          },{
            organization_id: ctx.session.activeOrganizationId,
            internal_name: datastore.internal_name + '.table.' + args.change.table + '.column._id',
            permission_type_id: 'datastore.table.column',
            id: `datastore:${args.id}.table:${args.change.table}.column:_id`,
            datastore_id: args.id
          }, {
            organization_id: ctx.session.activeOrganizationId,
            internal_name: datastore.internal_name + '.table.' + args.change.table + '.column.*',
            permission_type_id: 'datastore.table.column',
            id: `datastore:${args.id}.table:${args.change.table}.column.*`,
            datastore_id: args.id
          }]).execute()
          break
        case 'drop-table':
          await tx.deleteFrom('permission_target')
          .where('organization_id', '=', ctx.session.activeOrganizationId)
          .where('id', 'like', `datastore:${args.id}.table:${args.change.table}%`)
          .execute()
          break
        case 'add-column':
          await tx.insertInto('permission_target').values({
            organization_id: ctx.session.activeOrganizationId,
            internal_name: datastore.internal_name + '.table.' + args.change.table + '.column.' + args.change.column,
            permission_type_id: 'datastore.table.column',
            id: `datastore:${args.id}.table:${args.change.table}.column:${args.change.column}`,
            datastore_id: args.id
          }).execute()
          break
        case 'drop-column':
          await tx.deleteFrom('permission_target')
          .where('organization_id', '=', ctx.session.activeOrganizationId)
          .where('id', '=', `datastore:${args.id}.table:${args.change.table}.column:${args.change.column}`)
          .execute()
          break
        case 'rename-column':
          await tx.updateTable('permission_target')
          .where('organization_id', '=', ctx.session.activeOrganizationId)
          .where('id', '=', `datastore:${args.id}.table:${args.change.table}.column:${args.change.column}`)
          .set({
            id: `datastore:${args.id}.table:${args.change.table}.column:${args.change.new_name}`,
            internal_name: datastore.internal_name + '.table.' + args.change.table + '.column.' + args.change.new_name,
          }).execute()
          break
        case 'rename-table':
          const oldTableId = `datastore:${args.id}.table:${args.change.table}`;
          const newTableId = `datastore:${args.id}.table:${args.change.new_name}`;
          const oldTableInternalName = datastore.internal_name + '.table.' + args.change.table;
          const newTableInternalName = datastore.internal_name + '.table.' + args.change.new_name;

          await tx.updateTable('permission_target')
          .where('organization_id', '=', ctx.session.activeOrganizationId)
          .where('id', 'like', `${oldTableId}%`)
          .set({
            internal_name: sql`REPLACE(internal_name, ${oldTableInternalName}, ${newTableInternalName})`,
            id: sql`REPLACE(id, ${oldTableId}, ${newTableId})`
          }).execute()
          break
      }

      return datastore
    })


    database.close()

    const data = toTDatastore(datastore)
    return [data, null]
  } catch (error) {
    console.log(error)
    await executeRollbacks(rollbacks)

    const msg = error instanceof Error ? error.message : 'Unknown error'
    const err = createError(ErrorCode.CONTROLLER_DATASTORE_SCHEMA_CHANGE_FAILED)
      .internal(msg)
      .external({ en: 'Failed to change datastore schema', de: 'Fehler beim Ändern des Datastoreschemas' })
      .statusCode('Internal Server Error')
      .shouldLog(true)
      .buildEntry()
    return [null, err]
  }
}
