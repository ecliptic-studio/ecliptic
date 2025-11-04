import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import Database from "bun:sqlite";
import { deleteTableRowsTx } from "./delete-table-rows.tx";
import { ErrorCode } from "@server/error/error-code.enum";

describe("deleteTableRowsTx", () => {
  let db: Database;

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    db = new Database(":memory:");
  });

  afterEach(() => {
    // Clean up after each test
    db.close();
  });

  describe("successful deletes", () => {
    test("should delete a single row by ROWID", () => {
      db.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT,
          email TEXT
        );
      `);

      // Insert test data
      db.run(`INSERT INTO users VALUES (1, 'Alice', 'alice@example.com')`);
      db.run(`INSERT INTO users VALUES (2, 'Bob', 'bob@example.com')`);

      const [result, error, rollbacks] = deleteTableRowsTx(
        { db },
        {
          tableName: 'users',
          rowids: [1]
        }
      );

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result?.deleted).toBe(1);
      expect(rollbacks).toBeArray();

      // Verify deletion
      const remaining = db.query('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(remaining.count).toBe(1);

      const row = db.query('SELECT * FROM users WHERE id = 2').get();
      expect(row).toBeDefined();
    });

    test("should delete multiple rows by ROWID", () => {
      db.run(`CREATE TABLE products (id INTEGER, price REAL);`);

      // Insert test data
      db.run(`INSERT INTO products VALUES (1, 10.0), (2, 20.0), (3, 30.0), (4, 40.0)`);

      // Get ROWIDs for rows with price >= 25
      const rowsToDelete = db.query('SELECT rowid FROM products WHERE price >= 25.0').all() as { rowid: number }[];
      const rowids = rowsToDelete.map(r => r.rowid);

      const [result, error, rollbacks] = deleteTableRowsTx(
        { db },
        {
          tableName: 'products',
          rowids
        }
      );

      expect(error).toBeNull();
      expect(result?.deleted).toBe(2); // IDs 3 and 4

      // Verify remaining rows
      const remaining = db.query('SELECT COUNT(*) as count FROM products').get() as { count: number };
      expect(remaining.count).toBe(2);
    });

    test("should delete rows with large IN list", () => {
      db.run(`CREATE TABLE numbers (id INTEGER, value INTEGER);`);

      // Insert 100 rows
      const ids = Array.from({ length: 100 }, (_, i) => i + 1);
      for (const id of ids) {
        db.run(`INSERT INTO numbers VALUES (?, ?)`, [id, id * 10]);
      }

      // Get ROWIDs to delete
      const toDelete = [1, 10, 25, 50, 75, 99];
      const rowsToDelete = db.query('SELECT rowid FROM numbers WHERE id IN (1, 10, 25, 50, 75, 99)').all() as { rowid: number }[];
      const rowids = rowsToDelete.map(r => r.rowid);

      const [result, error] = deleteTableRowsTx(
        { db },
        {
          tableName: 'numbers',
          rowids
        }
      );

      expect(error).toBeNull();
      expect(result?.deleted).toBe(6);

      const remaining = db.query('SELECT COUNT(*) as count FROM numbers').get() as { count: number };
      expect(remaining.count).toBe(94);
    });

    test("should return 0 when no rowids match", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'a'), (2, 'b')`);

      const [result, error] = deleteTableRowsTx({ db }, {
        tableName: 'test',
        rowids: [999, 1000]  // Non-existent ROWIDs
      });

      expect(error).toBeNull();
      expect(result?.deleted).toBe(0);

      // Verify all original data remains
      const count = db.query('SELECT COUNT(*) as count FROM test').get() as { count: number };
      expect(count.count).toBe(2);
    });
  });

  describe("error handling", () => {
    test("should return error when rowids array is empty", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);

      const [result, error, rollbacks] = deleteTableRowsTx({ db }, {
        tableName: 'test',
        rowids: []
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_DELETE_ROWS_FAILED);
      expect(error?.internal).toContain('rowids array required');
      expect(error?.external?.en).toContain('requires at least one ROWID');
      expect(error?.statusCode).toBe('Bad Request');
      expect(error?.shouldLog).toBe(false);
      expect(rollbacks).toBeArray();
    });

    test("should return error for invalid table name", () => {
      const [result, error] = deleteTableRowsTx({ db }, {
        tableName: 'invalid;DROP TABLE',
        rowids: [1]
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_DELETE_ROWS_FAILED);
      expect(error?.internal).toContain('Invalid table name');
    });

    test("should return error when table does not exist", () => {
      const [result, error] = deleteTableRowsTx({ db }, {
        tableName: 'nonexistent',
        rowids: [1]
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.statusCode).toBe('Internal Server Error');
      expect(error?.shouldLog).toBe(true);
    });
  });

  describe("SQL injection prevention", () => {
    test("should validate table name format", () => {
      db.run(`CREATE TABLE valid_table (id INTEGER);`);

      const invalidTableNames = [
        'table; DROP TABLE users;',
        'table/*comment*/',
        'table--comment',
        '../etc/passwd',
        'table\nDROP'
      ];

      for (const tableName of invalidTableNames) {
        const [result, error] = deleteTableRowsTx({ db }, {
          tableName,
          rowids: [1]
        });

        expect(result).toBeNull();
        expect(error).toBeDefined();
      }
    });

    test("should safely handle ROWID values", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'a'), (2, 'b'), (3, 'c')`);

      // Try various ROWID values (they're just numbers, should be safe)
      const [result, error] = deleteTableRowsTx({ db }, {
        tableName: 'test',
        rowids: [1, 2]
      });

      expect(error).toBeNull();
      expect(result?.deleted).toBe(2);

      // Verify table still exists
      const tableExists = db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='test'`).get();
      expect(tableExists).toBeDefined();

      // Verify only the matching rows were deleted
      const remaining = db.query('SELECT COUNT(*) as count FROM test').get() as { count: number };
      expect(remaining.count).toBe(1);
    });
  });

  describe("TErrTriple pattern compliance", () => {
    test("should return [data, null, rollbacks] on success", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'test')`);

      const [data, error, rollbacks] = deleteTableRowsTx({ db }, {
        tableName: 'test',
        rowids: [1]
      });

      expect(data).not.toBeNull();
      expect(error).toBeNull();
      expect(rollbacks).toBeArray();
    });

    test("should return [null, error, rollbacks] on failure", () => {
      const [data, error, rollbacks] = deleteTableRowsTx({ db }, {
        tableName: 'test',
        rowids: []
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(rollbacks).toBeArray();
    });
  });

  describe("portal pattern compliance", () => {
    test("should accept database through portal parameter", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'test')`);

      const portal = { db };
      const args = {
        tableName: 'test',
        rowids: [1]
      };

      const [result, error] = deleteTableRowsTx(portal, args);

      expect(error).toBeNull();
      expect(result?.deleted).toBe(1);
    });

    test("should only use database from portal", () => {
      const testDb = new Database(":memory:");
      testDb.run(`CREATE TABLE test (id INTEGER);`);
      testDb.run(`INSERT INTO test VALUES (1), (2)`);

      const [result] = deleteTableRowsTx(
        { db: testDb },
        {
          tableName: 'test',
          rowids: [1]
        }
      );

      expect(result?.deleted).toBe(1);

      const count = testDb.query('SELECT COUNT(*) as count FROM test').get() as { count: number };
      expect(count.count).toBe(1);

      testDb.close();
    });
  });
});
