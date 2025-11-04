import { describe, expect, test } from "bun:test";
import {
  parsePermissions,
  parsePermissionTarget,
} from "./parse-datastore-permissions.fn";
import type { RawPermission } from "./types";

describe("parsePermissionTarget", () => {
  test("parses datastore-only permission", () => {
    const result = parsePermissionTarget("datastore:abc123");
    expect(result).toEqual({
      datastore: "abc123",
    });
  });

  test("parses datastore with table permission", () => {
    const result = parsePermissionTarget("datastore:abc123.table:users");
    expect(result).toEqual({
      datastore: "abc123",
      table: "users",
    });
  });

  test("parses full datastore.table.column permission", () => {
    const result = parsePermissionTarget("datastore:abc123.table:users.column:email");
    expect(result).toEqual({
      datastore: "abc123",
      table: "users",
      column: "email",
    });
  });

  test("parses wildcard datastore", () => {
    const result = parsePermissionTarget("datastore:*");
    expect(result).toEqual({
      datastore: "*",
    });
  });

  test("parses wildcard datastore with wildcard table", () => {
    const result = parsePermissionTarget("datastore:*.table:*");
    expect(result).toEqual({
      datastore: "*",
      table: "*",
    });
  });

  test("parses wildcard datastore with wildcard table and column", () => {
    const result = parsePermissionTarget("datastore:*.table:*.column:*");
    expect(result).toEqual({
      datastore: "*",
      table: "*",
      column: "*",
    });
  });

  test("parses specific datastore with wildcard table", () => {
    const result = parsePermissionTarget("datastore:abc123.table:*");
    expect(result).toEqual({
      datastore: "abc123",
      table: "*",
    });
  });

  test("returns null for invalid format (empty string)", () => {
    const result = parsePermissionTarget("");
    expect(result).toBeNull();
  });

  test("returns null for invalid format (too many parts)", () => {
    const result = parsePermissionTarget("datastore:abc.table:foo.column:bar.extra:baz");
    expect(result).toBeNull();
  });

  test("returns null for invalid format (missing prefix)", () => {
    const result = parsePermissionTarget("abc123.table:users");
    expect(result).toBeNull();
  });
});

describe("parsePermissions", () => {
  test("parses empty permissions", () => {
    const result = parsePermissions([]);
    expect(result).toEqual({
      global: {
        actions: new Set(),
      },
      datastores: {},
      wildcards: {
        allDatastores: new Set(),
        allTables: new Set(),
        allColumns: new Set(),
      },
    });
  });

  test("parses wildcard datastore permission", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:*",
        permission_action_id: "datastore.list",
      },
    ];

    const result = parsePermissions(permissions);
    expect(result.wildcards.allDatastores.has("datastore.list")).toBe(true);
    expect(result.wildcards.allDatastores.size).toBe(1);
  });

  test("parses wildcard table permission", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
    ];

    const result = parsePermissions(permissions);
    expect(result.wildcards.allTables.has("datastore.table.list")).toBe(true);
    expect(result.wildcards.allTables.size).toBe(1);
  });

  test("parses wildcard column permission for all tables", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ];

    const result = parsePermissions(permissions);
    expect(result.wildcards.allColumns.has("datastore.table.column.select")).toBe(true);
    expect(result.wildcards.allColumns.size).toBe(1);
  });

  test("parses wildcard column permission for a specific table", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123.table:users.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ];

    const result = parsePermissions(permissions);
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.has("datastore.table.column.select")).toBe(true);
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.size).toBe(1);
  });

  test("parses specific datastore permission", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123",
        permission_action_id: "datastore.drop",
      },
    ];

    const result = parsePermissions(permissions);
    expect(result.datastores["abc123"]).toBeDefined();
    expect(result.datastores["abc123"]?.actions.has("datastore.drop")).toBe(true);
  });

  test("parses specific table permission", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.list",
      },
    ];

    const result = parsePermissions(permissions);
    expect(result.datastores["abc123"]?.tables["users"]).toBeDefined();
    expect(result.datastores["abc123"]?.tables["users"]?.actions.has("datastore.table.list")).toBe(true);
  });

  test("parses specific column permission", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123.table:users.column:email",
        permission_action_id: "datastore.table.column.select",
      },
    ];

    const result = parsePermissions(permissions);
    expect(result.datastores["abc123"]?.tables["users"]?.columns["email"]).toBeDefined();
    expect(
      result.datastores["abc123"]?.tables["users"]?.columns["email"]?.actions.has(
        "datastore.table.column.select"
      )
    ).toBe(true);
  });

  test("unions multiple permissions for same resource", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123",
        permission_action_id: "datastore.list",
      },
      {
        permission_target_id: "datastore:abc123",
        permission_action_id: "datastore.drop",
      },
    ];

    const result = parsePermissions(permissions);
    expect(result.datastores["abc123"]?.actions.has("datastore.list")).toBe(true);
    expect(result.datastores["abc123"]?.actions.has("datastore.drop")).toBe(true);
    expect(result.datastores["abc123"]?.actions.size).toBe(2);
  });

  test("handles mixed specific and wildcard permissions", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:*",
        permission_action_id: "datastore.list",
      },
      {
        permission_target_id: "datastore:abc123",
        permission_action_id: "datastore.drop",
      },
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.drop",
      },
    ];

    const result = parsePermissions(permissions);

    // Check wildcard datastore
    expect(result.wildcards.allDatastores.has("datastore.list")).toBe(true);

    // Check specific datastore
    expect(result.datastores["abc123"]?.actions.has("datastore.drop")).toBe(true);

    // Check wildcard table
    expect(result.wildcards.allTables.has("datastore.table.list")).toBe(true);

    // Check specific table
    expect(result.datastores["abc123"]?.tables["users"]?.actions.has("datastore.table.drop")).toBe(true);
  });

  test("skips malformed permission targets", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "invalid",
        permission_action_id: "datastore.list",
      },
      {
        permission_target_id: "datastore:abc123",
        permission_action_id: "datastore.drop",
      },
    ];

    const result = parsePermissions(permissions);
    expect(result.datastores["abc123"]).toBeDefined();
    expect(Object.keys(result.datastores).length).toBe(1);
  });

  test("real world example", () => {
    const rawPermissions: RawPermission[] = [
      {
        "permission_target_id": "datastore:*.table:*",
        "permission_action_id": "datastore.table.list"
      },
      {
        "permission_target_id": "datastore:d5Zc7j1dPM7mps7mZ5mhE.table:foo",
        "permission_action_id": "datastore.table.list"
      },
      {
        "permission_target_id": "datastore:d5Zc7j1dPM7mps7mZ5mhE.table:foo.column:_id",
        "permission_action_id": "datastore.table.column.select"
      },
      {
        "permission_target_id": "datastore:*.table:*.column:*",
        "permission_action_id": "datastore.table.column.select"
      }
    ]

    const result = parsePermissions(rawPermissions);

    // datastore:*.table:* should go into wildcards.allTables (not allDatastores)
    expect(result.wildcards.allTables.has("datastore.table.list")).toBe(true);

    // Specific table permission
    expect(result.datastores["d5Zc7j1dPM7mps7mZ5mhE"]?.tables["foo"]?.actions.has("datastore.table.list")).toBe(true);

    // Specific column permission
    expect(result.datastores["d5Zc7j1dPM7mps7mZ5mhE"]?.tables["foo"]?.columns["_id"]?.actions.has("datastore.table.column.select")).toBe(true);

    // datastore:*.table:*.column:* should go into wildcards.allColumns
    expect(result.wildcards.allColumns.has("datastore.table.column.select")).toBe(true);
  })
});

describe("parsePermissions - scoped wildcards", () => {
  test("parses datastore-scoped wildcard table permission (datastore:ID.table:*)", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123.table:*",
        permission_action_id: "datastore.table.list",
      },
    ];

    const result = parsePermissions(permissions);

    // Should be stored in datastore-level allTables, NOT global wildcards
    expect(result.datastores["abc123"]?.allTables?.actions.has("datastore.table.list")).toBe(true);
    expect(result.datastores["abc123"]?.allTables?.actions.size).toBe(1);
    expect(result.wildcards.allTables.size).toBe(0);
  });

  test("parses table-scoped wildcard column permission (datastore:ID.table:NAME.column:*)", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123.table:users.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ];

    const result = parsePermissions(permissions);

    // Should be stored in table-level allColumns, NOT global wildcards
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.has("datastore.table.column.select")).toBe(true);
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.size).toBe(1);
    expect(result.wildcards.allColumns.size).toBe(0);
  });

  test("distinguishes between global and scoped table wildcards", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:abc123.table:*",
        permission_action_id: "datastore.table.drop",
      },
    ];

    const result = parsePermissions(permissions);

    // Global wildcard should be in wildcards
    expect(result.wildcards.allTables.has("datastore.table.list")).toBe(true);
    expect(result.wildcards.allTables.size).toBe(1);

    // Scoped wildcard should be in specific datastore
    expect(result.datastores["abc123"]?.allTables?.actions.has("datastore.table.drop")).toBe(true);
    expect(result.datastores["abc123"]?.allTables?.actions.size).toBe(1);
  });

  test("distinguishes between global and scoped column wildcards", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:*",
        permission_action_id: "datastore.table.column.update",
      },
    ];

    const result = parsePermissions(permissions);

    // Global wildcard should be in wildcards
    expect(result.wildcards.allColumns.has("datastore.table.column.select")).toBe(true);
    expect(result.wildcards.allColumns.size).toBe(1);

    // Scoped wildcard should be in specific table
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.has("datastore.table.column.update")).toBe(true);
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.size).toBe(1);
  });

  test("handles multiple scoped wildcards for different datastores", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:def456.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:abc123.table:*",
        permission_action_id: "datastore.table.drop",
      },
    ];

    const result = parsePermissions(permissions);

    // Check first datastore has both actions
    expect(result.datastores["abc123"]?.allTables?.actions.has("datastore.table.list")).toBe(true);
    expect(result.datastores["abc123"]?.allTables?.actions.has("datastore.table.drop")).toBe(true);
    expect(result.datastores["abc123"]?.allTables?.actions.size).toBe(2);

    // Check second datastore has one action
    expect(result.datastores["def456"]?.allTables?.actions.has("datastore.table.list")).toBe(true);
    expect(result.datastores["def456"]?.allTables?.actions.size).toBe(1);
  });

  test("handles multiple scoped wildcards for different tables", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123.table:users.column:*",
        permission_action_id: "datastore.table.column.select",
      },
      {
        permission_target_id: "datastore:abc123.table:posts.column:*",
        permission_action_id: "datastore.table.column.select",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:*",
        permission_action_id: "datastore.table.column.update",
      },
    ];

    const result = parsePermissions(permissions);

    // Check users table has both actions
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.has("datastore.table.column.select")).toBe(true);
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.has("datastore.table.column.update")).toBe(true);
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.size).toBe(2);

    // Check posts table has one action
    expect(result.datastores["abc123"]?.tables["posts"]?.allColumns?.actions.has("datastore.table.column.select")).toBe(true);
    expect(result.datastores["abc123"]?.tables["posts"]?.allColumns?.actions.size).toBe(1);
  });

  test("complex scenario with all wildcard types", () => {
    const permissions: RawPermission[] = [
      // Global wildcards
      {
        permission_target_id: "datastore:*",
        permission_action_id: "datastore.list",
      },
      {
        permission_target_id: "datastore:*.table:*",
        permission_action_id: "datastore.table.list",
      },
      {
        permission_target_id: "datastore:*.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
      // Datastore-scoped wildcard
      {
        permission_target_id: "datastore:abc123.table:*",
        permission_action_id: "datastore.table.drop",
      },
      // Table-scoped wildcard
      {
        permission_target_id: "datastore:abc123.table:users.column:*",
        permission_action_id: "datastore.table.column.update",
      },
      // Specific permissions
      {
        permission_target_id: "datastore:abc123",
        permission_action_id: "datastore.list",
      },
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.rename",
      },
      {
        permission_target_id: "datastore:abc123.table:users.column:email",
        permission_action_id: "datastore.table.column.select",
      },
    ];

    const result = parsePermissions(permissions);

    // Global wildcards
    expect(result.wildcards.allDatastores.has("datastore.list")).toBe(true);
    expect(result.wildcards.allTables.has("datastore.table.list")).toBe(true);
    expect(result.wildcards.allColumns.has("datastore.table.column.select")).toBe(true);

    // Datastore-scoped wildcard
    expect(result.datastores["abc123"]?.allTables?.actions.has("datastore.table.drop")).toBe(true);

    // Table-scoped wildcard
    expect(result.datastores["abc123"]?.tables["users"]?.allColumns?.actions.has("datastore.table.column.update")).toBe(true);

    // Specific permissions
    expect(result.datastores["abc123"]?.actions.has("datastore.list")).toBe(true);
    expect(result.datastores["abc123"]?.tables["users"]?.actions.has("datastore.table.rename")).toBe(true);
    expect(result.datastores["abc123"]?.tables["users"]?.columns["email"]?.actions.has("datastore.table.column.select")).toBe(true);
  });

  test("does not create entries for datastore:ID.table:*.column:* pattern", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123.table:*.column:*",
        permission_action_id: "datastore.table.column.select",
      },
    ];

    const result = parsePermissions(permissions);

    // This pattern is not stored anywhere (as per implementation comment)
    expect(result.wildcards.allColumns.size).toBe(0);
    expect(result.datastores["abc123"]?.allTables).toBeUndefined();
  });

  test("validates action types and only adds to appropriate scope", () => {
    const permissions: RawPermission[] = [
      // Try to add table action to datastore scope - should be added (datastore.table.create is a datastore-level action)
      {
        permission_target_id: "datastore:abc123",
        permission_action_id: "datastore.table.create",
      },
      // Try to add column action to table scope - should be ignored
      {
        permission_target_id: "datastore:abc123.table:users",
        permission_action_id: "datastore.table.column.select",
      },
      // Valid table action on table - should be added
      {
        permission_target_id: "datastore:abc123.table:posts",
        permission_action_id: "datastore.table.list",
      },
      // Try to add datastore action to column scope - should be ignored
      {
        permission_target_id: "datastore:abc123.table:users.column:name",
        permission_action_id: "datastore.list",
      },
      // Valid column action on column - should be added
      {
        permission_target_id: "datastore:abc123.table:users.column:email",
        permission_action_id: "datastore.table.column.select",
      },
    ];

    const result = parsePermissions(permissions);

    // datastore.table.create is a datastore action, should be in datastore scope
    expect(result.datastores["abc123"]?.actions.has("datastore.table.create")).toBe(true);

    // Column action should not be in table scope (users table should have no actions)
    expect(result.datastores["abc123"]?.tables["users"]?.actions.size || 0).toBe(0);

    // Valid table action should be in table scope
    expect(result.datastores["abc123"]?.tables["posts"]?.actions.has("datastore.table.list")).toBe(true);

    // Datastore action should not be in column scope (name column should not exist)
    expect(result.datastores["abc123"]?.tables["users"]?.columns["name"]).toBeUndefined();

    // Valid column action should be in column scope
    expect(result.datastores["abc123"]?.tables["users"]?.columns["email"]?.actions.has("datastore.table.column.select")).toBe(true);
    expect(result.datastores["abc123"]?.tables["users"]?.columns["email"]?.actions.size).toBe(1);
  });

  test("filters out completely invalid actions", () => {
    const permissions: RawPermission[] = [
      {
        permission_target_id: "datastore:abc123",
        permission_action_id: "invalid.action",
      },
      {
        permission_target_id: "datastore:abc123",
        permission_action_id: "datastore.list",
      },
    ];

    const result = parsePermissions(permissions);

    // Only the valid action should be present
    expect(result.datastores["abc123"]?.actions.size).toBe(1);
    expect(result.datastores["abc123"]?.actions.has("datastore.list")).toBe(true);
  });
});
