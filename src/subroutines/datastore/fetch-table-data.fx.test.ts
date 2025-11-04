import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { fetchTableDataFx, type FetchTableDataArgs } from "./fetch-table-data.fx";
import { unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

describe("fetchTableDataFx", () => {
  const datastoresDir = join(process.cwd(), "datastores");
  let testDbFile: string;
  let testDbPath: string;
  let db: Database;

  beforeEach(() => {
    // Create a unique database file for each test to avoid conflicts
    testDbFile = `test-fetch-data-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`;
    testDbPath = join(datastoresDir, testDbFile);

    // Ensure datastores directory exists
    if (!existsSync(datastoresDir)) {
      mkdirSync(datastoresDir, { recursive: true });
    }

    // Create a test database with sample data
    db = new Database(testDbPath);

    // Create a test table with data
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER,
        status TEXT
      )
    `);

    // Insert test data
    db.run(`INSERT INTO users (id, name, email, age, status) VALUES (1, 'Alice', 'alice@example.com', 25, 'active')`);
    db.run(`INSERT INTO users (id, name, email, age, status) VALUES (2, 'Bob', 'bob@example.com', 30, 'active')`);
    db.run(`INSERT INTO users (id, name, email, age, status) VALUES (3, 'Charlie', 'charlie@example.com', 35, 'inactive')`);
    db.run(`INSERT INTO users (id, name, email, age, status) VALUES (4, 'Diana', 'diana@example.com', 28, 'active')`);
    db.run(`INSERT INTO users (id, name, email, age, status) VALUES (5, 'Eve', 'eve@example.com', 22, 'pending')`);

    // Don't close the database - keep it open for the tests
  });

  afterEach(() => {
    // Close the database
    try {
      db.close();
    } catch (e) {
      // Ignore if already closed
    }

    // Clean up test database and WAL files
    try {
      unlinkSync(testDbPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }
    try {
      unlinkSync(`${testDbPath}-shm`);
    } catch (e) {
      // Ignore if file doesn't exist
    }
    try {
      unlinkSync(`${testDbPath}-wal`);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  describe("basic query execution", () => {
    test("fetches all data with default parameters", () => {
      const args: FetchTableDataArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
      };

      const [result, error, rollbacks] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(5);
      expect(result!.columns).toEqual(["id", "name", "email", "age", "status", "_rowid"]);
      expect(result!.data[0]).toHaveProperty("_rowid");
      expect(rollbacks).toBeDefined();
    });

    test("fetches data with column selection", () => {
      const args: FetchTableDataArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        columns: ["id", "name", "email"],
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(5);
      expect(result!.columns).toEqual(["id", "name", "email", "_rowid"]);
      expect(result!.data[0]).toHaveProperty("id");
      expect(result!.data[0]).toHaveProperty("name");
      expect(result!.data[0]).toHaveProperty("email");
      expect(result!.data[0]).toHaveProperty("_rowid");
      expect(result!.data[0]).not.toHaveProperty("age");
    });
  });

  describe("filtering", () => {
    test("filters with eq operator", () => {
      const args: FetchTableDataArgs = {
        tableName: "users",
        filters: [{ column: "status", operator: "eq", value: "active" }],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(3);
      expect(result!.data.every(row => row.status === "active")).toBe(true);
    });

    test("filters with gte operator", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [{ column: "age", operator: "gte", value: 30 }],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(2);
      expect(result!.data.every(row => row.age >= 30)).toBe(true);
    });

    test("filters with like operator", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [{ column: "email", operator: "like", value: "%@example.com" }],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(5);
    });

    test("filters with in operator", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [{ column: "status", operator: "in", value: ["active", "pending"] }],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(4);
    });

    test("filters with multiple conditions", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [
          { column: "status", operator: "eq", value: "active" },
          { column: "age", operator: "gte", value: 28 },
        ],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(2);
      expect(result!.data.every(row => row.status === "active" && row.age >= 28)).toBe(true);
    });
  });

  describe("sorting", () => {
    test("sorts by single column ascending", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [],
        sort: [{ column: "age", direction: "ASC" }],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(5);
      expect(result!.data[0]?.age).toBe(22);
      expect(result!.data[4]?.age).toBe(35);
    });

    test("sorts by single column descending", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [],
        sort: [{ column: "age", direction: "DESC" }],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(5);
      expect(result!.data[0]?.age).toBe(35);
      expect(result!.data[4]?.age).toBe(22);
    });

    test("sorts by multiple columns", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [],
        sort: [
          { column: "status", direction: "ASC" },
          { column: "age", direction: "DESC" },
        ],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(5);
    });
  });

  describe("pagination", () => {
    test("returns pageSize + 1 rows when more data exists", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [],
        pageSize: 2,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(2); // pageSize
    });

    test("handles offset correctly", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [],
        sort: [{ column: "id", direction: "ASC" }],
        pageSize: 2,
        offset: 2,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data[0]?.id).toBe(3);
    });

    test("returns fewer rows when reaching end", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [],
        pageSize: 10,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(5); // Less than pageSize + 1
    });
  });

  describe("combined features", () => {
    test("handles filters + sorting + pagination + column selection", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [{ column: "status", operator: "eq", value: "active" }],
        sort: [{ column: "age", direction: "DESC" }],
        pageSize: 2,
        offset: 0,
        columns: ["id", "name", "age"],
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(2); // pageSize
      expect(result!.columns).toEqual(["id", "name", "age", "_rowid"]);
      expect(result!.data[0]?.age).toBe(30); // Bob (highest age among active users)
    });
  });

  describe("error handling", () => {
    test("returns error for non-existent table", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "nonexistent",
        filters: [],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error!.code).toBe("SR.DATASTORE.QUERY_BUILD.FAILED");
    });

    // Note: Test for non-existent database file is not applicable anymore
    // since we now accept an open database connection from the controller

    test("returns error for invalid column in filter", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [{ column: "invalid_column", operator: "eq", value: "test" }],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error!.code).toBe("SR.DATASTORE.QUERY_BUILD.FAILED");
    });

    test("returns error for invalid column in sort", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [],
        sort: [{ column: "invalid_column", direction: "ASC" }],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error!.code).toBe("SR.DATASTORE.QUERY_BUILD.FAILED");
    });

    test("returns error for invalid column in columns", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        columns: ["id", "invalid_column"],
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error!.code).toBe("SR.DATASTORE.QUERY_BUILD.FAILED");
    });
  });

  describe("rowid column", () => {
    test("includes _rowid in all result rows", () => {
      const args: FetchTableDataArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(5);

      // Check that every row has _rowid
      result!.data.forEach((row) => {
        expect(row).toHaveProperty("_rowid");
        expect(typeof row._rowid).toBe("number");
        expect(row._rowid).toBeGreaterThan(0);
      });

      // Check that _rowid is in columns
      expect(result!.columns).toContain("_rowid");
    });

    test("includes _rowid with field selection", () => {
      const args: FetchTableDataArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        columns: ["id", "name"],
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();

      // Check that every row has _rowid even with field selection
      result!.data.forEach((row) => {
        expect(row).toHaveProperty("_rowid");
        expect(row).toHaveProperty("id");
        expect(row).toHaveProperty("name");
        expect(row).not.toHaveProperty("email");
        expect(row).not.toHaveProperty("age");
      });

      // Check that columns includes _rowid
      expect(result!.columns).toEqual(["id", "name", "_rowid"]);
    });
  });

  describe("edge cases", () => {
    test("handles empty result set", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [{ column: "status", operator: "eq", value: "nonexistent" }],
        pageSize: 50,
        offset: 0,
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(0);
      expect(result!.columns).toBeDefined();
    });

    test("handles empty result set with field selection", () => {
      const args: FetchTableDataArgs = {
        
        tableName: "users",
        filters: [{ column: "status", operator: "eq", value: "nonexistent" }],
        pageSize: 50,
        offset: 0,
        columns: ["id", "name"],
      };

      const [result, error] = fetchTableDataFx({ db }, args);

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result!.data).toHaveLength(0);
      expect(result!.columns).toEqual(["id", "name", "_rowid"]);
    });
  });
});
