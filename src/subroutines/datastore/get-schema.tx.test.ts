import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import Database from "bun:sqlite";
import { datastoreGetSchemaFx } from "./get-schema.fx";

describe("datastoreGetSchemaTx", () => {
  let db: Database;

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    db = new Database(":memory:");
  });

  afterEach(() => {
    // Clean up after each test
    db.close();
  });

  test("should return schema for a database with single table", () => {
    // Create a test table
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema).toBeDefined();
    expect(schema?.tables).toBeDefined();
    expect(schema?.tables.users).toBeDefined();
    expect(schema?.tables.users?.columns).toBeDefined();

    // Check columns
    expect(schema?.tables.users?.columns.id).toEqual({
      name: "id",
      order: 0,
      db_type: "INTEGER",
      dflt_value: null,
      notnull: false,
      autoincrement: false
    });
    expect(schema?.tables.users?.columns.name).toEqual({
      name: "name",
      order: 1,
      db_type: "TEXT",
      dflt_value: null,
      notnull: false,
      autoincrement: false
    });
    expect(schema?.tables.users?.columns.email).toEqual({
      name: "email",
      order: 2,
      db_type: "TEXT",
      dflt_value: null,
      notnull: false,
      autoincrement: false
    });

  });

  test("should return schema for a database with multiple tables", () => {
    // Create multiple tables
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT
      );
    `);
    db.run(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        title TEXT,
        price REAL
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema).toBeDefined();
    expect(Object.keys(schema?.tables || {}).length).toBe(2);
    expect(schema?.tables.users).toBeDefined();
    expect(schema?.tables.products).toBeDefined();

    // Check users table
    expect(Object.keys(schema?.tables.users?.columns || {}).length).toBe(2);

    // Check products table
    expect(Object.keys(schema?.tables.products?.columns || {}).length).toBe(3);
    expect(schema?.tables.products?.columns.price).toEqual({
      name: "price",
      order: 2,
      db_type: "REAL",
      dflt_value: null,
      notnull: false,
      autoincrement: false
    });

  });

  test("should handle all SQLite data types", () => {
    // Create a table with all data types
    db.run(`
      CREATE TABLE data_types (
        text_col TEXT,
        integer_col INTEGER,
        real_col REAL,
        blob_col BLOB
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema?.tables.data_types?.columns.text_col?.db_type).toBe("TEXT");
    expect(schema?.tables.data_types?.columns.text_col?.dflt_value).toBe(null);
    expect(schema?.tables.data_types?.columns.text_col?.notnull).toBe(false);
    expect(schema?.tables.data_types?.columns.integer_col?.db_type).toBe("INTEGER");
    expect(schema?.tables.data_types?.columns.real_col?.db_type).toBe("REAL");
    expect(schema?.tables.data_types?.columns.blob_col?.db_type).toBe("BLOB");
  });

  test("should return empty schema for a database with no tables", () => {
    // Use the empty in-memory database
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema).toBeDefined();
    expect(schema?.tables).toEqual({});
  });

  test("should exclude SQLite internal tables", () => {
    // Create a normal table
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema).toBeDefined();

    // Check that no sqlite_ tables are included
    const tableNames = Object.keys(schema?.tables || {});
    expect(tableNames.every(name => !name.startsWith("sqlite_"))).toBe(true);
    expect(tableNames).toContain("users");
  });

  test("should preserve column order", () => {
    // Create a table with specific column order
    db.run(`
      CREATE TABLE ordered (
        first TEXT,
        second INTEGER,
        third REAL,
        fourth BLOB
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema?.tables.ordered?.columns.first?.order).toBe(0);
    expect(schema?.tables.ordered?.columns.second?.order).toBe(1);
    expect(schema?.tables.ordered?.columns.third?.order).toBe(2);
    expect(schema?.tables.ordered?.columns.fourth?.order).toBe(3);
  });

  test("should handle columns with no explicit type", () => {
    // Create a table with a column without explicit type (SQLite allows this)
    db.run(`
      CREATE TABLE flexible (
        id INTEGER PRIMARY KEY,
        no_type
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema?.tables.flexible?.columns.no_type?.db_type).toBe("TEXT");
    expect(schema?.tables.flexible?.columns.no_type?.dflt_value).toBe(null);
    expect(schema?.tables.flexible?.columns.no_type?.notnull).toBe(false);
  });

  test("should handle table names with special characters", () => {
    // Create a table with special characters in name
    db.run(`
      CREATE TABLE "my-table" (
        "my-column" TEXT
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema?.tables["my-table"]).toBeDefined();
    expect(schema?.tables["my-table"]?.columns["my-column"]).toBeDefined();
  });

  test("should handle complex table with constraints", () => {
    // Create a table with various constraints
    db.run(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0.0,
        description TEXT,
        created_at INTEGER DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema?.tables.products).toBeDefined();

    // The subroutine should return the schema with constraints
    expect(Object.keys(schema?.tables.products?.columns || {}).length).toBe(5);

    // Test name column (NOT NULL)
    expect(schema?.tables.products?.columns.name?.db_type).toBe("TEXT");
    expect(schema?.tables.products?.columns.name?.notnull).toBe(true);
    expect(schema?.tables.products?.columns.name?.dflt_value).toBe(null);

    // Test price column (NOT NULL with DEFAULT)
    expect(schema?.tables.products?.columns.price?.db_type).toBe("REAL");
    expect(schema?.tables.products?.columns.price?.notnull).toBe(true);
    expect(schema?.tables.products?.columns.price?.dflt_value).toBe("0.0");

    // Test id column (PRIMARY KEY AUTOINCREMENT)
    expect(schema?.tables.products?.columns.id?.autoincrement).toBe(true);
    expect(schema?.tables.products?.columns.id?.notnull).toBe(false);

    // Test created_at column (DEFAULT with function)
    expect(schema?.tables.products?.columns.created_at?.db_type).toBe("INTEGER");
    expect(schema?.tables.products?.columns.created_at?.dflt_value).toBe("CURRENT_TIMESTAMP");
    expect(schema?.tables.products?.columns.created_at?.notnull).toBe(false);

    // Test description column (nullable with no default)
    expect(schema?.tables.products?.columns.description?.db_type).toBe("TEXT");
    expect(schema?.tables.products?.columns.description?.dflt_value).toBe(null);
    expect(schema?.tables.products?.columns.description?.notnull).toBe(false);
  });

  test("should handle tables in alphabetical order", () => {
    // Create multiple tables
    db.run(`CREATE TABLE zebra (id INTEGER);`);
    db.run(`CREATE TABLE alpha (id INTEGER);`);
    db.run(`CREATE TABLE beta (id INTEGER);`);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    const tableNames = Object.keys(schema?.tables || {});

    // Tables should be in alphabetical order (due to ORDER BY in query)
    expect(tableNames).toEqual(["alpha", "beta", "zebra"]);
  });

  test("should handle foreign key references", () => {
    // Create parent table
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL
      );
    `);

    // Create child table with foreign key
    db.run(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();
    expect(schema?.tables.users).toBeDefined();
    expect(schema?.tables.posts).toBeDefined();

    // Check users table - no foreign keys
    expect(schema?.tables.users?.columns.id?.foreign_key).toBeUndefined();
    expect(schema?.tables.users?.columns.email?.foreign_key).toBeUndefined();

    // Check posts table - user_id has foreign key
    expect(schema?.tables.posts?.columns.user_id?.foreign_key).toBeDefined();
    expect(schema?.tables.posts?.columns.user_id?.foreign_key?.table).toBe("users");
    expect(schema?.tables.posts?.columns.user_id?.foreign_key?.column).toBe("id");
    expect(schema?.tables.posts?.columns.user_id?.foreign_key?.on_delete).toBe("CASCADE");
    expect(schema?.tables.posts?.columns.user_id?.foreign_key?.on_update).toBe("NO ACTION");

    // Check posts table - other columns don't have foreign keys
    expect(schema?.tables.posts?.columns.id?.foreign_key).toBeUndefined();
    expect(schema?.tables.posts?.columns.title?.foreign_key).toBeUndefined();
  });

  test("should handle multiple foreign keys in same table", () => {
    // Create parent tables
    db.run(`CREATE TABLE organizations (id INTEGER PRIMARY KEY);`);
    db.run(`CREATE TABLE users (id INTEGER PRIMARY KEY);`);

    // Create child table with multiple foreign keys
    db.run(`
      CREATE TABLE memberships (
        id INTEGER PRIMARY KEY,
        org_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Test the subroutine
    const [schema, error] = datastoreGetSchemaFx({ db });

    expect(error).toBeNull();

    // Check memberships table has both foreign keys
    expect(schema?.tables.memberships?.columns.org_id?.foreign_key).toBeDefined();
    expect(schema?.tables.memberships?.columns.org_id?.foreign_key?.table).toBe("organizations");
    expect(schema?.tables.memberships?.columns.org_id?.foreign_key?.column).toBe("id");

    expect(schema?.tables.memberships?.columns.user_id?.foreign_key).toBeDefined();
    expect(schema?.tables.memberships?.columns.user_id?.foreign_key?.table).toBe("users");
    expect(schema?.tables.memberships?.columns.user_id?.foreign_key?.column).toBe("id");
  });

  describe("TErrTuple pattern compliance", () => {
    test("should return [data, null] on success", () => {
      db.run(`CREATE TABLE test (id INTEGER);`);

      const [data, error] = datastoreGetSchemaFx({ db });

      expect(data).not.toBeNull();
      expect(error).toBeNull();
    });
  });
});
