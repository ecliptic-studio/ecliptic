import type { PermissionAction, PermissionAllowedActionByType, PermissionTarget } from "@server/db.d";
import type { Selectable } from "kysely";

export type TPermissionMeta = { 
  actions: PermissionAction[], 
  targets: Selectable<PermissionTarget>[], 
  allowedActionsByType: Selectable<PermissionAllowedActionByType>[] 
}