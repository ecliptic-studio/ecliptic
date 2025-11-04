import { describe, expect, test } from "bun:test";
import { checkSqlFn } from "./check-sql.fn";
import type { ParsedPermissions } from "./types";


describe('SELECT STATEMENT', () => {
  test("returns true if select * is allowed with wildcard permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.select']),
        allColumns: new Set(['datastore.table.column.select']),
      },
    }
    const results = checkSqlFn("SELECT * FROM users", pdp, "abc123");
    expect(results.length).toBe(1);
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true if select * is allowed with wildcard permissions and multiple queries", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.select']),
        allColumns: new Set(['datastore.table.column.select']),
      },
    }
    const results = checkSqlFn("SELECT * FROM users; SELECT * FROM posts", pdp, "abc123");
    expect(results.length).toBe(2);
    expect(results[0]?.allowed).toBe(true);
    expect(results[1]?.allowed).toBe(true);
  });

  test("returns false if table access is denied", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(), // no table row access
        allColumns: new Set(['datastore.table.column.select']),
      },
    }
    const results = checkSqlFn("SELECT * FROM users", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns false if column access is denied", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.select']),
        allColumns: new Set(), // no column access
      },
    }
    const results = checkSqlFn("SELECT * FROM users", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for specific table with table-level permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']),
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
    const results = checkSqlFn("SELECT * FROM users", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for specific columns when column permissions exist", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
                },
                name: {
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
    const results = checkSqlFn("SELECT id, name FROM users", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for specific columns when one column is not allowed", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
                },
                // name permission is missing
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
    const results = checkSqlFn("SELECT id, name FROM users", pdp, "abc123");
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for JOIN when both tables have permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
                },
                name: {
                  actions: new Set(['datastore.table.column.select']),
                },
              },
              allColumns: {
                actions: new Set(),
              },
            },
            posts: {
              actions: new Set(['datastore.table.row.select']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
                },
                user_id: {
                  actions: new Set(['datastore.table.column.select']),
                },
                title: {
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
      "SELECT users.name, posts.title FROM users JOIN posts ON users.id = posts.user_id",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for JOIN when one table lacks permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
                },
                name: {
                  actions: new Set(['datastore.table.column.select']),
                },
              },
              allColumns: {
                actions: new Set(),
              },
            },
            // posts table missing - no permissions
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
      "SELECT users.name, posts.title FROM users JOIN posts ON users.id = posts.user_id",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns false for JOIN when one column in join lacks permissions", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
                },
                name: {
                  actions: new Set(['datastore.table.column.select']),
                },
              },
              allColumns: {
                actions: new Set(),
              },
            },
            posts: {
              actions: new Set(['datastore.table.row.select']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
                },
                user_id: {
                  actions: new Set(['datastore.table.column.select']),
                },
                // title permission is missing
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
      "SELECT users.name, posts.title FROM users JOIN posts ON users.id = posts.user_id",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(false);
  });

  test("returns true for SELECT with WHERE clause when all columns are accessible", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']),
              columns: {
                id: {
                  actions: new Set(['datastore.table.column.select']),
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
    const results = checkSqlFn("SELECT id FROM users WHERE age > 18", pdp, "abc123");
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns true for complex JOIN with multiple tables", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(['datastore.table.row.select']),
        allColumns: new Set(['datastore.table.column.select']),
      },
    }
    const results = checkSqlFn(
      "SELECT u.name, p.title, c.content FROM users u JOIN posts p ON u.id = p.user_id JOIN comments c ON p.id = c.post_id",
      pdp,
      "abc123"
    );
    expect(results[0]?.allowed).toBe(true);
  });

  test("returns false for multiple queries when one query is denied", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']),
              columns: {},
              allColumns: {
                actions: new Set(['datastore.table.column.select']),
              },
            },
            // posts table missing - no permissions
          },
        },
      },
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    }
    const results = checkSqlFn("SELECT * FROM users; SELECT * FROM posts", pdp, "abc123");
    expect(results.length).toBe(2);
    expect(results[0]?.allowed).toBe(true);
    expect(results[1]?.allowed).toBe(false);
  });

  test("returns true for multiple queries when all queries are allowed", () => {
    const pdp: ParsedPermissions = {
      global: { actions: new Set() },
      datastores: {
        abc123: {
          actions: new Set(),
          tables: {
            users: {
              actions: new Set(['datastore.table.row.select']),
              columns: {},
              allColumns: {
                actions: new Set(['datastore.table.column.select']),
              },
            },
            posts: {
              actions: new Set(['datastore.table.row.select']),
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
    const results = checkSqlFn("SELECT * FROM users; SELECT * FROM posts", pdp, "abc123");
    expect(results.length).toBe(2);
    expect(results[0]?.allowed).toBe(true);
    expect(results[1]?.allowed).toBe(true);
  });

})
