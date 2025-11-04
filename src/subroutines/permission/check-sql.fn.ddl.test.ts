import { describe, expect, test } from "bun:test";
import type { ParsedDatastorePermissions } from "./types";
import { checkSqlFn } from "./check-sql.fn";

describe("checkSqlFn - DDL OPERATIONS", () => {

  test("ALTER TABLE ADD COLUMN returns correct schema change operation", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']),
              columns: {},
              allColumns: { actions: new Set() },
            },
          },
        },
      },
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    };

    const results = checkSqlFn("ALTER TABLE users ADD COLUMN age INTEGER", pdp, "abc123");

    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(true);

    if (results[0]?.isDdl) {
      expect(results[0].operation.type).toBe('add-column');
      if (results[0].operation.type === 'add-column') {
        expect(results[0].operation.table).toBe('users');
        expect(results[0].operation.column).toBe('age');
        expect(results[0].operation.db_type).toBe('INTEGER');
      }
    }
  });

  test("ALTER TABLE ADD COLUMN with TEXT type", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.schema.change']),
        allColumns: new Set(),
      },
    };

    const results = checkSqlFn("ALTER TABLE users ADD COLUMN name TEXT", pdp, "abc123");

    if (results[0]?.isDdl && results[0].operation.type === 'add-column') {
      expect(results[0].operation.db_type).toBe('TEXT');
    }
  });

  test("ALTER TABLE ADD COLUMN with REAL type", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.schema.change']),
        allColumns: new Set(),
      },
    };

    const results = checkSqlFn("ALTER TABLE users ADD COLUMN score REAL", pdp, "abc123");

    if (results[0]?.isDdl && results[0].operation.type === 'add-column') {
      expect(results[0].operation.db_type).toBe('REAL');
    }
  });

  test("ALTER TABLE RENAME TO returns correct schema change operation", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change', 'datastore.table.rename']),
              columns: {},
              allColumns: { actions: new Set() },
            },
          },
        },
      },
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    };

    const results = checkSqlFn("ALTER TABLE users RENAME TO customers", pdp, "abc123");

    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(true);

    if (results[0]?.isDdl) {
      expect(results[0].operation.type).toBe('rename-table');
      if (results[0].operation.type === 'rename-table') {
        expect(results[0].operation.table).toBe('users');
        expect(results[0].operation.new_name).toBe('customers');
      }
    }
  });

  test("ALTER TABLE RENAME COLUMN returns correct schema change operation", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.schema.change']),
        allColumns: new Set(['datastore.table.column.rename']),
      },
    };

    const results = checkSqlFn("ALTER TABLE users RENAME COLUMN email TO email_address", pdp, "abc123");

    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(true);

    if (results[0]?.isDdl) {
      expect(results[0].operation.type).toBe('rename-column');
      if (results[0].operation.type === 'rename-column') {
        expect(results[0].operation.table).toBe('users');
        expect(results[0].operation.column).toBe('email');
        expect(results[0].operation.new_name).toBe('email_address');
      }
    }
  });

  test("ALTER TABLE DROP COLUMN returns correct schema change operation", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.schema.change']),
        allColumns: new Set(['datastore.table.column.drop']),
      },
    };

    const results = checkSqlFn("ALTER TABLE users DROP COLUMN age", pdp, "abc123");

    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(true);

    if (results[0]?.isDdl) {
      expect(results[0].operation.type).toBe('drop-column');
      if (results[0].operation.type === 'drop-column') {
        expect(results[0].operation.table).toBe('users');
        expect(results[0].operation.column).toBe('age');
      }
    }
  });

  test("CREATE TABLE returns correct schema change operation", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(['datastore.table.create']),
          tables: {},
        },
      },
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    };

    const results = checkSqlFn("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT)", pdp, "abc123");

    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(true);

    if (results[0]?.isDdl) {
      expect(results[0].operation.type).toBe('add-table');
      if (results[0].operation.type === 'add-table') {
        expect(results[0].operation.table).toBe('products');
      }
    }
  });

  test("DROP TABLE returns correct schema change operation", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.drop']),
              columns: {},
              allColumns: { actions: new Set() },
            },
          },
        },
      },
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    };

    const results = checkSqlFn("DROP TABLE users", pdp, "abc123");

    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(true);

    if (results[0]?.isDdl) {
      expect(results[0].operation.type).toBe('drop-table');
      if (results[0].operation.type === 'drop-table') {
        expect(results[0].operation.table).toBe('users');
      }
    }
  });

  test("DML statements have isDdl=false", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.select']),
        allColumns: new Set(['datastore.table.column.select']),
      },
    };

    const results = checkSqlFn("SELECT * FROM users", pdp, "abc123");

    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(false);
  });

  test("DDL without permission returns allowed=false", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(), // no schema.change permission
              columns: {},
              allColumns: { actions: new Set() },
            },
          },
        },
      },
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    };

    const results = checkSqlFn("ALTER TABLE users ADD COLUMN age INTEGER", pdp, "abc123");

    expect(results[0]?.allowed).toBe(false);
    expect(results[0]?.isDdl).toBe(true);

    if (results[0]?.isDdl) {
      expect(results[0].operation.type).toBe('add-column');
    }
  });

  test("Multiple DDL statements returns multiple operations", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(['datastore.table.create']),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']),
              columns: {},
              allColumns: { actions: new Set() },
            },
          },
        },
      },
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    };

    const results = checkSqlFn(
      "CREATE TABLE products (id INTEGER); ALTER TABLE users ADD COLUMN age INTEGER",
      pdp,
      "abc123"
    );

    expect(results.length).toBe(2);

    // First result: CREATE TABLE
    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(true);
    if (results[0]?.isDdl) {
      expect(results[0].operation.type).toBe('add-table');
    }

    // Second result: ALTER TABLE
    expect(results[1]?.allowed).toBe(true);
    expect(results[1]?.isDdl).toBe(true);
    if (results[1]?.isDdl) {
      expect(results[1].operation.type).toBe('add-column');
    }
  });

  test("Mixed DML and DDL statements", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select', 'datastore.table.schema.change']),
              columns: {},
              allColumns: {
                actions: new Set(['datastore.table.column.select']),
              },
            },
          },
        },
      },
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    };

    const results = checkSqlFn(
      "SELECT * FROM users; ALTER TABLE users ADD COLUMN age INTEGER",
      pdp,
      "abc123"
    );

    expect(results.length).toBe(2);

    // First result: SELECT (DML)
    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(false);

    // Second result: ALTER TABLE (DDL)
    expect(results[1]?.allowed).toBe(true);
    expect(results[1]?.isDdl).toBe(true);
    if (results[1]?.isDdl) {
      expect(results[1].operation.type).toBe('add-column');
    }
  });

});
