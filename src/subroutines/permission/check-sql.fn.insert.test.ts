import { describe, expect, test } from "bun:test";
import type { ParsedDatastorePermissions } from "./types";
import { checkSqlFn } from "./check-sql.fn";

describe("checkSqlFn - INSERT STATEMENT", () => {

  test("returns true for INSERT with wildcard permissions", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.insert']),
        allColumns: new Set(['datastore.table.column.insert']),
      },
    }
    const results = checkSqlFn("INSERT INTO users (name, email) VALUES ('John', 'john@example.com')", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false if table insert permission is denied", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(), // no table row insert
        allColumns: new Set(['datastore.table.column.insert']),
      },
    }
    const results = checkSqlFn("INSERT INTO users (name, email) VALUES ('John', 'john@example.com')", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns false if column insert permission is denied", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.insert']),
        allColumns: new Set(), // no column insert
      },
    }
    const results = checkSqlFn("INSERT INTO users (name, email) VALUES ('John', 'john@example.com')", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for INSERT with specific table permissions", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.insert']),
              columns: {
                name: {
                  actions: new Set(['datastore.table.column.insert']),
                },
                email: {
                  actions: new Set(['datastore.table.column.insert']),
                },
              },
              allColumns: {
                actions: new Set(),
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
    }
    const results = checkSqlFn("INSERT INTO users (name, email) VALUES ('John', 'john@example.com')", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false when one column lacks insert permission", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.insert']),
              columns: {
                name: {
                  actions: new Set(['datastore.table.column.insert']),
                },
                // email permission missing
              },
              allColumns: {
                actions: new Set(),
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
    }
    const results = checkSqlFn("INSERT INTO users (name, email) VALUES ('John', 'john@example.com')", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for INSERT with allColumns permission", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.insert']),
              columns: {},
              allColumns: {
                actions: new Set(['datastore.table.column.insert']),
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
    }
    const results = checkSqlFn("INSERT INTO users (name, email, age) VALUES ('John', 'john@example.com', 25)", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for INSERT with multiple rows", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.insert']),
        allColumns: new Set(['datastore.table.column.insert']),
      },
    }
    const results = checkSqlFn(
      "INSERT INTO users (name, email) VALUES ('John', 'john@example.com'), ('Jane', 'jane@example.com')",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for INSERT without column list (all columns)", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.insert']),
        allColumns: new Set(['datastore.table.column.insert']),
      },
    }
    const results = checkSqlFn("INSERT INTO users VALUES ('John', 'john@example.com', 25)", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for INSERT into non-existent table permissions", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            posts: {
              actions: new Set(['datastore.table.row.insert']),
              columns: {},
              allColumns: {
                actions: new Set(['datastore.table.column.insert']),
              },
            },
            // users table missing
          },
        },
      },
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    }
    const results = checkSqlFn("INSERT INTO users (name) VALUES ('John')", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for INSERT with NULL values", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.insert']),
        allColumns: new Set(['datastore.table.column.insert']),
      },
    }
    const results = checkSqlFn("INSERT INTO users (name, email) VALUES ('John', NULL)", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for INSERT with number values", () => {
    const pdp: ParsedDatastorePermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.insert']),
        allColumns: new Set(['datastore.table.column.insert']),
      },
    }
    const results = checkSqlFn(
      "INSERT INTO users (name, age, score) VALUES ('John', 25, 99.5)",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(true);
  });

});
