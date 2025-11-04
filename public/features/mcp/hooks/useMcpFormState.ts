import type { PermissionAllowedActionByType } from "@server/db.d";
import type { PermissionTarget } from "@server/db.d";
import type { PermissionAction } from "@server/db.d";
import type { Selectable } from "kysely";
import { useState } from "react";

export type PermissionEntry = {
  targetId: string;
  actions: string[];
};

export type FormState = {
  name: string;
  permissions: PermissionEntry[];
};

export function getActionsForPermissionType(
  permissionTypeId: string,
  allowedActionsByType: Selectable<PermissionAllowedActionByType>[],
  actions: Selectable<PermissionAction>[]
): Selectable<PermissionAction>[] {
  const allowedActionIds = allowedActionsByType
    .filter((a) => a.permission_type_id === permissionTypeId)
    .map((a) => a.permission_action_id);

  return actions.filter((action) => allowedActionIds.includes(action.id));
}


interface ExistingKey {
  id: string;
  internal_name: string;
  permissions: Array<{
    action: {
      id: string;
    };
    target: {
      id: string;
    };
  }>;
}

export function useMcpFormState(args: {
  targets: Selectable<PermissionTarget>[],
  allowedActionsByType: Selectable<PermissionAllowedActionByType>[],
  actions: Selectable<PermissionAction>[],
  existingKey?: ExistingKey | null
}) {
  // Initialize with default full permissions or existing key data
  const [formState, setFormState] = useState<FormState>(() => {
    // If editing existing key, load its data
    if (args.existingKey) {
      // Group permissions by target
      const permissionsByTarget: Record<string, string[]> = {};
      args.existingKey.permissions.forEach((p) => {
        if (!permissionsByTarget[p.target.id]) {
          permissionsByTarget[p.target.id] = [];
        }
        permissionsByTarget[p.target.id]?.push(p.action.id);
      });

      const permissions: PermissionEntry[] = Object.entries(permissionsByTarget).map(
        ([targetId, actions]) => ({
          targetId,
          actions,
        })
      );

      return {
        name: args.existingKey.internal_name,
        permissions,
      };
    }

    // Otherwise, initialize with default full permissions
    const defaultPermissions: PermissionEntry[] = [];

    // Add global permissions
    const globalTarget = args.targets.find((t) => t.permission_type_id === 'global');
    if (globalTarget) {
      const globalActions = getActionsForPermissionType('global', args.allowedActionsByType, args.actions);
      defaultPermissions.push({
        targetId: globalTarget.id,
        actions: globalActions.map((a) => a.id),
      });
    }

    // Add wildcard datastore permissions
    const datastoreWildcard = args.targets.find((t) => t.id === 'datastore:*');
    if (datastoreWildcard) {
      const datastoreActions = getActionsForPermissionType('datastore', args.allowedActionsByType, args.actions);
      defaultPermissions.push({
        targetId: datastoreWildcard.id,
        actions: datastoreActions.map((a) => a.id),
      });
    }

    // Add wildcard table permissions
    const tableWildcard = args.targets.find((t) => t.id === 'datastore:*.table:*');
    if (tableWildcard) {
      const tableActions = getActionsForPermissionType('datastore.table', args.allowedActionsByType, args.actions);
      defaultPermissions.push({
        targetId: tableWildcard.id,
        actions: tableActions.map((a) => a.id),
      });
    }

    // Add wildcard column permissions
    const columnWildcard = args.targets.find((t) => t.id === 'datastore:*.table:*.column:*');
    if (columnWildcard) {
      const columnActions = getActionsForPermissionType('datastore.table.column', args.allowedActionsByType, args.actions);
      defaultPermissions.push({
        targetId: columnWildcard.id,
        actions: columnActions.map((a) => a.id),
      });
    }

    return {
      name: "",
      permissions: defaultPermissions,
    };
  });

    // Toggle action for a specific target
    const toggleAction = (targetId: string, actionId: string) => {
      setFormState((prev) => {
        const existingPermission = prev.permissions.find((p) => p.targetId === targetId);
  
        if (existingPermission) {
          // Toggle the action
          const hasAction = existingPermission.actions.includes(actionId);
          if (hasAction) {
            // Remove action
            return {
              ...prev,
              permissions: prev.permissions.map((p) =>
                p.targetId === targetId
                  ? { ...p, actions: p.actions.filter((a) => a !== actionId) }
                  : p
              ).filter((p) => p.actions.length > 0), // Remove if no actions left
            };
          } else {
            // Add action
            return {
              ...prev,
              permissions: prev.permissions.map((p) =>
                p.targetId === targetId
                  ? { ...p, actions: [...p.actions, actionId] }
                  : p
              ),
            };
          }
        } else {
          // Create new permission entry
          return {
            ...prev,
            permissions: [...prev.permissions, { targetId, actions: [actionId] }],
          };
        }
      });
    };
  
    // Check if action is enabled for target
    const isActionEnabled = (targetId: string, actionId: string): boolean => {
      const permission = formState.permissions.find((p) => p.targetId === targetId);
      return permission ? permission.actions.includes(actionId) : false;
    };
  

  return {
    formState,
    setFormState,
    isActionEnabled,
    toggleAction,
  };
}