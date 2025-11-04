import { describe, expect, test } from "bun:test";
import { checkSqlFn } from "./check-sql.fn";
import type { ParsedPermissions } from "./types";


describe('UPDATE STATEMENT', () => {
  test("returns true if update is allowed with wildcard permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.update']),
        allColumns: new Set(['datastore.table.column.update']),
      },
    }
    const results = checkSqlFn("UPDATE users SET name = 'John'", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false if table row update access is denied", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(), // no table row update access
        allColumns: new Set(['datastore.table.column.update']),
      },
    }
    const results = checkSqlFn("UPDATE users SET name = 'John'", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns false if column update access is denied", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.update']),
        allColumns: new Set(), // no column update access
      },
    }
    const results = checkSqlFn("UPDATE users SET name = 'John'", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for specific table with table-level update permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.update']),
              columns: {},
              allColumns: {
                actions: new Set(['datastore.table.column.update']),
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
    const results = checkSqlFn("UPDATE users SET name = 'John'", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for specific columns when column update permissions exist", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.update']),
              columns: {
                name: {
                  actions: new Set(['datastore.table.column.update']),
                },
                email: {
                  actions: new Set(['datastore.table.column.update']),
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
    const results = checkSqlFn("UPDATE users SET name = 'John', email = 'john@example.com'", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for specific columns when one column update is not allowed", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.update']),
              columns: {
                name: {
                  actions: new Set(['datastore.table.column.update']),
                },
                // email permission is missing
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
    const results = checkSqlFn("UPDATE users SET name = 'John', email = 'john@example.com'", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for UPDATE with WHERE clause when all columns are accessible", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.update']),
              columns: {
                name: {
                  actions: new Set(['datastore.table.column.update', 'datastore.table.column.select']),
                },
                age: {
                  actions: new Set(['datastore.table.column.select']),
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
    const results = checkSqlFn("UPDATE users SET name = 'John' WHERE age > 18", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for UPDATE with WHERE clause when WHERE column is not accessible", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.update']),
              columns: {
                name: {
                  actions: new Set(['datastore.table.column.update']),
                },
                // age permission is missing (needed for WHERE clause)
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
    const results = checkSqlFn("UPDATE users SET name = 'John' WHERE age > 18", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for multiple column updates with wildcard permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.update']),
        allColumns: new Set(['datastore.table.column.update']),
      },
    }
    const results = checkSqlFn(
      "UPDATE users SET name = 'John', email = 'john@example.com', age = 30, updated_at = NOW()",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for UPDATE when table exists but row update permission is missing", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']), // only select, no update
              columns: {
                name: {
                  actions: new Set(['datastore.table.column.update']),
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
    const results = checkSqlFn("UPDATE users SET name = 'John'", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for UPDATE with complex WHERE conditions when all columns are accessible", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.update']),
              columns: {
                status: {
                  actions: new Set(['datastore.table.column.update', 'datastore.table.column.select']),
                },
                age: {
                  actions: new Set(['datastore.table.column.select']),
                },
                active: {
                  actions: new Set(['datastore.table.column.select']),
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
    const results = checkSqlFn(
      "UPDATE users SET status = 'verified' WHERE age > 18 AND active = true",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(true);
  });

})
