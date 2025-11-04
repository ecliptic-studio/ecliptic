import type { Datastore } from "@server/db.d";
import type { Selectable } from "kysely";

export type TDatastore = Omit<Selectable<Datastore>, 'encrypted_json' | 'external_id' | 'external_name' | 'schema_json'> & {
    schema_json: {
        tables: Record<string, {
            columns: Record<string, {
                name: string;
                order: number
                db_type: string; // TEXT, INTEGER, REAL, BLOB,
                dflt_value?: string | null; // Default value from SQLite
                notnull?: boolean; // NOT NULL constraint
                autoincrement?: boolean; // AUTOINCREMENT detection
                foreign_key?: {
                    table: string; // Referenced table name
                    column: string; // Referenced column name (the "to" field)
                    on_update: string; // ON UPDATE action
                    on_delete: string; // ON DELETE action
                }; // Foreign key reference (only included if applicable)
            }>;
        }>;
    }
}

export function toTDatastore(datastore: Selectable<Datastore>): TDatastore {
    const { encrypted_json, external_id, external_name, schema_json, ...rest } = datastore;
    return {
        ...rest,
        schema_json: JSON.parse(schema_json) as TDatastore['schema_json'],
    };
}