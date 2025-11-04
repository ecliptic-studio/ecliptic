import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import Database from "bun:sqlite";
import { insertTableRowsTx } from "./insert-table-rows.tx";
import { ErrorCode } from "@server/error/error-code.enum";

describe("insertTableRowsTx", () => {
  let db: Database;

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    db = new Database(":memory:");
  });

  afterEach(() => {
    // Clean up after each test
    db.close();
  });

  describe("successful inserts", () => {
    test("should insert a single row into a table", () => {
      // Create a test table
      db.run(`
        CREATE TABLE users (
          name TEXT,
          email TEXT,
          age INTEGER
        );
      `);

      // Insert a single row
      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        {
          tableName: "users",
          rows: [
            { name: "Alice", email: "alice@example.com", age: 30 }
          ]
        }
      );

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result?.inserted).toBe(1);
      expect(result?.rows).toHaveLength(1);
      expect(result?.rows[0]).toMatchObject({
        name: "Alice",
        email: "alice@example.com",
        age: 30
      });
      expect(result?.rows[0]?.rowid).toBeDefined();
      expect(rollbacks).toBeArray();
    });

    test("should insert multiple rows in a single transaction", () => {
      // Create a test table
      db.run(`
        CREATE TABLE products (
          name TEXT,
          price REAL,
          stock INTEGER
        );
      `);

      // Insert multiple rows
      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        {
          tableName: "products",
          rows: [
            { name: "Product A", price: 19.99, stock: 100 },
            { name: "Product B", price: 29.99, stock: 50 },
            { name: "Product C", price: 9.99, stock: 200 }
          ]
        }
      );

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result?.inserted).toBe(3);
      expect(result?.rows).toHaveLength(3);

      // Verify each row
      expect(result?.rows[0]).toMatchObject({
        name: "Product A",
        price: 19.99,
        stock: 100
      });
      expect(result?.rows[1]).toMatchObject({
        name: "Product B",
        price: 29.99,
        stock: 50
      });
      expect(result?.rows[2]).toMatchObject({
        name: "Product C",
        price: 9.99,
        stock: 200
      });

      // Verify all rows have rowid
      expect(result?.rows.every(row => row.rowid !== undefined)).toBe(true);
      expect(rollbacks).toBeArray();
    });

    test("should handle NULL values in row data", () => {
      db.run(`
        CREATE TABLE nullable_table (
          required TEXT NOT NULL,
          optional TEXT
        );
      `);

      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        {
          tableName: "nullable_table",
          rows: [
            { required: "value1", optional: null },
            { required: "value2" } // Missing optional field
          ]
        }
      );

      expect(error).toBeNull();
      expect(result?.inserted).toBe(2);
      expect(result?.rows[0]?.optional).toBeNull();
      expect(result?.rows[1]?.optional).toBeNull();
    });

    test("should insert rows with different data types", () => {
      db.run(`
        CREATE TABLE data_types (
          text_col TEXT,
          integer_col INTEGER,
          real_col REAL,
          blob_col BLOB
        );
      `);

      const blobData = new Uint8Array([1, 2, 3, 4]);

      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        {
          tableName: "data_types",
          rows: [
            {
              text_col: "hello",
              integer_col: 42,
              real_col: 3.14,
              blob_col: blobData
            }
          ]
        }
      );

      expect(error).toBeNull();
      expect(result?.inserted).toBe(1);
      expect(result?.rows[0]?.text_col).toBe("hello");
      expect(result?.rows[0]?.integer_col).toBe(42);
      expect(result?.rows[0]?.real_col).toBeCloseTo(3.14);
    });

    test("should return inserted rows with ROWID", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        {
          tableName: "test",
          rows: [
            { value: "first" },
            { value: "second" }
          ]
        }
      );

      expect(error).toBeNull();
      expect(result?.rows[0]?.rowid).toBe(1);
      expect(result?.rows[1]?.rowid).toBe(2);
    });

    test("should handle standard table names", () => {
      db.run(`
        CREATE TABLE my_table (
          my_column TEXT
        );
      `);

      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        {
          tableName: "my_table",
          rows: [{ my_column: "test value" }]
        }
      );

      expect(error).toBeNull();
      expect(result?.inserted).toBe(1);
      expect(result?.rows[0]?.my_column).toBe("test value");
    });

    test("should preserve insertion order in returned rows", () => {
      db.run(`CREATE TABLE ordered (id INTEGER, value TEXT);`);

      const rows = [
        { id: 1, value: "first" },
        { id: 2, value: "second" },
        { id: 3, value: "third" }
      ];

      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        { tableName: "ordered", rows }
      );

      expect(error).toBeNull();
      expect(result?.rows[0]?.value).toBe("first");
      expect(result?.rows[1]?.value).toBe("second");
      expect(result?.rows[2]?.value).toBe("third");
    });
  });

  describe("error handling", () => {
    test("should return error when rows array is empty", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        { tableName: "test", rows: [] }
      );

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_INSERT_ROWS_FAILED);
      expect(error?.internal).toContain("No rows provided");
      expect(error?.external?.en).toBe("No rows to insert");
      expect(error?.statusCode).toBe("Bad Request");
      expect(error?.shouldLog).toBe(false);
      expect(rollbacks).toBeArray();
    });

    test("should return error when first row is empty object", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        { tableName: "test", rows: [{}] }
      );

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_INSERT_ROWS_FAILED);
      expect(error?.internal).toContain("no columns");
      expect(error?.external?.en).toContain("no columns");
      expect(error?.statusCode).toBe("Bad Request");
      expect(rollbacks).toBeArray();
    });

    test("should return error when table does not exist", () => {
      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        {
          tableName: "nonexistent_table",
          rows: [{ value: "test" }]
        }
      );

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_INSERT_ROWS_FAILED);
      expect(error?.internal).toContain("Failed to insert rows");
      expect(error?.external?.en).toBe("Failed to insert rows");
      expect(error?.statusCode).toBe("Internal Server Error");
      expect(error?.shouldLog).toBe(true);
      expect(rollbacks).toBeArray();
    });

    test("should return error when column does not exist in table", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        {
          tableName: "test",
          rows: [{ nonexistent_column: "test" }]
        }
      );

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_INSERT_ROWS_FAILED);
      expect(error?.statusCode).toBe("Internal Server Error");
      expect(rollbacks).toBeArray();
    });

    test("should return error when constraint violation occurs", () => {
      db.run(`
        CREATE TABLE test (
          id INTEGER PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      // First insert should succeed
      const [result1, error1] = insertTableRowsTx(
        { db },
        { tableName: "test", rows: [{ id: 1, value: "test" }] }
      );
      expect(error1).toBeNull();

      // Second insert with same ID should fail (primary key violation)
      const [result2, error2, rollbacks2] = insertTableRowsTx(
        { db },
        { tableName: "test", rows: [{ id: 1, value: "duplicate" }] }
      );

      expect(result2).toBeNull();
      expect(error2).toBeDefined();
      expect(error2?.code).toBe(ErrorCode.SR_DATASTORE_INSERT_ROWS_FAILED);
      expect(error2?.statusCode).toBe("Internal Server Error");
      expect(rollbacks2).toBeArray();
    });

    test("should rollback all inserts if one fails in transaction", () => {
      db.run(`
        CREATE TABLE test (
          id INTEGER PRIMARY KEY,
          value TEXT
        );
      `);

      // Insert a row first
      db.run(`INSERT INTO test (id, value) VALUES (2, 'existing')`);

      // Try to insert multiple rows where one conflicts
      const [result, error, rollbacks] = insertTableRowsTx(
        { db },
        {
          tableName: "test",
          rows: [
            { id: 1, value: "first" },
            { id: 2, value: "duplicate" }, // This will fail
            { id: 3, value: "third" }
          ]
        }
      );

      expect(result).toBeNull();
      expect(error).toBeDefined();

      // Verify that none of the new rows were inserted (transaction rollback)
      const count = db.query(`SELECT COUNT(*) as count FROM test WHERE id IN (1, 3)`).get() as { count: number };
      expect(count.count).toBe(0);
    });
  });

  describe("TErrTriple pattern compliance", () => {
    test("should return [data, null, rollbacks] on success", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const [data, error, rollbacks] = insertTableRowsTx(
        { db },
        { tableName: "test", rows: [{ value: "test" }] }
      );

      expect(data).not.toBeNull();
      expect(error).toBeNull();
      expect(rollbacks).toBeArray();
    });

    test("should return [null, error, rollbacks] on failure", () => {
      const [data, error, rollbacks] = insertTableRowsTx(
        { db },
        { tableName: "nonexistent", rows: [{ value: "test" }] }
      );

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(rollbacks).toBeArray();
    });

    test("should always return rollbacks array even when empty", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const [, , rollbacks] = insertTableRowsTx(
        { db },
        { tableName: "test", rows: [{ value: "test" }] }
      );

      expect(rollbacks).toBeArray();
      expect(Array.isArray(rollbacks)).toBe(true);
    });
  });

  describe("portal pattern compliance", () => {
    test("should accept database through portal parameter", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const portal = { db };
      const args = { tableName: "test", rows: [{ value: "test" }] };

      const [result, error] = insertTableRowsTx(portal, args);

      expect(error).toBeNull();
      expect(result?.inserted).toBe(1);
    });

    test("should only use database from portal, not external db", () => {
      const testDb = new Database(":memory:");
      testDb.run(`CREATE TABLE test (value TEXT);`);

      const [result, error] = insertTableRowsTx(
        { db: testDb },
        { tableName: "test", rows: [{ value: "test" }] }
      );

      expect(error).toBeNull();
      expect(result?.inserted).toBe(1);

      // Verify data exists in testDb
      const count = testDb.query(`SELECT COUNT(*) as count FROM test`).get() as { count: number };
      expect(count.count).toBe(1);

      testDb.close();
    });
  });

  describe("transaction atomicity", () => {
    test("should use transaction for bulk inserts", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      // Prepare multiple rows
      const rows = Array.from({ length: 100 }, (_, i) => ({
        value: `row-${i}`
      }));

      const [result, error] = insertTableRowsTx(
        { db },
        { tableName: "test", rows }
      );

      expect(error).toBeNull();
      expect(result?.inserted).toBe(100);

      // Verify all rows were inserted
      const count = db.query(`SELECT COUNT(*) as count FROM test`).get() as { count: number };
      expect(count.count).toBe(100);
    });

    test("should ensure all-or-nothing behavior in transaction", () => {
      db.run(`
        CREATE TABLE test (
          id INTEGER PRIMARY KEY,
          value TEXT
        );
      `);

      // Pre-insert a conflicting row
      db.run(`INSERT INTO test (id, value) VALUES (50, 'existing')`);

      // Try to insert 100 rows, where one (id=50) will conflict
      const rows = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: `row-${i}`
      }));

      const [result, error] = insertTableRowsTx(
        { db },
        { tableName: "test", rows }
      );

      expect(result).toBeNull();
      expect(error).toBeDefined();

      // Verify that ONLY the pre-existing row remains (all new inserts rolled back)
      const count = db.query(`SELECT COUNT(*) as count FROM test`).get() as { count: number };
      expect(count.count).toBe(1);

      const existingRow = db.query(`SELECT * FROM test WHERE id = 50`).get() as { value: string };
      expect(existingRow.value).toBe("existing");
    });
  });

  describe("edge cases", () => {
    test("should handle rows with extra columns not in table", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      // Row has an extra column that doesn't exist in the table
      const [result, error] = insertTableRowsTx(
        { db },
        {
          tableName: "test",
          rows: [{ value: "test", extra_column: "ignored" }]
        }
      );

      // Should fail because the query tries to insert all columns from the first row
      expect(result).toBeNull();
      expect(error).toBeDefined();
    });

    test("should handle very long text values", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const longText = "a".repeat(10000);
      const [result, error] = insertTableRowsTx(
        { db },
        { tableName: "test", rows: [{ value: longText }] }
      );

      expect(error).toBeNull();
      expect(result?.rows[0]?.value).toBe(longText);
    });

    test("should handle special characters in column values", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const specialChars = "'; DROP TABLE test; --";
      const [result, error] = insertTableRowsTx(
        { db },
        { tableName: "test", rows: [{ value: specialChars }] }
      );

      expect(error).toBeNull();
      expect(result?.rows[0]?.value).toBe(specialChars);

      // Verify table still exists (SQL injection prevention)
      const tableExists = db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='test'`).get();
      expect(tableExists).toBeDefined();
    });

    test("should handle unicode characters", () => {
      db.run(`CREATE TABLE test (value TEXT);`);

      const unicodeText = "Hello 世界 🌍 مرحبا";
      const [result, error] = insertTableRowsTx(
        { db },
        { tableName: "test", rows: [{ value: unicodeText }] }
      );

      expect(error).toBeNull();
      expect(result?.rows[0]?.value).toBe(unicodeText);
    });

    test("should handle boolean values as integers", () => {
      db.run(`CREATE TABLE test (flag INTEGER);`);

      const [result, error] = insertTableRowsTx(
        { db },
        {
          tableName: "test",
          rows: [
            { flag: true },
            { flag: false }
          ]
        }
      );

      expect(error).toBeNull();
      expect(result?.rows[0]?.flag).toBe(1);
      expect(result?.rows[1]?.flag).toBe(0);
    });
  });
});
