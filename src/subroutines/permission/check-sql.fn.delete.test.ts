import { describe, expect, test } from "bun:test";
import { checkSqlFn } from "./check-sql.fn";
import type { ParsedPermissions } from "./types";


describe('DELETE STATEMENT', () => {
  test("returns true if delete is allowed with wildcard permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.delete']),
        allColumns: new Set(['datastore.table.column.select']),
      },
    }
    const results = checkSqlFn("DELETE FROM users WHERE id = 1", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false if table row delete access is denied", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(), // no table row delete access
        allColumns: new Set(['datastore.table.column.select']),
      },
    }
    const results = checkSqlFn("DELETE FROM users WHERE id = 1", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns false if WHERE clause column permission is denied", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.delete']),
        allColumns: new Set(), // no column select for WHERE
      },
    }
    const results = checkSqlFn("DELETE FROM users WHERE id = 1", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for specific table with table-level delete permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.delete']),
              columns: {},
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
    const results = checkSqlFn("DELETE FROM users", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for DELETE with WHERE clause when all columns are accessible", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.delete']),
              columns: {
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
    const results = checkSqlFn("DELETE FROM users WHERE age < 18", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for DELETE with WHERE clause when WHERE column is not accessible", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.delete']),
              columns: {
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
    const results = checkSqlFn("DELETE FROM users WHERE age < 18", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns false for DELETE when table exists but row delete permission is missing", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select', 'datastore.table.row.update']), // no delete
              columns: {},
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
    const results = checkSqlFn("DELETE FROM users", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for DELETE with complex WHERE conditions when all columns are accessible", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.delete']),
              columns: {
                age: {
                  actions: new Set(['datastore.table.column.select']),
                },
                active: {
                  actions: new Set(['datastore.table.column.select']),
                },
                last_login: {
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
      "DELETE FROM users WHERE age < 18 AND active = false AND last_login < '2024-01-01'",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for DELETE with complex WHERE when one column is not accessible", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.delete']),
              columns: {
                age: {
                  actions: new Set(['datastore.table.column.select']),
                },
                active: {
                  actions: new Set(['datastore.table.column.select']),
                },
                // last_login permission is missing
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
      "DELETE FROM users WHERE age < 18 AND active = false AND last_login < '2024-01-01'",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for DELETE with IN subquery when all permissions exist", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.delete']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
                },
              },
              allColumns: {
                actions: new Set(),
              },
            },
            banned_users: {
              actions: new Set(['datastore.table.row.select']),
              columns: {
                user_id: {
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
      "DELETE FROM users WHERE id IN (SELECT user_id FROM banned_users)",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for DELETE with IN subquery when subquery table lacks permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.delete']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
                },
              },
              allColumns: {
                actions: new Set(),
              },
            },
            // banned_users table missing - no permissions
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
      "DELETE FROM users WHERE id IN (SELECT user_id FROM banned_users)",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for simple DELETE with wildcard column permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.delete']),
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
    }
    const results = checkSqlFn("DELETE FROM users WHERE id = 123", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for DELETE without WHERE clause (delete all rows)", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            temp_data: {
              actions: new Set(['datastore.table.row.delete']),
              columns: {},
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
    const results = checkSqlFn("DELETE FROM temp_data", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

});
