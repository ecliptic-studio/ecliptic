import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import Database from "bun:sqlite";
import { updateTableRowsTx } from "./update-table-rows.tx";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TableFilter } from "./build-table-query.fn";

describe("updateTableRowsTx", () => {
  let db: Database;

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    db = new Database(":memory:");
  });

  afterEach(() => {
    // Clean up after each test
    db.close();
  });

  describe("successful updates", () => {
    test("should update a single row with eq filter", () => {
      db.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT,
          email TEXT,
          age INTEGER
        );
      `);

      // Insert test data
      db.run(`INSERT INTO users (id, name, email, age) VALUES (1, 'Alice', 'alice@example.com', 30)`);

      const filters: TableFilter[] = [
        { column: 'id', operator: 'eq', value: 1 }
      ];

      const [result, error, rollbacks] = updateTableRowsTx(
        { db },
        {
          tableName: 'users',
          set: { name: 'Alice Updated', age: 31 },
          where: filters,
          validColumns: ['id', 'name', 'email', 'age']
        }
      );

      expect(error).toBeNull();
      expect(result).toBeDefined();
      expect(result?.updated).toBe(1);
      expect(rollbacks).toBeArray();

      // Verify the update
      const row = db.query('SELECT * FROM users WHERE id = 1').get() as any;
      expect(row.name).toBe('Alice Updated');
      expect(row.age).toBe(31);
      expect(row.email).toBe('alice@example.com'); // Unchanged
    });

    test("should update multiple rows with range filter", () => {
      db.run(`CREATE TABLE products (id INTEGER, price REAL, active INTEGER);`);

      // Insert test data
      db.run(`INSERT INTO products VALUES (1, 10.0, 1), (2, 20.0, 1), (3, 30.0, 1), (4, 40.0, 1)`);

      const filters: TableFilter[] = [
        { column: 'price', operator: 'gte', value: 20.0 }
      ];

      const [result, error, rollbacks] = updateTableRowsTx(
        { db },
        {
          tableName: 'products',
          set: { active: 0 },
          where: filters,
          validColumns: ['id', 'price', 'active']
        }
      );

      expect(error).toBeNull();
      expect(result?.updated).toBe(3); // IDs 2, 3, 4

      // Verify updates
      const activeCount = db.query('SELECT COUNT(*) as count FROM products WHERE active = 1').get() as { count: number };
      expect(activeCount.count).toBe(1); // Only ID 1
    });

    test("should update with multiple AND filters", () => {
      db.run(`CREATE TABLE tasks (id INTEGER, status TEXT, priority INTEGER);`);

      db.run(`INSERT INTO tasks VALUES
        (1, 'pending', 1),
        (2, 'pending', 2),
        (3, 'pending', 3),
        (4, 'completed', 1)`);

      const filters: TableFilter[] = [
        { column: 'status', operator: 'eq', value: 'pending' },
        { column: 'priority', operator: 'gt', value: 1 }
      ];

      const [result, error] = updateTableRowsTx(
        { db },
        {
          tableName: 'tasks',
          set: { status: 'in_progress' },
          where: filters,
          validColumns: ['id', 'status', 'priority']
        }
      );

      expect(error).toBeNull();
      expect(result?.updated).toBe(2); // IDs 2 and 3

      const inProgress = db.query('SELECT id FROM tasks WHERE status = ? ORDER BY id').all('in_progress') as any[];
      expect(inProgress).toHaveLength(2);
      expect(inProgress[0].id).toBe(2);
      expect(inProgress[1].id).toBe(3);
    });

    test("should handle all comparison operators", () => {
      db.run(`CREATE TABLE numbers (id INTEGER, value INTEGER);`);
      db.run(`INSERT INTO numbers VALUES (1, 10), (2, 20), (3, 30), (4, 40), (5, 50)`);

      const validColumns = ['id', 'value'];

      // Test 'ne' (not equal)
      const [r1] = updateTableRowsTx({ db }, {
        tableName: 'numbers',
        set: { value: 99 },
        where: [{ column: 'id', operator: 'ne', value: 1 }],
        validColumns
      });
      expect(r1?.updated).toBe(4);

      // Reset
      db.run(`DELETE FROM numbers`);
      db.run(`INSERT INTO numbers VALUES (1, 10), (2, 20), (3, 30), (4, 40), (5, 50)`);

      // Test 'lt' (less than)
      const [r2] = updateTableRowsTx({ db }, {
        tableName: 'numbers',
        set: { value: 5 },
        where: [{ column: 'value', operator: 'lt', value: 30 }],
        validColumns
      });
      expect(r2?.updated).toBe(2); // 10, 20

      // Reset
      db.run(`DELETE FROM numbers`);
      db.run(`INSERT INTO numbers VALUES (1, 10), (2, 20), (3, 30), (4, 40), (5, 50)`);

      // Test 'lte' (less than or equal)
      const [r3] = updateTableRowsTx({ db }, {
        tableName: 'numbers',
        set: { value: 0 },
        where: [{ column: 'value', operator: 'lte', value: 30 }],
        validColumns
      });
      expect(r3?.updated).toBe(3); // 10, 20, 30
    });

    test("should handle LIKE operator", () => {
      db.run(`CREATE TABLE users (name TEXT, email TEXT);`);
      db.run(`INSERT INTO users VALUES
        ('Alice', 'alice@example.com'),
        ('Bob', 'bob@test.com'),
        ('Charlie', 'charlie@example.com')`);

      const [result] = updateTableRowsTx({ db }, {
        tableName: 'users',
        set: { email: 'updated@example.com' },
        where: [{ column: 'email', operator: 'like', value: '%@example.com' }],
        validColumns: ['name', 'email']
      });

      expect(result?.updated).toBe(2); // Alice and Charlie
    });

    test("should handle IN operator with array", () => {
      db.run(`CREATE TABLE items (id INTEGER, name TEXT, category TEXT);`);
      db.run(`INSERT INTO items VALUES
        (1, 'A', 'cat1'),
        (2, 'B', 'cat2'),
        (3, 'C', 'cat1'),
        (4, 'D', 'cat3')`);

      const [result] = updateTableRowsTx({ db }, {
        tableName: 'items',
        set: { category: 'updated' },
        where: [{ column: 'id', operator: 'in', value: [1, 3, 4] }],
        validColumns: ['id', 'name', 'category']
      });

      expect(result?.updated).toBe(3);

      const updated = db.query('SELECT id FROM items WHERE category = ? ORDER BY id').all('updated') as any[];
      expect(updated.map(r => r.id)).toEqual([1, 3, 4]);
    });

    test("should handle NULL values in SET", () => {
      db.run(`CREATE TABLE nullable (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO nullable VALUES (1, 'test')`);

      const [result] = updateTableRowsTx({ db }, {
        tableName: 'nullable',
        set: { value: null },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(result?.updated).toBe(1);

      const row = db.query('SELECT * FROM nullable WHERE id = 1').get() as any;
      expect(row.value).toBeNull();
    });

    test("should return 0 when no rows match filter", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'a')`);

      const [result, error] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { value: 'updated' },
        where: [{ column: 'id', operator: 'eq', value: 999 }],
        validColumns: ['id', 'value']
      });

      expect(error).toBeNull();
      expect(result?.updated).toBe(0);

      // Verify original data unchanged
      const row = db.query('SELECT * FROM test WHERE id = 1').get() as any;
      expect(row.value).toBe('a');
    });
  });

  describe("error handling", () => {
    test("should return error when SET is empty", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);

      const [result, error, rollbacks] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: {},
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_UPDATE_ROWS_FAILED);
      expect(error?.internal).toContain('No columns provided');
      expect(error?.external?.en).toBe('No columns to update');
      expect(error?.statusCode).toBe('Bad Request');
      expect(error?.shouldLog).toBe(false);
      expect(rollbacks).toBeArray();
    });

    test("should return error when WHERE filters are empty", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);

      const [result, error, rollbacks] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { value: 'new' },
        where: [],
        validColumns: ['id', 'value']
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_UPDATE_ROWS_FAILED);
      expect(error?.internal).toContain('WHERE filters required');
      expect(error?.external?.en).toContain('requires filters');
      expect(error?.statusCode).toBe('Bad Request');
      expect(rollbacks).toBeArray();
    });

    test("should return error for invalid table name", () => {
      const [result, error] = updateTableRowsTx({ db }, {
        tableName: 'invalid;DROP TABLE',
        set: { value: 'test' },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_UPDATE_ROWS_FAILED);
      expect(error?.internal).toContain('Invalid table name');
    });

    test("should return error for invalid column in SET", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);

      const [result, error] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { malicious_column: 'value' },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain('Invalid column name in SET');
    });

    test("should return error for invalid column in WHERE", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);

      const [result, error] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { value: 'new' },
        where: [{ column: 'invalid_column', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain('Invalid column name in WHERE');
    });

    test("should return error when table does not exist", () => {
      const [result, error] = updateTableRowsTx({ db }, {
        tableName: 'nonexistent',
        set: { value: 'new' },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.statusCode).toBe('Internal Server Error');
      expect(error?.shouldLog).toBe(true);
    });

    test("should return error for IN operator with non-array value", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);

      const [result, error] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { value: 'new' },
        where: [{ column: 'id', operator: 'in', value: 'not-an-array' }],
        validColumns: ['id', 'value']
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain('IN operator requires array value');
    });
  });

  describe("SQL injection prevention", () => {
    test("should safely handle SQL injection in column values", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'original')`);

      const maliciousValue = "'; DROP TABLE test; --";

      const [result, error] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { value: maliciousValue },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(error).toBeNull();
      expect(result?.updated).toBe(1);

      // Verify table still exists and value is stored safely
      const row = db.query('SELECT * FROM test WHERE id = 1').get() as any;
      expect(row.value).toBe(maliciousValue);

      const tableExists = db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='test'`).get();
      expect(tableExists).toBeDefined();
    });

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
        const [result, error] = updateTableRowsTx({ db }, {
          tableName,
          set: { id: 1 },
          where: [{ column: 'id', operator: 'eq', value: 1 }],
          validColumns: ['id']
        });

        expect(result).toBeNull();
        expect(error).toBeDefined();
      }
    });
  });

  describe("TErrTriple pattern compliance", () => {
    test("should return [data, null, rollbacks] on success", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'test')`);

      const [data, error, rollbacks] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { value: 'updated' },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(data).not.toBeNull();
      expect(error).toBeNull();
      expect(rollbacks).toBeArray();
    });

    test("should return [null, error, rollbacks] on failure", () => {
      const [data, error, rollbacks] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { value: 'new' },
        where: [],
        validColumns: ['id', 'value']
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
        set: { value: 'updated' },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      };

      const [result, error] = updateTableRowsTx(portal, args);

      expect(error).toBeNull();
      expect(result?.updated).toBe(1);
    });
  });

  describe("edge cases", () => {
    test("should handle multiple columns in SET", () => {
      db.run(`CREATE TABLE test (id INTEGER, a TEXT, b TEXT, c TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'a1', 'b1', 'c1')`);

      const [result] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { a: 'a2', b: 'b2', c: 'c2' },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'a', 'b', 'c']
      });

      expect(result?.updated).toBe(1);

      const row = db.query('SELECT * FROM test WHERE id = 1').get() as any;
      expect(row.a).toBe('a2');
      expect(row.b).toBe('b2');
      expect(row.c).toBe('c2');
    });

    test("should handle unicode characters", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'old')`);

      const unicode = "Hello 世界 🌍 مرحبا";
      const [result] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { value: unicode },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(result?.updated).toBe(1);

      const row = db.query('SELECT * FROM test WHERE id = 1').get() as any;
      expect(row.value).toBe(unicode);
    });

    test("should handle very long text values", () => {
      db.run(`CREATE TABLE test (id INTEGER, value TEXT);`);
      db.run(`INSERT INTO test VALUES (1, 'short')`);

      const longText = 'x'.repeat(10000);
      const [result] = updateTableRowsTx({ db }, {
        tableName: 'test',
        set: { value: longText },
        where: [{ column: 'id', operator: 'eq', value: 1 }],
        validColumns: ['id', 'value']
      });

      expect(result?.updated).toBe(1);

      const row = db.query('SELECT * FROM test WHERE id = 1').get() as any;
      expect(row.value).toBe(longText);
    });
  });
});
