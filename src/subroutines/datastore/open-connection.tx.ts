import type { TErrTriple, TExternalRollback } from "@server/error/error-code.types";
import type Database from "bun:sqlite";
import { join } from "path";


const databasePool: Record<string, Database> = {};

/**
 * Opens a connection to a datastore database
 * Keeps a pool of open connections to avoid opening and closing the database file multiple times
 */
export function openDatastoreConnectionTx(portal: {Database: typeof Database}, args: {fileName: string, readOnly: boolean}):TErrTriple<Database> {
    const dbPath = join(process.cwd(), 'datastores', `${args.fileName}`);
 
    const existingDb = databasePool[args.fileName];
    if(existingDb) {
        return [existingDb, null, []];
    }
    const db = new portal.Database(dbPath, { create: false, readonly: args.readOnly, readwrite: !args.readOnly });
    db.run(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = 10000;
        PRAGMA foreign_keys = ON;
        PRAGMA mmap_size = 268435456; --256MB;
        PRAGMA temp_store = MEMORY;
        `);
    // @ts-ignore
    db.originalClose = db.close;
    // monkey patch close to store in pool
    db.close = (throwOnError?: boolean) => {
        // @ts-ignore
        db.originalClose(throwOnError);
        delete databasePool[args.fileName];
    }
    databasePool[args.fileName] = db;
    const rollbacks: TExternalRollback[] = [
        async () => {
            db.close(false);
            return ['Closed database ' + args.fileName, null, []];
        }
    ];
    return [db, null, rollbacks];
}