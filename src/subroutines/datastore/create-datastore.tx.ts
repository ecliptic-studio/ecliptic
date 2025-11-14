import { ErrorCode } from "@server/error/error-code.enum";
import { type Database } from "bun:sqlite";
import { type mkdir } from "fs/promises";
import { join } from "path";
import type { TErrTriple, TExternalRollback } from "@error/error-code.types";
import { createError } from "@error/t-error";

export type CreateDatastoreArgs = {
  fileName: string;
};

/**
 * Creates a new SQLite datastore in the filesystem and tracks it in the database
 * Returns open database connection
 */
export async function createDatastoreTx(
  portal: {Database: typeof Database, mkdir: typeof mkdir},
  args: CreateDatastoreArgs
): Promise<TErrTriple<Database>> {
  const rollbacks: TExternalRollback[] = [];
  

  try {
    // Generate unique IDs
    // Create datastores directory if it doesn't exist
    const datastoresDir = join(process.cwd(), 'datastores');
    await portal.mkdir(datastoresDir, { recursive: true });

    // Create the SQLite database file
    const dbPath = join(datastoresDir, `${args.fileName}`);
    const sqliteDb = new portal.Database(dbPath, { create: true });

    // Add rollback to delete the database file
    rollbacks.push(async () => {
      try {
        await Bun.file(dbPath).exists().then(() => Bun.file(dbPath).delete());
        return ['Deleted datastore file', null, []];
      } catch (e) {
        return [
          null,
          createError(ErrorCode.SR_DATASTORE_ROLLBACK_DELETE_FILE_FAILED)
            .internal(`Failed to delete datastore file: ${e}`)
            .external({ en: 'Failed to clean up datastore file', de: 'Datastore-Datei konnte nicht gelöscht werden' })
            .shouldLog(true)
            .buildEntry(),
          []
        ];
      }
    });

    return [sqliteDb, null, rollbacks];
  } catch (error) {
    return [
      null,
      createError(ErrorCode.SR_DATASTORE_CREATE_FAILED)
        .statusCode(500)
        .internal(`Failed to create datastore: ${error}`)
        .external({
          de: 'Datastore konnte nicht erstellt werden',
          en: 'Failed to create datastore',
        })
        .shouldLog(true)
        .buildEntry(),
      rollbacks
    ];
  }
}
