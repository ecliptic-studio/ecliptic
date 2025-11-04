import { describe, expect, test } from "bun:test";
import { paginateQueryFn } from "./paginate-query";

describe("paginateQuery", () => {
  describe("SELECT query", () => {
    test("returns the correct query and params", () => {
      const query = "SELECT * FROM users";
      const result = paginateQueryFn(query);
      expect(result).toEqual(['SELECT * FROM "users" LIMIT 10 OFFSET 0']);
    });

    test("returns the correct query and params with limit and offset params", () => {
      const query = "SELECT * FROM users";
      const result = paginateQueryFn(query, 10, 0);
      expect(result).toEqual(['SELECT * FROM "users" LIMIT 10 OFFSET 0']);
    });

    test("returns the correct query and params with limit and offset query", () => {
      const query = "SELECT * FROM users LIMIT 100 OFFSET 0";
      const result = paginateQueryFn(query);
      // When no params provided and query has existing LIMIT, original query is returned
      expect(result).toEqual(['SELECT * FROM users LIMIT 100 OFFSET 0']);
    });

    test("returns the correct query and params with limit and offset query and params", () => {
      const query = "SELECT * FROM users LIMIT 100 OFFSET 0";
      const result = paginateQueryFn(query, 10, 0);
      expect(result).toEqual(['SELECT * FROM "users" LIMIT 10 OFFSET 0']);
    });
  });

  describe("SELECT with JOIN queries", () => {
    test("adds pagination to simple INNER JOIN", () => {
      const query = "SELECT * FROM users INNER JOIN orders ON users.id = orders.user_id";
      const result = paginateQueryFn(query);
      expect(result).toEqual(['SELECT * FROM "users" INNER JOIN "orders" ON "users"."id" = "orders"."user_id" LIMIT 10 OFFSET 0']);
    });

    test("adds pagination to LEFT JOIN", () => {
      const query = "SELECT u.*, o.* FROM users u LEFT JOIN orders o ON u.id = o.user_id";
      const result = paginateQueryFn(query);
      expect(result).toEqual(['SELECT "u".*, "o".* FROM "users" AS "u" LEFT JOIN "orders" AS "o" ON "u"."id" = "o"."user_id" LIMIT 10 OFFSET 0']);
    });

    test("adds pagination to multiple JOINs", () => {
      const query = "SELECT * FROM users JOIN orders ON users.id = orders.user_id JOIN products ON orders.product_id = products.id";
      const result = paginateQueryFn(query);
      expect(result).toEqual(['SELECT * FROM "users" INNER JOIN "orders" ON "users"."id" = "orders"."user_id" INNER JOIN "products" ON "orders"."product_id" = "products"."id" LIMIT 10 OFFSET 0']);
    });

    test("respects existing LIMIT in JOIN query", () => {
      const query = "SELECT * FROM users JOIN orders ON users.id = orders.user_id LIMIT 50";
      const result = paginateQueryFn(query);
      // When no params provided and query has existing LIMIT, original query is returned
      expect(result).toEqual(['SELECT * FROM users JOIN orders ON users.id = orders.user_id LIMIT 50']);
    });

    test("overrides existing LIMIT with params in JOIN query", () => {
      const query = "SELECT * FROM users JOIN orders ON users.id = orders.user_id LIMIT 100 OFFSET 20";
      const result = paginateQueryFn(query, 25, 5);
      expect(result).toEqual(['SELECT * FROM "users" INNER JOIN "orders" ON "users"."id" = "orders"."user_id" LIMIT 25 OFFSET 5']);
    });

    test("adds pagination to JOIN with WHERE clause", () => {
      const query = "SELECT * FROM users JOIN orders ON users.id = orders.user_id WHERE users.active = true";
      const result = paginateQueryFn(query);
      expect(result).toEqual(['SELECT * FROM "users" INNER JOIN "orders" ON "users"."id" = "orders"."user_id" WHERE "users"."active" = TRUE LIMIT 10 OFFSET 0']);
    });

    test("adds pagination to JOIN with ORDER BY", () => {
      const query = "SELECT * FROM users JOIN orders ON users.id = orders.user_id ORDER BY users.created_at DESC";
      const result = paginateQueryFn(query, 20, 10);
      expect(result).toEqual(['SELECT * FROM "users" INNER JOIN "orders" ON "users"."id" = "orders"."user_id" ORDER BY "users"."created_at" DESC LIMIT 20 OFFSET 10']);
    });
  });

  describe("Multiple SQL statements", () => {
    test("paginates multiple SELECT statements", () => {
      const query = "SELECT * FROM users; SELECT * FROM orders";
      const result = paginateQueryFn(query);
      expect(result).toEqual([
        'SELECT * FROM "users" LIMIT 10 OFFSET 0',
        'SELECT * FROM "orders" LIMIT 10 OFFSET 0'
      ]);
    });

    test("paginates mixed SELECT and non-SELECT statements", () => {
      const query = "SELECT * FROM users; INSERT INTO logs (message) VALUES ('test'); SELECT * FROM orders";
      const result = paginateQueryFn(query);
      // Parser normalizes column names without quotes
      expect(result).toEqual([
        'SELECT * FROM "users" LIMIT 10 OFFSET 0',
        'INSERT INTO "logs" (message) VALUES (\'test\')',
        'SELECT * FROM "orders" LIMIT 10 OFFSET 0'
      ]);
    });

    test("returns original when multiple non-SELECT statements", () => {
      const query = "INSERT INTO users (name) VALUES ('John'); UPDATE users SET active = true";
      const result = paginateQueryFn(query);
      expect(result).toEqual([
        "INSERT INTO users (name) VALUES ('John')",
        "UPDATE users SET active = true"
      ]);
    });

    test("respects existing LIMIT in one of multiple SELECT statements", () => {
      const query = "SELECT * FROM users LIMIT 50; SELECT * FROM orders";
      const result = paginateQueryFn(query);
      // When any query is modified, all get normalized by sqlify
      expect(result).toEqual([
        'SELECT * FROM "users" LIMIT 50',
        'SELECT * FROM "orders" LIMIT 10 OFFSET 0'
      ]);
    });

    test("overrides LIMIT in multiple SELECT statements with params", () => {
      const query = "SELECT * FROM users LIMIT 100; SELECT * FROM orders LIMIT 200";
      const result = paginateQueryFn(query, 25, 5);
      expect(result).toEqual([
        'SELECT * FROM "users" LIMIT 25 OFFSET 5',
        'SELECT * FROM "orders" LIMIT 25 OFFSET 5'
      ]);
    });

    test("handles multiple SELECT statements with JOINs", () => {
      const query = "SELECT * FROM users JOIN orders ON users.id = orders.user_id; SELECT * FROM products";
      const result = paginateQueryFn(query, 20, 0);
      expect(result).toEqual([
        'SELECT * FROM "users" INNER JOIN "orders" ON "users"."id" = "orders"."user_id" LIMIT 20 OFFSET 0',
        'SELECT * FROM "products" LIMIT 20 OFFSET 0'
      ]);
    });
  });

  describe("Non-SELECT queries (should remain unchanged)", () => {
    test("INSERT query remains unchanged", () => {
      const query = "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')";
      const result = paginateQueryFn(query);
      expect(result).toEqual([query]);
    });

    test("INSERT query with params remains unchanged", () => {
      const query = "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')";
      const result = paginateQueryFn(query, 10, 0);
      expect(result).toEqual([query]);
    });

    test("UPDATE query remains unchanged", () => {
      const query = "UPDATE users SET name = 'Jane' WHERE id = 1";
      const result = paginateQueryFn(query);
      expect(result).toEqual([query]);
    });

    test("UPDATE query with params remains unchanged", () => {
      const query = "UPDATE users SET email = 'new@example.com' WHERE id = 5";
      const result = paginateQueryFn(query, 10, 0);
      expect(result).toEqual([query]);
    });

    test("DELETE query remains unchanged", () => {
      const query = "DELETE FROM users WHERE id = 1";
      const result = paginateQueryFn(query);
      expect(result).toEqual([query]);
    });

    test("DELETE query with params remains unchanged", () => {
      const query = "DELETE FROM orders WHERE user_id = 10";
      const result = paginateQueryFn(query, 10, 0);
      expect(result).toEqual([query]);
    });

    test("CREATE TABLE query remains unchanged", () => {
      const query = "CREATE TABLE products (id SERIAL PRIMARY KEY, name TEXT)";
      const result = paginateQueryFn(query);
      expect(result).toEqual([query]);
    });

    test("ALTER TABLE query remains unchanged", () => {
      const query = "ALTER TABLE users ADD COLUMN age INTEGER";
      const result = paginateQueryFn(query);
      expect(result).toEqual([query]);
    });

    test("DROP TABLE query remains unchanged", () => {
      const query = "DROP TABLE old_table";
      const result = paginateQueryFn(query);
      expect(result).toEqual([query]);
    });

    test("TRUNCATE query remains unchanged", () => {
      const query = "TRUNCATE TABLE logs";
      const result = paginateQueryFn(query);
      expect(result).toEqual([query]);
    });
  });
})
