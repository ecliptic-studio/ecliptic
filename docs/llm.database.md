
## Database

We use **Kysely** as our SQL query builder with SQLite. Database types are defined in `@src/db.d.ts` (auto-generated via kysely-codegen).

### Important Type Usage

**Always use `Selectable<...>` for DTOs and return types:**

```typescript
import type { Selectable } from "kysely";
import type { Datastore } from "@src/db.d";

// ✅ Correct - Use Selectable for return types
export async function createDatastore(
  portal: CreateDatastorePortal,
  args: CreateDatastoreArgs
): Promise<TErrTriple<Selectable<Datastore>>> {
  // ...
}

// ❌ Wrong - Don't use raw DB types directly
export async function createDatastore(...): Promise<TErrTriple<Datastore>> {
  // ...
}
```

**Why Selectable?**
- Database table types include `Generated<T>` for auto-generated fields (like timestamps with DEFAULT)
- `Selectable<T>` converts these to their actual runtime types
- This ensures type safety when returning queried data

### Database Connection

The Kysely instance is available at `@src/db.ts`:
```typescript
import { kysely, type TKysely } from "@src/db";
```