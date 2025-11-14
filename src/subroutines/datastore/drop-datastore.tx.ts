import type { TErrTriple, TExternalRollback } from "@error/error-code.types";
import { createError } from "@error/t-error";
import { ErrorCode } from "@server/error/error-code.enum";
import { join } from "path";

export type DatastoreDropArgs = {
  fileName: string;
};

/**
 * Creates a new SQLite datastore in the filesystem and tracks it in the database
 * Returns open database connection
 */
export async function datastoreDropTx(
  portal: {Bun: typeof Bun},
  args: DatastoreDropArgs
): Promise<TErrTriple<null>> {
  const rollbacks: TExternalRollback[] = [];
  
  try {
    const dbPath = join(process.cwd(), 'datastores', `${args.fileName}`);
    await portal.Bun.file(dbPath).exists().then(() => {
      portal.Bun.file(dbPath).delete();
      portal.Bun.file(dbPath + '-shm').delete().catch(() => {});
      portal.Bun.file(dbPath + '-wal').delete().catch(() => {});
    });

    rollbacks.push(async () => {
      // TODO: restore from backup
      return ['Rollback deleted datastore file', null, []];
    });

    return [null, null, rollbacks];
  } catch (error) {
    return [
      null,
      createError(ErrorCode.SR_DATASTORE_DELETE_FAILED)
        .statusCode(500)
        .internal(`Failed to delete datastore ${args.fileName}: ${error}`)
        .external({
          de: 'Datastore konnte nicht gelöscht werden',
          en: 'Failed to delete datastore',
        })
        .shouldLog(true)
        .buildEntry(),
      rollbacks
    ];
  }
}
