import type { Mcpkey, PermissionAction, PermissionTarget, PermissionType } from "@server/db.d";
import type { Selectable } from "kysely";

export type TMcpKey = Omit<Selectable<Mcpkey>, 'organization_id' | 'user_id' | 'created_at' | 'updated_at'> & {
  permissions: {
    action: Selectable<PermissionAction>;
    target: Omit<Selectable<PermissionTarget>, 'permission_type_id' | 'organization_id' | 'created_at'> & {permission_type: Selectable<PermissionType>};
  }[]
}