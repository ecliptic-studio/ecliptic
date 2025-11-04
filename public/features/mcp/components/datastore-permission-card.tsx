import { Button } from "@public/components/ui/button";
import { Input } from "@public/components/ui/input";
import type { PermissionAllowedActionByType, PermissionAction, PermissionTarget } from "@server/db.d";
import type { Selectable } from "kysely";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@public/components/ui/card"
import { Checkbox } from "@public/components/ui/checkbox";
import { t } from "@public/i18n/t";
import { getLangFx } from "@public/i18n/get-lang";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@public/components/ui/label";
import { useState, type SetStateAction } from "react";
import { useStore } from "zustand";
import { globalStore } from "@public/store/store.global";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuPositioner } from "@public/components/ui/dropdown-menu";
import { getActionsForPermissionType, type FormState } from "../hooks/useMcpFormState";

export function DatastorePermissionCard({
  actions,
  targets,
  allowedActionsByType,
  setFormState,
  formState,
  isActionEnabled,
  toggleAction
}: {
  actions: Selectable<PermissionAction>[];
  targets: Selectable<PermissionTarget>[];
  allowedActionsByType: Selectable<PermissionAllowedActionByType>[];
  setFormState: (value: SetStateAction<FormState>) => void;
  formState: FormState;
  isActionEnabled: (targetId: string, actionId: string) => boolean;
  toggleAction: (targetId: string, actionId: string) => void;
}) {

  const datastores = useStore(globalStore, (state) => state.datastores);
  const lang = getLangFx();


  // Get datastore-level targets (excluding nested table/column targets)
  const datastoreTargets = targets.filter(
    (t) => t.permission_type_id === 'datastore'
  );

  // Filter targets that have permissions set
  // Include both existing targets and newly created ones (that might not be in DB yet)
  const activeDatastorePermissions = formState.permissions.filter((p) =>
    p.targetId.startsWith('datastore:') && !p.targetId.includes('.table:')
  );

  // Create a merged list of targets to display
  const activeDatastoreTargets = activeDatastorePermissions.map((permission) => {
    // Try to find existing target in DB
    const existingTarget = datastoreTargets.find((t) => t.id === permission.targetId);

    if (existingTarget) {
      return existingTarget;
    }

    // Create a virtual target for newly added datastores
    const datastoreId = permission.targetId.replace('datastore:', '');
    const datastore = datastores?.find((d) => d.id === datastoreId);

    return {
      id: permission.targetId,
      internal_name: datastore?.internal_name || permission.targetId,
      permission_type_id: 'datastore',
      organization_id: '', // Will be set by backend
      datastore_id: datastoreId === '*' ? null : datastoreId,
      created_at: '',
    } as Selectable<PermissionTarget>;
  });


  // Add a new datastore/table/column permission
  const addPermission = (targetId: string) => {
    const target = targets.find((t) => t.id === targetId);
    if (!target) return;

    const availableActions = getActionsForPermissionType(
      target.permission_type_id,
      allowedActionsByType,
      actions
    );

    setFormState((prev) => ({
      ...prev,
      permissions: [
        ...prev.permissions,
        {
          targetId,
          actions: availableActions.map((a) => a.id), // Default to all actions enabled
        },
      ],
    }));
  };

  // Remove a permission entry and all nested child permissions
  const removePermission = (targetId: string) => {
    setFormState((prev) => ({
      ...prev,
      permissions: prev.permissions.filter((p) => {
        // Remove the target itself
        if (p.targetId === targetId) return false;

        // Remove nested children (anything that starts with this targetId)
        // e.g., if removing "datastore:abc", also remove "datastore:abc.table:foo" and "datastore:abc.table:foo.column:bar"
        if (p.targetId.startsWith(targetId + '.')) return false;

        return true;
      }),
    }));
  };

  return <Card className="gap-2 py-4">
    <CardHeader>
      <CardTitle>Datastore Permissions</CardTitle>
      <CardDescription>
        Select the datastores that this API key will have access to.
        datastore:* will grant access to all datastores.
      </CardDescription>
      <CardAction>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
            <Plus className="size-4 mr-2" /> Add Datastore
          </DropdownMenuTrigger>
          <DropdownMenuPositioner>
            <DropdownMenuContent>
              {/* Show wildcard option if not already added */}
              {!formState.permissions.some((p) => p.targetId === 'datastore:*') && (
                <DropdownMenuItem
                  onClick={() => {
                    const wildcardTarget = targets.find((t) => t.id === 'datastore:*');
                    if (wildcardTarget) {
                      addPermission(wildcardTarget.id);
                    }
                  }}
                >
                  All Datastores (*)
                </DropdownMenuItem>
              )}
              {/* Show specific datastores */}
              {datastores?.map((d) => {
                const targetId = `datastore:${d.id}`;
                const isAlreadyAdded = formState.permissions.some((p) => p.targetId === targetId);

                if (isAlreadyAdded) return null;

                return (
                  <DropdownMenuItem
                    key={d.id}
                    onClick={() => {
                      // Find or create target for this specific datastore
                      let target = targets.find((t) => t.id === targetId);

                      if (target) {
                        addPermission(target.id);
                      } else {
                        // If target doesn't exist in DB yet, we still add it to form state
                        // Backend will create the permission_target entry when saving
                        const datastoreActions = getActionsForPermissionType(
                          'datastore',
                          allowedActionsByType,
                          actions
                        );
                        setFormState((prev) => ({
                          ...prev,
                          permissions: [
                            ...prev.permissions,
                            {
                              targetId,
                              actions: datastoreActions.map((a) => a.id),
                            },
                          ],
                        }));
                      }
                    }}
                  >
                    {d.internal_name}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenuPositioner>
        </DropdownMenu>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div className="space-y-6">
        {activeDatastoreTargets.map((datastoreTarget) => {
          const datastoreActions = getActionsForPermissionType(
            'datastore',
            allowedActionsByType,
            actions
          );

          // Get table permissions for this datastore (including virtual ones)
          const tablePermissions = formState.permissions.filter(
            (p) => p.targetId.startsWith(datastoreTarget.id + '.table:') && !p.targetId.includes('.column:')
          );

          // Create merged list of table targets
          const childTableTargets = tablePermissions.map((permission) => {
            // Try to find existing target
            const existingTarget = targets.find((t) => t.id === permission.targetId);
            if (existingTarget) return existingTarget;

            // Create virtual table target
            const tableName = permission.targetId.split('.table:')[1];
            const datastoreId = datastoreTarget.id.replace('datastore:', '');

            return {
              id: permission.targetId,
              internal_name: tableName,
              permission_type_id: 'datastore.table',
              organization_id: '',
              datastore_id: datastoreId === '*' ? null : datastoreId,
              created_at: '',
            } as Selectable<PermissionTarget>;
          });

          return (
            <div key={datastoreTarget.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  {datastoreTarget.internal_name}
                </Label>
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                        />
                      }
                    >
                      <Plus className="size-4 mr-2" /> Add Table
                    </DropdownMenuTrigger>
                    <DropdownMenuPositioner>
                      <DropdownMenuContent>
                        {/* Show wildcard table option if not already added */}
                        {!formState.permissions.some((p) => p.targetId === `${datastoreTarget.id}.table:*`) && (
                          <DropdownMenuItem
                            onClick={() => {
                              const tableWildcard = targets.find(
                                (t) => t.id === `${datastoreTarget.id}.table:*`
                              );
                              if (tableWildcard) {
                                addPermission(tableWildcard.id);
                              } else {
                                // Create virtual table wildcard target
                                const tableActions = getActionsForPermissionType(
                                  'datastore.table',
                                  allowedActionsByType,
                                  actions
                                );
                                setFormState((prev) => ({
                                  ...prev,
                                  permissions: [
                                    ...prev.permissions,
                                    {
                                      targetId: `${datastoreTarget.id}.table:*`,
                                      actions: tableActions.map((a) => a.id),
                                    },
                                  ],
                                }));
                              }
                            }}
                          >
                            All Tables (*)
                          </DropdownMenuItem>
                        )}
                        {/* Show specific tables from datastore schema */}
                        {(() => {
                          const datastoreId = datastoreTarget.id.replace('datastore:', '');
                          const datastore = datastores?.find((d) => d.id === datastoreId);
                          const tables = datastore?.schema_json?.tables || {};

                          return Object.keys(tables).map((tableName) => {
                            const targetId = `${datastoreTarget.id}.table:${tableName}`;
                            const isAlreadyAdded = formState.permissions.some((p) => p.targetId === targetId);

                            if (isAlreadyAdded) return null;

                            return (
                              <DropdownMenuItem
                                key={tableName}
                                onClick={() => {
                                  const target = targets.find((t) => t.id === targetId);

                                  if (target) {
                                    addPermission(target.id);
                                  } else {
                                    // Create virtual table target
                                    const tableActions = getActionsForPermissionType(
                                      'datastore.table',
                                      allowedActionsByType,
                                      actions
                                    );
                                    setFormState((prev) => ({
                                      ...prev,
                                      permissions: [
                                        ...prev.permissions,
                                        {
                                          targetId,
                                          actions: tableActions.map((a) => a.id),
                                        },
                                      ],
                                    }));
                                  }
                                }}
                              >
                                {tableName}
                              </DropdownMenuItem>
                            );
                          });
                        })()}
                      </DropdownMenuContent>
                    </DropdownMenuPositioner>
                  </DropdownMenu>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => removePermission(datastoreTarget.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Datastore-level actions */}
              <div className="gap-2 py-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {datastoreActions.map((action) => (
                  <div key={action.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`${datastoreTarget.id}-${action.id}`}
                      checked={isActionEnabled(datastoreTarget.id, action.id)}
                      onCheckedChange={() => toggleAction(datastoreTarget.id, action.id)}
                    />
                    <Label
                      htmlFor={`${datastoreTarget.id}-${action.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {t(lang, JSON.parse(action.i18n_title))}
                    </Label>
                  </div>
                ))}
              </div>

              {/* Nested Table Permissions */}
              {childTableTargets.length > 0 && (
                <div className="ml-6 space-y-4 border-l-2 pl-4">
                  {childTableTargets.map((tableTarget) => {
                    const tableActions = getActionsForPermissionType(
                      'datastore.table',
                      allowedActionsByType,
                      actions
                    );

                    // Get column permissions for this table (including virtual ones)
                    const columnPermissions = formState.permissions.filter(
                      (p) => p.targetId.startsWith(tableTarget.id + '.column:')
                    );

                    // Create merged list of column targets
                    const childColumnTargets = columnPermissions.map((permission) => {
                      // Try to find existing target
                      const existingTarget = targets.find((t) => t.id === permission.targetId);
                      if (existingTarget) return existingTarget;

                      // Create virtual column target
                      const columnName = permission.targetId.split('.column:')[1];

                      return {
                        id: permission.targetId,
                        internal_name: columnName,
                        permission_type_id: 'datastore.table.column',
                        organization_id: '',
                        datastore_id: tableTarget.datastore_id,
                        created_at: '',
                      } as Selectable<PermissionTarget>;
                    });

                    return (
                      <div key={tableTarget.id} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">
                            {tableTarget.internal_name}
                          </Label>
                          <div className="flex gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                  />
                                }
                              >
                                <Plus className="size-4 mr-2" /> Add Column
                              </DropdownMenuTrigger>
                              <DropdownMenuPositioner>
                                <DropdownMenuContent>
                                  {/* Show wildcard column option if not already added */}
                                  {!formState.permissions.some((p) => p.targetId === `${tableTarget.id}.column:*`) && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const columnWildcard = targets.find(
                                          (t) => t.id === `${tableTarget.id}.column:*`
                                        );
                                        if (columnWildcard) {
                                          addPermission(columnWildcard.id);
                                        } else {
                                          // Create virtual column wildcard target
                                          const columnActions = getActionsForPermissionType(
                                            'datastore.table.column',
                                            allowedActionsByType,
                                            actions
                                          );
                                          setFormState((prev) => ({
                                            ...prev,
                                            permissions: [
                                              ...prev.permissions,
                                              {
                                                targetId: `${tableTarget.id}.column:*`,
                                                actions: columnActions.map((a) => a.id),
                                              },
                                            ],
                                          }));
                                        }
                                      }}
                                    >
                                      All Columns (*)
                                    </DropdownMenuItem>
                                  )}
                                  {/* Show specific columns from table schema */}
                                  {(() => {
                                    const datastoreId = tableTarget.datastore_id;
                                    const datastore = datastores?.find((d) => d.id === datastoreId);

                                    // Extract table name from the target ID (format: datastore:xxx.table:tableName)
                                    const match = tableTarget.id.match(/\.table:([^.]+)(?:\.|$)/);
                                    const tableName = match?.[1];

                                    if (!tableName || tableName === '*') {
                                      return []; // Can't show columns for wildcard table
                                    }

                                    // Get columns from schema_json.tables[tableName].columns
                                    const tableSchema = datastore?.schema_json?.tables?.[tableName];
                                    const columns = tableSchema?.columns || {};

                                    return Object.keys(columns).map((fieldKey) => {
                                      const column = columns[fieldKey];
                                      if (!column) return null;

                                      const columnName = column.name || fieldKey;
                                      const targetId = `${tableTarget.id}.column:${columnName}`;
                                      const isAlreadyAdded = formState.permissions.some((p) => p.targetId === targetId);

                                      if (isAlreadyAdded) return null;

                                      return (
                                        <DropdownMenuItem
                                          key={columnName}
                                          onClick={() => {
                                            const target = targets.find((t) => t.id === targetId);

                                            if (target) {
                                              addPermission(target.id);
                                            } else {
                                              // Create virtual column target
                                              const columnActions = getActionsForPermissionType(
                                                'datastore.table.column',
                                                allowedActionsByType,
                                                actions
                                              );
                                              setFormState((prev) => ({
                                                ...prev,
                                                permissions: [
                                                  ...prev.permissions,
                                                  {
                                                    targetId,
                                                    actions: columnActions.map((a) => a.id),
                                                  },
                                                ],
                                              }));
                                            }
                                          }}
                                        >
                                          {columnName}
                                        </DropdownMenuItem>
                                      );
                                    });
                                  })()}
                                </DropdownMenuContent>
                              </DropdownMenuPositioner>
                            </DropdownMenu>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => removePermission(tableTarget.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Table-level actions */}
                        <div className="gap-2 py-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                          {tableActions.map((action) => (
                            <div key={action.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`${tableTarget.id}-${action.id}`}
                                checked={isActionEnabled(tableTarget.id, action.id)}
                                onCheckedChange={() => toggleAction(tableTarget.id, action.id)}
                              />
                              <Label
                                htmlFor={`${tableTarget.id}-${action.id}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {t(lang, JSON.parse(action.i18n_title))}
                              </Label>
                            </div>
                          ))}
                        </div>

                        {/* Nested Column Permissions */}
                        {childColumnTargets.length > 0 && (
                          <div className="ml-6 space-y-4 border-l-2 pl-4">
                            {childColumnTargets.map((columnTarget) => {
                              const columnActions = getActionsForPermissionType(
                                'datastore.table.column',
                                allowedActionsByType,
                                actions
                              );

                              return (
                                <div key={columnTarget.id} className="border rounded-lg p-4 space-y-4 bg-muted/50">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold">
                                      {columnTarget.internal_name}
                                    </Label>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => removePermission(columnTarget.id)}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>

                                  {/* Column-level actions */}
                                  <div className="gap-2 py-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                                    {columnActions.map((action) => (
                                      <div key={action.id} className="flex items-center gap-2">
                                        <Checkbox
                                          id={`${columnTarget.id}-${action.id}`}
                                          checked={isActionEnabled(columnTarget.id, action.id)}
                                          onCheckedChange={() => toggleAction(columnTarget.id, action.id)}
                                        />
                                        <Label
                                          htmlFor={`${columnTarget.id}-${action.id}`}
                                          className="text-sm font-normal cursor-pointer"
                                        >
                                          {t(lang, JSON.parse(action.i18n_title))}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>

}