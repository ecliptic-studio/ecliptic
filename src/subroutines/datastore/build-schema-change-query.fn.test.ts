import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { buildSchemaChangeQueryFn, type TDatastoreSchemaChange } from "./build-schema-change-query.fn";
import { Database } from "bun:sqlite";

describe("buildSchemaChangeQueryFn", () => {
  let db: Database;

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    db = new Database(":memory:");
  });

  afterEach(() => {
    // Clean up after each test
    db.close();
  });

  describe("add-column", () => {
    test("should generate and execute ADD COLUMN query for TEXT type", () => {
      // Create initial table
      db.run("CREATE TABLE users (id INTEGER PRIMARY KEY)");

      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "users",
        column: "email",
        db_type: "TEXT",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "users" ADD COLUMN "email" TEXT;');
      expect(result.rollback).toBe('ALTER TABLE "users" DROP COLUMN "email";');

      // Execute the query and verify it works
      expect(() => db.run(result.query)).not.toThrow();

      // Verify column was added
      db.run("INSERT INTO users (id, email) VALUES (1, 'test@example.com')");
      const row = db.query("SELECT id, email FROM users WHERE id = 1").get() as any;
      expect(row.email).toBe("test@example.com");
    });

    test("should generate and execute ADD COLUMN query for INTEGER type", () => {
      db.run("CREATE TABLE products (id INTEGER PRIMARY KEY)");

      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "products",
        column: "quantity",
        db_type: "INTEGER",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "products" ADD COLUMN "quantity" INTEGER;');
      expect(result.rollback).toBe('ALTER TABLE "products" DROP COLUMN "quantity";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();
      db.run("INSERT INTO products (id, quantity) VALUES (1, 42)");
      const row = db.query("SELECT quantity FROM products WHERE id = 1").get() as any;
      expect(row.quantity).toBe(42);
    });

    test("should generate and execute ADD COLUMN query for REAL type", () => {
      db.run("CREATE TABLE orders (id INTEGER PRIMARY KEY)");

      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "orders",
        column: "price",
        db_type: "REAL",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "orders" ADD COLUMN "price" REAL;');
      expect(result.rollback).toBe('ALTER TABLE "orders" DROP COLUMN "price";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();
      db.run("INSERT INTO orders (id, price) VALUES (1, 19.99)");
      const row = db.query("SELECT price FROM orders WHERE id = 1").get() as any;
      expect(row.price).toBeCloseTo(19.99);
    });

    test("should generate and execute ADD COLUMN query for BLOB type", () => {
      db.run("CREATE TABLE files (id INTEGER PRIMARY KEY)");

      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "files",
        column: "data",
        db_type: "BLOB",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "files" ADD COLUMN "data" BLOB;');
      expect(result.rollback).toBe('ALTER TABLE "files" DROP COLUMN "data";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();
      const blobData = new Uint8Array([1, 2, 3, 4, 5]);
      db.run("INSERT INTO files (id, data) VALUES (?, ?)", [1, blobData]);
      const row = db.query("SELECT data FROM files WHERE id = 1").get() as any;
      expect(row.data).toEqual(blobData);
    });

    test("should handle and execute query for table names with special characters", () => {
      db.run('CREATE TABLE "my-table" (id INTEGER PRIMARY KEY)');

      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "my-table",
        column: "my-column",
        db_type: "TEXT",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "my-table" ADD COLUMN "my-column" TEXT;');
      expect(result.rollback).toBe('ALTER TABLE "my-table" DROP COLUMN "my-column";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();
      db.run('INSERT INTO "my-table" (id, "my-column") VALUES (1, \'test\')');
      const row = db.query('SELECT "my-column" FROM "my-table" WHERE id = 1').get() as any;
      expect(row["my-column"]).toBe("test");
    });

    test("should handle and execute query for foreign key constraints", () => {
      db.run('CREATE TABLE "users" (id INTEGER PRIMARY KEY, name TEXT)');
      db.run('CREATE TABLE "orders" (id INTEGER PRIMARY KEY)');
      db.run('INSERT INTO "users" (id, name) VALUES (1, \'John Doe\')');

      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "orders",
        column: "user_id",
        db_type: "INTEGER",
        foreign_key: {
          table: "users",
          column: "id",
        },
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "orders" ADD COLUMN "user_id" INTEGER REFERENCES "users"(id);');
      expect(result.rollback).toBe('ALTER TABLE "orders" DROP COLUMN "user_id";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();
      db.run('INSERT INTO "orders" (id, user_id) VALUES (1, 1)');
      const row = db.query('SELECT name FROM "orders" join "users" on "orders".user_id = "users".id WHERE "orders".id = 1').get() as any;
      expect(row.name).toBe("John Doe");
    });
  });

  describe("drop-column", () => {
    test("should generate and execute DROP COLUMN query", () => {
      db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, old_field TEXT)");
      db.run("INSERT INTO users (id, old_field) VALUES (1, 'test')");

      const args: TDatastoreSchemaChange = {
        type: "drop-column",
        table: "users",
        column: "old_field",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "users" DROP COLUMN "old_field";');
      expect(result.rollback).toBeUndefined();

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      // Verify column was dropped - this should throw or return undefined
      const row = db.query("SELECT id FROM users WHERE id = 1").get() as any;
      expect(row.id).toBe(1);
      expect(row.old_field).toBeUndefined();
    });

    test("should handle and execute query for table names with spaces", () => {
      db.run('CREATE TABLE "my table" (id INTEGER PRIMARY KEY, "my column" TEXT)');

      const args: TDatastoreSchemaChange = {
        type: "drop-column",
        table: "my table",
        column: "my column",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "my table" DROP COLUMN "my column";');
      expect(result.rollback).toBeUndefined();

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();
    });
  });

  describe("rename-column", () => {
    test("should generate and execute RENAME COLUMN query", () => {
      db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
      db.run("INSERT INTO users (id, name) VALUES (1, 'John Doe')");

      const args: TDatastoreSchemaChange = {
        type: "rename-column",
        table: "users",
        column: "name",
        new_name: "full_name",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "users" RENAME COLUMN "name" TO "full_name";');
      expect(result.rollback).toBe('ALTER TABLE "users" RENAME COLUMN "full_name" TO "name";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      // Verify column was renamed
      const row = db.query("SELECT full_name FROM users WHERE id = 1").get() as any;
      expect(row.full_name).toBe("John Doe");
    });

    test("should handle and execute query for columns with underscores", () => {
      db.run("CREATE TABLE products (id INTEGER PRIMARY KEY, product_id TEXT)");
      db.run("INSERT INTO products (id, product_id) VALUES (1, 'PROD-123')");

      const args: TDatastoreSchemaChange = {
        type: "rename-column",
        table: "products",
        column: "product_id",
        new_name: "sku_id",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "products" RENAME COLUMN "product_id" TO "sku_id";');
      expect(result.rollback).toBe('ALTER TABLE "products" RENAME COLUMN "sku_id" TO "product_id";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      const row = db.query("SELECT sku_id FROM products WHERE id = 1").get() as any;
      expect(row.sku_id).toBe("PROD-123");
    });

    test("should handle and execute query for special characters in column names", () => {
      db.run('CREATE TABLE data (id INTEGER PRIMARY KEY, "old-name" TEXT)');
      db.run('INSERT INTO data (id, "old-name") VALUES (1, \'value\')');

      const args: TDatastoreSchemaChange = {
        type: "rename-column",
        table: "data",
        column: "old-name",
        new_name: "new-name",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "data" RENAME COLUMN "old-name" TO "new-name";');
      expect(result.rollback).toBe('ALTER TABLE "data" RENAME COLUMN "new-name" TO "old-name";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      const row = db.query('SELECT "new-name" FROM data WHERE id = 1').get() as any;
      expect(row["new-name"]).toBe("value");
    });
  });

  describe("rename-table", () => {
    test("should generate and execute RENAME TABLE query", () => {
      db.run("CREATE TABLE old_table (id INTEGER PRIMARY KEY, value TEXT)");
      db.run("INSERT INTO old_table (id, value) VALUES (1, 'test')");

      const args: TDatastoreSchemaChange = {
        type: "rename-table",
        table: "old_table",
        new_name: "new_table",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "old_table" RENAME TO "new_table";');
      expect(result.rollback).toBe('ALTER TABLE "new_table" RENAME TO "old_table";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      // Verify table was renamed
      const row = db.query("SELECT value FROM new_table WHERE id = 1").get() as any;
      expect(row.value).toBe("test");
    });

    test("should handle and execute query for table names with hyphens", () => {
      db.run('CREATE TABLE "old-table-name" (id INTEGER PRIMARY KEY)');

      const args: TDatastoreSchemaChange = {
        type: "rename-table",
        table: "old-table-name",
        new_name: "new-table-name",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "old-table-name" RENAME TO "new-table-name";');
      expect(result.rollback).toBe('ALTER TABLE "new-table-name" RENAME TO "old-table-name";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      // Verify new table exists
      const count = db.query('SELECT COUNT(*) as count FROM "new-table-name"').get() as any;
      expect(count.count).toBe(0);
    });

    test("should handle and execute query for table names with numbers", () => {
      db.run("CREATE TABLE table_v1 (id INTEGER PRIMARY KEY, version INTEGER)");
      db.run("INSERT INTO table_v1 (id, version) VALUES (1, 1)");

      const args: TDatastoreSchemaChange = {
        type: "rename-table",
        table: "table_v1",
        new_name: "table_v2",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "table_v1" RENAME TO "table_v2";');
      expect(result.rollback).toBe('ALTER TABLE "table_v2" RENAME TO "table_v1";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      const row = db.query("SELECT version FROM table_v2 WHERE id = 1").get() as any;
      expect(row.version).toBe(1);
    });
  });

  describe("add-table", () => {
    test("should generate and execute CREATE TABLE query for table with _id column", () => {
      const args: TDatastoreSchemaChange = {
        type: "add-table",
        table: "users",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('CREATE TABLE "users" (_id INTEGER PRIMARY KEY AUTOINCREMENT);');
      expect(result.rollback).toBe('DROP TABLE "users";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      // Verify table exists
      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      ).all();
      expect(tables).toHaveLength(1);
      expect((tables[0] as any).name).toBe("users");

      // Verify table has no data rows
      const count = db.query("SELECT COUNT(*) as count FROM users").get() as any;
      expect(count.count).toBe(0);

      // Verify _id column exists
      db.run("INSERT INTO users (_id) VALUES (1)");
      const row = db.query("SELECT _id FROM users WHERE _id = 1").get() as any;
      expect(row._id).toBe(1);
    });

    test("should handle and execute table names with special characters", () => {
      const args: TDatastoreSchemaChange = {
        type: "add-table",
        table: "my-special-table",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('CREATE TABLE "my-special-table" (_id INTEGER PRIMARY KEY AUTOINCREMENT);');
      expect(result.rollback).toBe('DROP TABLE "my-special-table";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='my-special-table'"
      ).all();
      expect(tables).toHaveLength(1);
    });

    test("should handle table names with underscores and numbers", () => {
      const args: TDatastoreSchemaChange = {
        type: "add-table",
        table: "data_table_v2",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('CREATE TABLE "data_table_v2" (_id INTEGER PRIMARY KEY AUTOINCREMENT);');
      expect(result.rollback).toBe('DROP TABLE "data_table_v2";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='data_table_v2'"
      ).all();
      expect(tables).toHaveLength(1);
    });

    test("should handle table names with spaces", () => {
      const args: TDatastoreSchemaChange = {
        type: "add-table",
        table: "my table name",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('CREATE TABLE "my table name" (_id INTEGER PRIMARY KEY AUTOINCREMENT);');
      expect(result.rollback).toBe('DROP TABLE "my table name";');

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='my table name'"
      ).all();
      expect(tables).toHaveLength(1);
    });

    test("should allow adding columns to the created empty table", () => {
      // First create the table
      const createArgs: TDatastoreSchemaChange = {
        type: "add-table",
        table: "products",
      };
      db.run(buildSchemaChangeQueryFn(createArgs).query);

      // Then add a column
      const addColumnArgs: TDatastoreSchemaChange = {
        type: "add-column",
        table: "products",
        column: "name",
        db_type: "TEXT",
      };
      const addColumnQuery = buildSchemaChangeQueryFn(addColumnArgs).query;

      expect(() => db.run(addColumnQuery)).not.toThrow();

      // Verify we can insert and query data
      db.run("INSERT INTO products (name) VALUES ('Product 1')");
      const row = db.query("SELECT name FROM products").get() as any;
      expect(row.name).toBe("Product 1");
    });
  });

  describe("drop-table", () => {
    test("should generate and execute DROP TABLE query", () => {
      // Create table first
      db.run("CREATE TABLE temp_table (id INTEGER PRIMARY KEY, value TEXT)");
      db.run("INSERT INTO temp_table (id, value) VALUES (1, 'test')");

      const args: TDatastoreSchemaChange = {
        type: "drop-table",
        table: "temp_table",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('DROP TABLE "temp_table";');
      expect(result.rollback).toBeUndefined();

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      // Verify table no longer exists
      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='temp_table'"
      ).all();
      expect(tables).toHaveLength(0);
    });

    test("should handle and execute table names with hyphens", () => {
      db.run('CREATE TABLE "test-table" (id INTEGER PRIMARY KEY)');

      const args: TDatastoreSchemaChange = {
        type: "drop-table",
        table: "test-table",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('DROP TABLE "test-table";');
      expect(result.rollback).toBeUndefined();

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test-table'"
      ).all();
      expect(tables).toHaveLength(0);
    });

    test("should handle table names with spaces", () => {
      db.run('CREATE TABLE "my old table" (id INTEGER PRIMARY KEY)');

      const args: TDatastoreSchemaChange = {
        type: "drop-table",
        table: "my old table",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('DROP TABLE "my old table";');
      expect(result.rollback).toBeUndefined();

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='my old table'"
      ).all();
      expect(tables).toHaveLength(0);
    });

    test("should drop table with data without errors", () => {
      db.run("CREATE TABLE data_table (id INTEGER, name TEXT, value REAL)");
      db.run("INSERT INTO data_table VALUES (1, 'test1', 1.5)");
      db.run("INSERT INTO data_table VALUES (2, 'test2', 2.5)");
      db.run("INSERT INTO data_table VALUES (3, 'test3', 3.5)");

      const args: TDatastoreSchemaChange = {
        type: "drop-table",
        table: "data_table",
      };

      const result = buildSchemaChangeQueryFn(args);

      // Execute and verify
      expect(() => db.run(result.query)).not.toThrow();

      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='data_table'"
      ).all();
      expect(tables).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    test("should handle empty string table names", () => {
      const args: TDatastoreSchemaChange = {
        type: "rename-table",
        table: "",
        new_name: "new_table",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "" RENAME TO "new_table";');
      expect(result.rollback).toBe('ALTER TABLE "new_table" RENAME TO "";');
    });

    test("should handle empty string column names", () => {
      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "users",
        column: "",
        db_type: "TEXT",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "users" ADD COLUMN "" TEXT;');
      expect(result.rollback).toBe('ALTER TABLE "users" DROP COLUMN "";');
    });

    test("should preserve case sensitivity", () => {
      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "MyTable",
        column: "MyColumn",
        db_type: "TEXT",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "MyTable" ADD COLUMN "MyColumn" TEXT;');
      expect(result.rollback).toBe('ALTER TABLE "MyTable" DROP COLUMN "MyColumn";');
    });
  });

  describe("pure function behavior", () => {
    test("should be deterministic - same input produces same output", () => {
      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "test",
        column: "field",
        db_type: "TEXT",
      };

      const result1 = buildSchemaChangeQueryFn(args);
      const result2 = buildSchemaChangeQueryFn(args);

      expect(result1).toEqual(result2);
    });

    test("should not mutate input arguments", () => {
      const args: TDatastoreSchemaChange = {
        type: "rename-column",
        table: "users",
        column: "old",
        new_name: "new",
      };

      const argsCopy = { ...args };
      buildSchemaChangeQueryFn(args);

      expect(args).toEqual(argsCopy);
    });

    test("should handle multiple calls with different inputs", () => {
      const args1: TDatastoreSchemaChange = {
        type: "add-column",
        table: "table1",
        column: "col1",
        db_type: "TEXT",
      };

      const args2: TDatastoreSchemaChange = {
        type: "drop-column",
        table: "table2",
        column: "col2",
      };

      const result1 = buildSchemaChangeQueryFn(args1);
      const result2 = buildSchemaChangeQueryFn(args2);

      expect(result1.query).toBe('ALTER TABLE "table1" ADD COLUMN "col1" TEXT;');
      expect(result2.query).toBe('ALTER TABLE "table2" DROP COLUMN "col2";');
    });
  });

  describe("SQL injection prevention", () => {
    test("should quote identifiers to prevent SQL injection", () => {
      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: 'users"; DROP TABLE users; --',
        column: "email",
        db_type: "TEXT",
      };

      const result = buildSchemaChangeQueryFn(args);

      // The quotes protect against injection by treating the entire string as a table name
      expect(result.query).toBe('ALTER TABLE "users"; DROP TABLE users; --" ADD COLUMN "email" TEXT;');
    });

    test("should handle and execute column names with SQL keywords", () => {
      db.run("CREATE TABLE data (id INTEGER PRIMARY KEY)");

      const args: TDatastoreSchemaChange = {
        type: "add-column",
        table: "data",
        column: "SELECT",
        db_type: "TEXT",
      };

      const result = buildSchemaChangeQueryFn(args);

      expect(result.query).toBe('ALTER TABLE "data" ADD COLUMN "SELECT" TEXT;');

      // Execute and verify - quoted identifiers protect SQL keywords
      expect(() => db.run(result.query)).not.toThrow();
      db.run('INSERT INTO data (id, "SELECT") VALUES (1, \'value\')');
      const row = db.query('SELECT "SELECT" FROM data WHERE id = 1').get() as any;
      expect(row.SELECT).toBe("value");
    });
  });
});
