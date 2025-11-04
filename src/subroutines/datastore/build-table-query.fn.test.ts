import { describe, test, expect } from "bun:test";
import { buildTableQueryFn, type BuildTableQueryArgs } from "./build-table-query.fn";

describe("buildTableQueryFn", () => {
  const validColumns = ["id", "name", "email", "age", "status", "created_at"];

  describe("basic query building", () => {
    test("builds simple query with no filters or sorting", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" LIMIT ? OFFSET ?');
      expect(result.params).toEqual([51, 0]); // pageSize + 1 for hasMore detection
    });

    test("builds query with column selection", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        columns: ["id", "name", "email"],
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT "id", "name", "email", rowid AS _rowid FROM "users" LIMIT ? OFFSET ?');
      expect(result.params).toEqual([51, 0]);
    });

    test("uses pageSize + 1 for hasMore detection", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 20,
        offset: 40,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.params).toEqual([21, 40]); // 20 + 1 = 21
    });
  });

  describe("filter operators", () => {
    test("handles eq (equals) operator", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "status", operator: "eq", value: "active" }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" WHERE "status" = ? LIMIT ? OFFSET ?');
      expect(result.params).toEqual(["active", 51, 0]);
    });

    test("handles ne (not equals) operator", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "status", operator: "ne", value: "deleted" }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" WHERE "status" != ? LIMIT ? OFFSET ?');
      expect(result.params).toEqual(["deleted", 51, 0]);
    });

    test("handles gt (greater than) operator", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "age", operator: "gt", value: 18 }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" WHERE "age" > ? LIMIT ? OFFSET ?');
      expect(result.params).toEqual([18, 51, 0]);
    });

    test("handles gte (greater than or equal) operator", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "age", operator: "gte", value: 18 }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" WHERE "age" >= ? LIMIT ? OFFSET ?');
      expect(result.params).toEqual([18, 51, 0]);
    });

    test("handles lt (less than) operator", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "age", operator: "lt", value: 65 }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" WHERE "age" < ? LIMIT ? OFFSET ?');
      expect(result.params).toEqual([65, 51, 0]);
    });

    test("handles lte (less than or equal) operator", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "age", operator: "lte", value: 65 }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" WHERE "age" <= ? LIMIT ? OFFSET ?');
      expect(result.params).toEqual([65, 51, 0]);
    });

    test("handles like (pattern matching) operator", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "email", operator: "like", value: "%@gmail.com" }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" WHERE "email" LIKE ? LIMIT ? OFFSET ?');
      expect(result.params).toEqual(["%@gmail.com", 51, 0]);
    });

    test("handles in (value in list) operator", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "status", operator: "in", value: ["active", "pending", "verified"] }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" WHERE "status" IN (?, ?, ?) LIMIT ? OFFSET ?');
      expect(result.params).toEqual(["active", "pending", "verified", 51, 0]);
    });

    test("throws error for in operator with non-array value", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "status", operator: "in", value: "active" }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      expect(() => buildTableQueryFn(args)).toThrow(
        'Filter operator "in" requires an array value for column "status"'
      );
    });

    test("throws error for in operator with empty array", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "status", operator: "in", value: [] }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      expect(() => buildTableQueryFn(args)).toThrow(
        'Filter operator "in" requires at least one value for column "status"'
      );
    });
  });

  describe("multiple filters", () => {
    test("combines multiple filters with AND logic", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [
          { column: "age", operator: "gte", value: 18 },
          { column: "age", operator: "lt", value: 65 },
          { column: "status", operator: "eq", value: "active" },
        ],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe(
        'SELECT *, rowid AS _rowid FROM "users" WHERE "age" >= ? AND "age" < ? AND "status" = ? LIMIT ? OFFSET ?'
      );
      expect(result.params).toEqual([18, 65, "active", 51, 0]);
    });

    test("handles mix of different operator types", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [
          { column: "email", operator: "like", value: "%@gmail.com" },
          { column: "status", operator: "in", value: ["active", "pending"] },
          { column: "age", operator: "gte", value: 18 },
        ],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe(
        'SELECT *, rowid AS _rowid FROM "users" WHERE "email" LIKE ? AND "status" IN (?, ?) AND "age" >= ? LIMIT ? OFFSET ?'
      );
      expect(result.params).toEqual(["%@gmail.com", "active", "pending", 18, 51, 0]);
    });
  });

  describe("sorting", () => {
    test("handles single column ascending sort", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        sort: [{ column: "name", direction: "ASC" }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" ORDER BY "name" ASC LIMIT ? OFFSET ?');
      expect(result.params).toEqual([51, 0]);
    });

    test("handles single column descending sort", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        sort: [{ column: "created_at", direction: "DESC" }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" ORDER BY "created_at" DESC LIMIT ? OFFSET ?');
      expect(result.params).toEqual([51, 0]);
    });

    test("handles multi-column sorting", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        sort: [
          { column: "name", direction: "ASC" },
          { column: "created_at", direction: "DESC" },
        ],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe(
        'SELECT *, rowid AS _rowid FROM "users" ORDER BY "name" ASC, "created_at" DESC LIMIT ? OFFSET ?'
      );
      expect(result.params).toEqual([51, 0]);
    });
  });

  describe("combined features", () => {
    test("handles filters + sorting + pagination + column selection together", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [
          { column: "age", operator: "gte", value: 18 },
          { column: "status", operator: "eq", value: "active" },
        ],
        sort: [
          { column: "name", direction: "ASC" },
          { column: "age", direction: "DESC" },
        ],
        pageSize: 20,
        offset: 40,
        columns: ["id", "name", "email", "age"],
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.query).toBe(
        'SELECT "id", "name", "email", "age", rowid AS _rowid FROM "users" WHERE "age" >= ? AND "status" = ? ORDER BY "name" ASC, "age" DESC LIMIT ? OFFSET ?'
      );
      expect(result.params).toEqual([18, "active", 21, 40]); // pageSize + 1 = 21
    });
  });

  describe("pagination edge cases", () => {
    test("handles zero offset", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 10,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.params).toEqual([11, 0]);
    });

    test("handles large offset", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 10000,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.params).toEqual([51, 10000]);
    });

    test("handles small page size", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 1,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.params).toEqual([2, 0]); // 1 + 1 = 2
    });

    test("handles large page size", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 1000,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      expect(result.params).toEqual([1001, 0]); // 1000 + 1 = 1001
    });
  });

  describe("column validation", () => {
    test("throws error for invalid column in filter", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "invalid_column", operator: "eq", value: "test" }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      expect(() => buildTableQueryFn(args)).toThrow(
        'Invalid column name: "invalid_column". Column not found in table schema.'
      );
    });

    test("throws error for invalid column in sort", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        sort: [{ column: "invalid_column", direction: "ASC" }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      expect(() => buildTableQueryFn(args)).toThrow(
        'Invalid column name: "invalid_column". Column not found in table schema.'
      );
    });

    test("throws error for invalid column in columns", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        columns: ["id", "invalid_column", "email"],
        validColumns,
      };

      expect(() => buildTableQueryFn(args)).toThrow(
        'Invalid column name: "invalid_column". Column not found in table schema.'
      );
    });

    test("accepts all valid columns", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: validColumns.map(col => ({ column: col, operator: "ne" as const, value: null })),
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      expect(() => buildTableQueryFn(args)).not.toThrow();
    });
  });

  describe("SQL injection prevention", () => {
    test("uses parameterized queries for all values", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "name", operator: "eq", value: "'; DROP TABLE users; --" }],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);

      // Value should be in params array, not in query string
      expect(result.query).not.toContain("DROP TABLE");
      expect(result.query).toBe('SELECT *, rowid AS _rowid FROM "users" WHERE "name" = ? LIMIT ? OFFSET ?');
      expect(result.params).toEqual(["'; DROP TABLE users; --", 51, 0]);
    });

    test("quotes column names to prevent injection", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [{ column: "name", operator: "eq", value: "test" }],
        pageSize: 50,
        offset: 0,
        columns: ["id", "name"],
        validColumns,
      };

      const result = buildTableQueryFn(args);

      // Column names should be quoted
      expect(result.query).toContain('"name"');
      expect(result.query).toContain('"id"');
      expect(result.query).toContain('"users"');
    });

    test("validates table name characters", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users; DROP TABLE test; --",
        filters: [],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      expect(() => buildTableQueryFn(args)).toThrow(
        'Invalid table name: "users; DROP TABLE test; --". Table name can only contain letters, numbers, underscores, and hyphens.'
      );
    });

    test("allows valid table names with underscores and hyphens", () => {
      const args: BuildTableQueryArgs = {
        tableName: "user_accounts-2024",
        filters: [],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      expect(() => buildTableQueryFn(args)).not.toThrow();
      const result = buildTableQueryFn(args);
      expect(result.query).toContain('"user_accounts-2024"');
    });
  });

  describe("edge cases", () => {
    test("handles empty filters array", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      expect(() => buildTableQueryFn(args)).not.toThrow();
      const result = buildTableQueryFn(args);
      expect(result.query).not.toContain("WHERE");
    });

    test("handles undefined sort", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);
      expect(result.query).not.toContain("ORDER BY");
    });

    test("handles empty sort array", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        sort: [],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);
      expect(result.query).not.toContain("ORDER BY");
    });

    test("handles undefined columns", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        validColumns,
      };

      const result = buildTableQueryFn(args);
      expect(result.query).toContain("SELECT *, rowid AS _rowid");
    });

    test("handles empty columns array", () => {
      const args: BuildTableQueryArgs = {
        tableName: "users",
        filters: [],
        pageSize: 50,
        offset: 0,
        columns: [],
        validColumns,
      };

      const result = buildTableQueryFn(args);
      expect(result.query).toContain("SELECT *, rowid AS _rowid");
    });
  });
});
