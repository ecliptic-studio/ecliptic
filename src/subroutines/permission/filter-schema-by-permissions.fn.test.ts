import { describe, expect, test } from "bun:test";
import { filterSchemaByPermissions, type SchemaJson } from "./filter-schema-by-permissions.fn";
import { parsePermissions } from "./parse-datastore-permissions.fn";
import type { RawPermission } from "./types";

describe("filterSchemaByPermissions", () => {
  const exampleSchema: SchemaJson = {
    tables: {
      users: {
        columns: {
          id: { name: "id", order: 0, db_type: "INTEGER" },
          email: { name: "email", order: 1, db_type: "TEXT" },
          password: { name: "password", order: 2, db_type: "TEXT" },
          created_at: { name: "created_at", order: 3, db_type: "TEXT" },
        },
      },
      posts: {
        columns: {
          id: { name: "id", order: 0, db_type: "INTEGER" },
          title: { name: "title", order: 1, db_type: "TEXT" },
          content: { name: "content", order: 2, db_type: "TEXT" },
          user_id: { name: "user_id", order: 3, db_type: "INTEGER" },
        },
      },
      comments: {
        columns: {
          id: { name: "id", order: 0, db_type: "INTEGER" },
          text: { name: "text", order: 1, db_type: "TEXT" },
          post_id: { name: "post_id", order: 2, db_type: "INTEGER" },
        },
      },
    },
  };

  test("returns empty schema when no permissions granted", () => {
    const permissions = parsePermissions([]);
    const result = filterSchemaByPermissions(exampleSchema, permissions, "abc123");

    expect(result).toEqual({
      tables: {},
    });
  });

  test("real world example", () => {
    const rawPermissions: RawPermission[] = [
      {
        "permission_target_id": "datastore:*.table:*",
        "permission_action_id": "datastore.table.list"
      },
      {
        "permission_target_id": "datastore:d5Zc7j1dPM7mps7mZ5mhE.table:comments",
        "permission_action_id": "datastore.table.list"
      },
      {
        "permission_target_id": "datastore:d5Zc7j1dPM7mps7mZ5mhE.table:comments.column:id",
        "permission_action_id": "datastore.table.column.select"
      }
    ]
    
    const permissions = parsePermissions(rawPermissions);
    const result = filterSchemaByPermissions(exampleSchema, permissions, "d5Zc7j1dPM7mps7mZ5mhE");
    expect(result.tables.comments?.columns?.id).toBeDefined();
    expect(result.tables.posts).toBeDefined()
    expect(result.tables.posts?.columns).toBeEmptyObject()
    expect(result.tables.users).toBeDefined()
    expect(result.tables.users?.columns).toBeEmptyObject()
  })

  test("filters out tables without list permission", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    const result = filterSchemaByPermissions(exampleSchema, permissions, "abc123");

    // Only users table should be present
    expect(Object.keys(result.tables)).toEqual(["users"]);
  });

  test("filters out columns without select permission", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:id",
        permission_action_id: "datastore.table.column.select",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:email",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    const result = filterSchemaByPermissions(exampleSchema, permissions, "abc123");

    // Only id and email columns should be present
    expect(Object.keys(result.tables.users?.columns || {})).toEqual(["id", "email"]);
  });

  test("wildcard table permission grants access to all tables", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    const result = filterSchemaByPermissions(exampleSchema, permissions, "abc123");

    // All tables and all columns should be present
    expect(Object.keys(result.tables).sort()).toEqual(["comments", "posts", "users"]);
    expect(Object.keys(result.tables.users?.columns || {}).sort()).toEqual([
      "created_at",
      "email",
      "id",
      "password",
    ]);
  });

  test("wildcard column permission grants access to all columns", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    const result = filterSchemaByPermissions(exampleSchema, permissions, "abc123");

    // Only users table, but all its columns
    expect(Object.keys(result.tables)).toEqual(["users"]);
    expect(Object.keys(result.tables.users?.columns || {}).sort()).toEqual([
      "created_at",
      "email",
      "id",
      "password",
    ]);
  });

  test("includes table with empty columns object if no column permissions", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      // No column permissions granted
    ]);

    const result = filterSchemaByPermissions(exampleSchema, permissions, "abc123");

    // All tables can be listed, but they have empty columns objects
    expect(Object.keys(result.tables).sort()).toEqual(["comments", "posts", "users"]);
    expect(result.tables.users?.columns).toEqual({});
    expect(result.tables.posts?.columns).toEqual({});
    expect(result.tables.comments?.columns).toEqual({});
  });

  test("preserves column metadata", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:email",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    const result = filterSchemaByPermissions(exampleSchema, permissions, "abc123");

    expect(result.tables.users?.columns?.email).toEqual({
      name: "email",
      order: 1,
      db_type: "TEXT",
    });
  });

  test("complex scenario: mixed wildcard and specific permissions", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:id",
        permission_action_id: "datastore.table.column.select",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:email",
        permission_action_id: "datastore.table.column.select",
      },
      {
        permission_target_id: "datastore:abc123.table:posts.column:id",
        permission_action_id: "datastore.table.column.select",
      },
      {
        permission_target_id: "datastore:abc123.table:posts.column:title",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    const result = filterSchemaByPermissions(exampleSchema, permissions, "abc123");

    // users table with id, email columns
    expect(Object.keys(result.tables.users?.columns || {}).sort()).toEqual(["email", "id"]);

    // posts table with id, title columns
    expect(Object.keys(result.tables.posts?.columns || {}).sort()).toEqual(["id", "title"]);

    // comments table has no column permissions, but is still included with empty columns
    expect(result.tables.comments).toBeDefined();
    expect(result.tables.comments?.columns).toEqual({});
  });

  test("example from user: realistic permission set", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:d5Zc7j1dPM7mps7mZ5mhE.table:foo",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:d5Zc7j1dPM7mps7mZ5mhE.table:foo.column:_id",
        permission_action_id: "datastore.table.column.select",
      },
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ];

    const parsed = parsePermissions(permissions);

    const schema: SchemaJson = {
      tables: {
        foo: {
          columns: {
            _id: { name: "_id", order: 0, db_type: "INTEGER" },
            name: { name: "name", order: 1, db_type: "TEXT" },
          },
        },
        bar: {
          columns: {
            id: { name: "id", order: 0, db_type: "INTEGER" },
            value: { name: "value", order: 1, db_type: "TEXT" },
          },
        },
      },
    };

    const result = filterSchemaByPermissions(schema, parsed, "d5Zc7j1dPM7mps7mZ5mhE");

    // All tables should be accessible (wildcard table list)
    expect(Object.keys(result.tables).sort()).toEqual(["bar", "foo"]);

    // All columns should be accessible (wildcard column select)
    expect(Object.keys(result.tables.foo?.columns || {}).sort()).toEqual(["_id", "name"]);
    expect(Object.keys(result.tables.bar?.columns || {}).sort()).toEqual(["id", "value"]);
  });

  test("handles empty schema", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    const emptySchema: SchemaJson = {
      tables: {},
    };

    const result = filterSchemaByPermissions(emptySchema, permissions, "abc123");

    expect(result).toEqual({
      tables: {},
    });
  });

  test("handles table with no columns", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    const schemaWithEmptyTable: SchemaJson = {
      tables: {
        empty_table: {
          columns: {},
        },
      },
    };

    const result = filterSchemaByPermissions(schemaWithEmptyTable, permissions, "abc123");

    // Table with no columns should still be included (with empty columns object)
    expect(result.tables.empty_table).toBeDefined();
    expect(result.tables.empty_table?.columns).toEqual({});
  });

  test("different datastore ID does not grant access to specific permissions", () => {
    const permissions = parsePermissions([
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:email",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    // Using different datastore ID
    const result = filterSchemaByPermissions(exampleSchema, permissions, "xyz789");

    // No access to any tables
    expect(result.tables).toEqual({});
  });

  test("union of permissions: specific + wildcard", () => {
    const permissions = parsePermissions([
      // Specific permissions for users table
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:id",
        permission_action_id: "datastore.table.column.select",
      },
      // Wildcard permissions for all other tables
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ]);

    const result = filterSchemaByPermissions(exampleSchema, permissions, "abc123");

    // All tables accessible (wildcard)
    expect(Object.keys(result.tables).sort()).toEqual(["comments", "posts", "users"]);

    // All columns accessible via wildcard
    expect(Object.keys(result.tables.users?.columns || {}).sort()).toEqual([
      "created_at",
      "email",
      "id",
      "password",
    ]);
  });
});
