import { describe, expect, test } from "bun:test";
import type { ParsedPermissions, TSchemaChangeOperation } from "./types";
import { checkSqlFn } from "./check-sql.fn";

describe("checkSqlFn - ALTER STATEMENT", () => {

  test("returns allowed=true and DDL operation for ALTER TABLE ADD COLUMN with schema.change permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']),
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

  test("returns false for ALTER TABLE ADD COLUMN without schema.change permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(), // no schema.change
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
    const results = checkSqlFn("ALTER TABLE users ADD COLUMN age INTEGER", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for ALTER TABLE RENAME with both schema.change and table.rename permissions", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change', 'datastore.table.rename']),
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

  test("returns false for ALTER TABLE RENAME without table.rename permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']), // has schema.change but not table.rename
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
    const results = checkSqlFn("ALTER TABLE users RENAME TO customers", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns false for ALTER TABLE RENAME without schema.change permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.rename']), // has table.rename but not schema.change
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
    const results = checkSqlFn("ALTER TABLE users RENAME TO customers", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for ALTER TABLE RENAME COLUMN with schema.change and column.rename permissions", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']),
              columns: {
                email: {
                  actions: new Set(['datastore.table.column.rename']),
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

  test("returns false for ALTER TABLE RENAME COLUMN without column.rename permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']),
              columns: {
                email: {
                  actions: new Set(), // no column.rename
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
    const results = checkSqlFn("ALTER TABLE users RENAME COLUMN email TO email_address", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for ALTER TABLE DROP COLUMN with schema.change and column.drop permissions", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']),
              columns: {
                age: {
                  actions: new Set(['datastore.table.column.drop']),
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

  test("returns false for ALTER TABLE DROP COLUMN without column.drop permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']),
              columns: {
                age: {
                  actions: new Set(), // no column.drop
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
    const results = checkSqlFn("ALTER TABLE users DROP COLUMN age", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for ALTER TABLE with wildcard schema.change permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.schema.change']),
        allColumns: new Set(),
      },
    }
    const results = checkSqlFn("ALTER TABLE users ADD COLUMN status TEXT", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
    expect(results[0]?.isDdl).toBe(true);
    if (results[0]?.isDdl && results[0].operation.type === 'add-column') {
      expect(results[0].operation.table).toBe('users');
      expect(results[0].operation.column).toBe('status');
      expect(results[0].operation.db_type).toBe('TEXT');
    }
  });

  test("returns true for ALTER TABLE RENAME COLUMN with wildcard column.rename permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.schema.change']),
        allColumns: new Set(['datastore.table.column.rename']),
      },
    }
    const results = checkSqlFn("ALTER TABLE users RENAME COLUMN name TO full_name", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for ALTER TABLE DROP COLUMN with wildcard column.drop permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.schema.change']),
        allColumns: new Set(['datastore.table.column.drop']),
      },
    }
    const results = checkSqlFn("ALTER TABLE users DROP COLUMN temp_field", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for ALTER TABLE on non-existent table", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            posts: {
              actions: new Set(['datastore.table.schema.change']),
              columns: {},
              allColumns: {
                actions: new Set(),
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
    const results = checkSqlFn("ALTER TABLE users ADD COLUMN age INTEGER", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for ALTER TABLE RENAME with wildcard table.rename permission", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.schema.change', 'datastore.table.rename']),
        allColumns: new Set(),
      },
    }
    const results = checkSqlFn("ALTER TABLE users RENAME TO app_users", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for ALTER TABLE with table-level allColumns permission for RENAME COLUMN", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']),
              columns: {},
              allColumns: {
                actions: new Set(['datastore.table.column.rename']),
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
    const results = checkSqlFn("ALTER TABLE users RENAME COLUMN any_column TO new_name", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for ALTER TABLE with table-level allColumns permission for DROP COLUMN", () => {
    const pdp: ParsedPermissions = {
      global: {actions: new Set()},
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.schema.change']),
              columns: {},
              allColumns: {
                actions: new Set(['datastore.table.column.drop']),
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
    const results = checkSqlFn("ALTER TABLE users DROP COLUMN any_column", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

});
