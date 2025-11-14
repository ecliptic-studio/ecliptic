import apis from "@public/api-calls";
import { Button } from "@public/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@public/components/ui/card";
import { Checkbox } from "@public/components/ui/checkbox";
import { Input } from "@public/components/ui/input";
import { Label } from "@public/components/ui/label";
import { getLangFx } from "@public/i18n/get-lang";
import { t } from "@public/i18n/t";
import type { PermissionAction, PermissionAllowedActionByType, PermissionTarget } from "@server/db.d";
import type { Selectable } from "kysely";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useMcpFormState } from "../hooks/useMcpFormState";
import { DatastorePermissionCard } from "./datastore-permission-card";

// Helper function to get allowed actions for a permission type
function getActionsForPermissionType(
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
      i18n_title: string;
      i18n_description: string;
    };
    target: {
      id: string;
      internal_name: string;
      datastore_id: string | null;
      permission_type: {
        id: string;
        i18n_title: string;
        i18n_description: string;
      };
    };
  }>;
}

export function EditMcpForm({
  actions,
  targets,
  allowedActionsByType,
  existingKey = null,
  isEditMode = false
}: {
  actions: Selectable<PermissionAction>[];
  targets: Selectable<PermissionTarget>[];
  allowedActionsByType: Selectable<PermissionAllowedActionByType>[];
  existingKey?: ExistingKey | null;
  isEditMode?: boolean;
}) {
  const lang = getLangFx();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with default full permissions or existing key data
  const {formState, setFormState, isActionEnabled, toggleAction} = useMcpFormState({
    targets,
    allowedActionsByType,
    actions,
    existingKey
  });


  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate form
    if (!formState.name.trim()) {
      setError("API Key name is required");
      toast.error("Validation Error", {
        description: "API Key name is required"
      });
      return;
    }

    if (formState.permissions.length === 0) {
      setError("At least one permission must be selected");
      toast.error("Validation Error", {
        description: "At least one permission must be selected"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Transform permissions to match API format
      const permissionsPayload = formState.permissions.flatMap((permission) =>
        permission.actions.map((actionId) => ({
          actionId,
          targetId: permission.targetId,
        }))
      );

      if (isEditMode && existingKey) {
        // Call API to update MCP key
        const [data, error] = await apis["/api/v1/mcp-keys/:id"].PATCH({id: existingKey.id}, {
          name: formState.name,
          permissions: permissionsPayload,
        })

        if (error) {
          throw new Error(error);
        }
      } else {
        // Call API to create MCP key
        const [data, error] = await apis["/api/v1/mcp-keys"].POST({
          name: formState.name,
          permissions: permissionsPayload,
        })

        if (error) {
          throw new Error(error);
        }
      }

      // Show success toast
      if (isEditMode) {
        toast.success("API Key Updated", {
          description: `"${formState.name}" has been updated successfully`,
        });
      } else {
        toast.success("API Key Created", {
          description: `"${formState.name}" has been created successfully`,
        });
      }

      // Navigate back to MCP settings page
      navigate("/mcp-settings");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      toast.error(isEditMode ? "Failed to Update API Key" : "Failed to Create API Key", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get global targets
  const globalTargets = targets.filter((t) => t.permission_type_id === 'global');


  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-full">
      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* API Key Name Input */}
      <div className="space-y-2">
        <Label htmlFor="name">API Key Name</Label>
        <Input
          id="name"
          className="w-full md:max-w-xs"
          placeholder="e.g., Production API Key"
          value={formState.name}
          onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
          disabled={isSubmitting}
          required
        />
        <p className="text-sm text-muted-foreground">
          This is the name of the API key.
        </p>
      </div>

      {/* Global Permissions */}
      {globalTargets.length > 0 && (
        <Card className="gap-2 py-4">
          <CardHeader>
            <CardTitle>Global Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {globalTargets.map((target) => {
                const availableActions = getActionsForPermissionType(
                  'global',
                  allowedActionsByType,
                  actions
                );

                return (
                  <div key={target.id} className="space-y-2">
                    <div className="gap-2 py-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                      {availableActions.map((action) => (
                        <div key={action.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`${target.id}-${action.id}`}
                            checked={isActionEnabled(target.id, action.id)}
                            onCheckedChange={() => toggleAction(target.id, action.id)}
                          />
                          <Label
                            htmlFor={`${target.id}-${action.id}`}
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
          </CardContent>
        </Card>
      )}

      {/* Datastore Permissions */}
      <DatastorePermissionCard
        actions={actions}
        targets={targets}
        allowedActionsByType={allowedActionsByType}
        setFormState={setFormState}
        formState={formState}
        isActionEnabled={isActionEnabled}
        toggleAction={toggleAction}
      />

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? (isEditMode ? "Updating..." : "Creating...")
            : (isEditMode ? "Update API Key" : "Create API Key")
          }
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/mcp-settings")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
