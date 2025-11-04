import { describe, expect, test } from "bun:test";
import { validateRowDataFn, type TableSchema } from "./validate-row-data.fn";
import { ErrorCode } from "@server/error/error-code.enum";

describe("validateRowDataFn", () => {
  const sampleSchema: TableSchema = {
    tables: {
      users: {
        columns: {
          id: { name: 'id', order: 0, db_type: 'INTEGER' },
          name: { name: 'name', order: 1, db_type: 'TEXT' },
          email: { name: 'email', order: 2, db_type: 'TEXT' },
          age: { name: 'age', order: 3, db_type: 'INTEGER' },
          balance: { name: 'balance', order: 4, db_type: 'REAL' },
          avatar: { name: 'avatar', order: 5, db_type: 'BLOB' }
        }
      },
      products: {
        columns: {
          id: { name: 'id', order: 0, db_type: 'INTEGER' },
          title: { name: 'title', order: 1, db_type: 'TEXT' },
          price: { name: 'price', order: 2, db_type: 'REAL' }
        }
      }
    }
  };

  describe("successful validation", () => {
    test("should validate correct insert data", () => {
      const [result, error, rollbacks] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          id: 1,
          name: 'Alice',
          email: 'alice@example.com',
          age: 30
        },
        operation: 'insert'
      });

      expect(error).toBeNull();
      expect(result).toEqual({ valid: true });
      expect(rollbacks).toBeArray();
      expect(rollbacks).toHaveLength(0);
    });

    test("should validate correct update data", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          name: 'Bob',
          age: 25
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should accept nullable columns with null values", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          id: 1,
          name: 'Alice',
          email: null,
          age: null
        },
        operation: 'insert'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should accept nullable columns with undefined values", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          id: 1,
          name: 'Alice',
          email: undefined,
          age: undefined
        },
        operation: 'insert'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should validate TEXT type correctly", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          name: 'Valid String',
          email: 'test@example.com'
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should validate INTEGER type correctly", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          id: 42,
          age: 0
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should validate REAL type correctly", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'products',
        schema: sampleSchema,
        rowData: {
          price: 19.99
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should accept integers for REAL columns", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'products',
        schema: sampleSchema,
        rowData: {
          price: 20 // Integer is valid for REAL
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should validate BLOB type with Buffer", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          avatar: Buffer.from('test')
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should validate BLOB type with Uint8Array", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          avatar: new Uint8Array([1, 2, 3, 4])
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should validate BLOB type with ArrayBuffer", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          avatar: new ArrayBuffer(8)
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should validate BLOB type with string", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          avatar: 'binary-string-data'
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should validate subset of columns", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          name: 'Alice'
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should handle unicode strings", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          name: 'こんにちは 世界 🌍'
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });
  });

  describe("error handling - table validation", () => {
    test("should return error when table does not exist", () => {
      const [result, error, rollbacks] = validateRowDataFn({
        tableName: 'nonexistent_table',
        schema: sampleSchema,
        rowData: { id: 1 },
        operation: 'insert'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_VALIDATE_ROW_DATA_FAILED);
      expect(error?.internal).toContain('not found in schema');
      expect(error?.external?.en).toContain('does not exist');
      expect(error?.statusCode).toBe('Not Found');
      expect(error?.shouldLog).toBe(false);
      expect(rollbacks).toHaveLength(0);
    });
  });

  describe("error handling - column validation", () => {
    test("should return error for unknown column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          unknown_column: 'value'
        },
        operation: 'insert'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.code).toBe(ErrorCode.SR_DATASTORE_VALIDATE_ROW_DATA_FAILED);
      expect(error?.internal).toContain('Unknown columns: unknown_column');
      expect(error?.external?.en).toContain('Unknown columns: unknown_column');
      expect(error?.statusCode).toBe('Bad Request');
    });

    test("should return error for multiple unknown columns", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          bad_col1: 'value1',
          bad_col2: 'value2',
          name: 'Alice' // This one is valid
        },
        operation: 'insert'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain('bad_col1');
      expect(error?.internal).toContain('bad_col2');
    });
  });

  describe("error handling - type validation", () => {
    test("should reject non-string for TEXT column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          name: 123 // Should be string
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain("expects TEXT but got number");
    });

    test("should reject non-integer for INTEGER column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          age: 'not a number'
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain("expects INTEGER but got string");
    });

    test("should reject float for INTEGER column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          age: 25.5 // Should be integer
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain("expects INTEGER");
    });

    test("should reject NaN for INTEGER column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          age: NaN
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
    });

    test("should reject Infinity for INTEGER column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          age: Infinity
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
    });

    test("should reject non-number for REAL column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'products',
        schema: sampleSchema,
        rowData: {
          price: 'expensive'
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain("expects REAL but got string");
    });

    test("should reject NaN for REAL column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'products',
        schema: sampleSchema,
        rowData: {
          price: NaN
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
    });

    test("should reject Infinity for REAL column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'products',
        schema: sampleSchema,
        rowData: {
          price: Infinity
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
    });

    test("should reject invalid type for BLOB column", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          avatar: 123 // Should be Buffer/Uint8Array/ArrayBuffer/string
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain("expects BLOB but got number");
    });
  });

  describe("null value handling", () => {
    test("should accept null values (SQLite columns are nullable by default)", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          id: null,
          name: null,
          email: null
        },
        operation: 'insert'
      });

      // Null values are accepted since SQLite columns are nullable by default
      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should accept undefined values", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          name: undefined,
          age: undefined
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });
  });

  describe("error handling - multiple errors", () => {
    test("should report both unknown columns and type errors", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          unknown_col: 'value',
          age: 'not a number'
        },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain('unknown_col');
      expect(error?.internal).toContain("expects INTEGER but got string");
    });

    test("should report multiple type errors", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'products',
        schema: sampleSchema,
        rowData: {
          id: 'not-a-number',
          title: 123,
          price: 'not-a-number'
        },
        operation: 'insert'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain("expects INTEGER");
      expect(error?.internal).toContain("expects TEXT");
      expect(error?.internal).toContain("expects REAL");
    });
  });

  describe("TErrTriple pattern compliance", () => {
    test("should return [data, null, rollbacks] on success", () => {
      const [data, error, rollbacks] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { name: 'Alice' },
        operation: 'update'
      });

      expect(data).not.toBeNull();
      expect(error).toBeNull();
      expect(rollbacks).toBeArray();
    });

    test("should return [null, error, rollbacks] on failure", () => {
      const [data, error, rollbacks] = validateRowDataFn({
        tableName: 'nonexistent',
        schema: sampleSchema,
        rowData: { name: 'Alice' },
        operation: 'update'
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(rollbacks).toBeArray();
    });

    test("should always return empty rollbacks array (pure function)", () => {
      const [, , rollbacks1] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { name: 'Alice' },
        operation: 'update'
      });

      const [, , rollbacks2] = validateRowDataFn({
        tableName: 'nonexistent',
        schema: sampleSchema,
        rowData: { name: 'Alice' },
        operation: 'update'
      });

      expect(rollbacks1).toHaveLength(0);
      expect(rollbacks2).toHaveLength(0);
    });
  });

  describe("pure function characteristics", () => {
    test("should be deterministic (same input = same output)", () => {
      const input = {
        tableName: 'users',
        schema: sampleSchema,
        rowData: { name: 'Alice', age: 30 },
        operation: 'update' as const
      };

      const [result1, error1] = validateRowDataFn(input);
      const [result2, error2] = validateRowDataFn(input);

      expect(result1).toEqual(result2);
      expect(error1).toEqual(error2);
    });

    test("should not mutate input schema", () => {
      const schema = JSON.parse(JSON.stringify(sampleSchema));
      const originalSchema = JSON.parse(JSON.stringify(sampleSchema));

      validateRowDataFn({
        tableName: 'users',
        schema,
        rowData: { name: 'Alice' },
        operation: 'update'
      });

      expect(schema).toEqual(originalSchema);
    });

    test("should not mutate input rowData", () => {
      const rowData = { name: 'Alice', age: 30 };
      const originalRowData = { ...rowData };

      validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData,
        operation: 'update'
      });

      expect(rowData).toEqual(originalRowData);
    });
  });

  describe("edge cases", () => {
    test("should handle empty rowData", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {},
        operation: 'update'
      });

      // Empty rowData is valid for update (no columns to validate)
      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should handle schema with table but no columns", () => {
      const schema: TableSchema = {
        tables: {
          empty_table: {
            columns: {}
          }
        }
      };

      const [result, error] = validateRowDataFn({
        tableName: 'empty_table',
        schema,
        rowData: { any_col: 'value' },
        operation: 'insert'
      });

      // Column doesn't exist in schema
      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain('Unknown columns');
    });

    test("should handle very long string values", () => {
      const longString = 'a'.repeat(100000);

      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { name: longString },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should handle negative integers", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { age: -10 },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should handle zero values", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: {
          age: 0,
          balance: 0.0
        },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should handle negative real numbers", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { balance: -100.50 },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should handle very small real numbers", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { balance: 0.0000001 },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should handle very large integers", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { id: Number.MAX_SAFE_INTEGER },
        operation: 'update'
      });

      expect(error).toBeNull();
      expect(result?.valid).toBe(true);
    });

    test("should include value in type error message", () => {
      const [result, error] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { age: 'twenty-five' },
        operation: 'update'
      });

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error?.internal).toContain('twenty-five');
    });
  });

  describe("operation parameter", () => {
    test("should include operation in error message", () => {
      const [, error1] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { unknown: 'value' },
        operation: 'insert'
      });

      const [, error2] = validateRowDataFn({
        tableName: 'users',
        schema: sampleSchema,
        rowData: { unknown: 'value' },
        operation: 'update'
      });

      expect(error1?.internal).toContain('insert');
      expect(error2?.internal).toContain('update');
    });
  });
});
