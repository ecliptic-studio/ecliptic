# Global Store (Zustand)

The global store manages application-wide state that spans multiple features and components. Built with Zustand, it provides a lightweight, React-friendly state management solution.

## Store Location

**All global state lives in:**
```
@public/store/store.global.ts
```

**Store actions are organized in:**
```
@public/store/actions/
```

## When to Use Global Store

Use the global store for:
- **Cross-feature data** that multiple unrelated features need to access
- **Authentication state** (user, session)
- **Server-fetched data** that needs to be shared (e.g., datastores list)
- **Global UI state** (theme, language, notifications)

**Don't use global store for:**
- Feature-local state (use local useState/useReducer instead)
- Component-specific UI state (use local state)
- Form state (use local state or form libraries)

## Store Pattern

### Store Definition

```typescript
import { createStore } from 'zustand';
import type { TDatastore } from '@dto/TDatastore';

export type TGlobalStore = {
  // State
  datastores: TDatastore[];
  user: TUser | null;
  theme: 'light' | 'dark';

  // Actions (functions that modify state)
  initialLoading: () => Promise<void>;
  setUser: (user: TUser | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
};

export const globalStore = createStore<TGlobalStore>((set, get) => {
  const store = {
    // Initial state
    datastores: [],
    user: null,
    theme: 'light',

    // Actions
    initialLoading: createInitialLoadingAction(set),
    setUser: (user) => set({ user }),
    setTheme: (theme) => set({ theme }),
  };

  // Auto-load data on store creation
  setTimeout(() => store.initialLoading(), 0);

  return store;
});
```

### Key Principles

1. **Type everything** - Store type defines the contract
2. **Actions in store** - All state mutations go through actions
3. **External action files** - Complex actions live in `@public/store/actions/`
4. **DTOs only** - Store only holds DTOs from `@dto/`, never raw API responses

## Action Pattern

Actions are functions that modify store state. Simple actions can be inline, complex ones should be in separate files.

### Inline Actions (Simple)

For simple state updates:

```typescript
export const globalStore = createStore<TGlobalStore>((set, get) => ({
  user: null,
  theme: 'light',

  // Simple inline actions
  setUser: (user) => set({ user }),
  setTheme: (theme) => set({ theme }),
  clearUser: () => set({ user: null }),
}));
```

### External Actions (Complex)

For actions with async logic, API calls, or complex state updates:

```typescript
// @public/store/actions/action.initial-loading.ts
import type { ZustandSetter } from "./store.types";
import rpcClient from "@public/rpc-client";

export default function createInitialLoadingAction(set: ZustandSetter) {
  return async () => {
    // Fetch data from API
    const { data, error } = await rpcClient.api.v1.data.get();

    if (error) {
      console.error(error.value.message);
      return;
    }

    // Update store with DTOs
    set({ datastores: data.datastores });
  };
}
```

**Action File Naming Convention:**
- Prefix: `action.`
- Kebab-case: `action.initial-loading.ts`
- Descriptive: `action.fetch-user-profile.ts`

### Using Immer's `produce` for Complex Updates

For complex state updates that involve nested objects or multiple transformations, use **Immer's `produce`** function. This allows you to write "mutating" code that Immer converts to immutable updates.

```typescript
// @public/store/actions/action.initial-loading.ts
import type { ZustandSetter } from "./store.types";
import rpcClient from "@public/rpc-client";
import { produce } from 'immer';
import { toast } from "sonner";

export default function createInitialLoadingAction(set: ZustandSetter) {
  return async () => {
    const { data, error } = await rpcClient.api.v1.data.get();

    if (error) {
      console.error(error.value.message);
      toast.error(error.value.message);
    } else {
      // Use produce to update state immutably
      set(produce(_state => {
        _state.datastores = data.datastores;
      }));
    }
  };
}
```

**When to use `produce`:**
- ✅ Nested object updates (e.g., `state.user.profile.name = "New"`)
- ✅ Array manipulations (push, splice, filter)
- ✅ Multiple related updates in one transaction
- ❌ Simple top-level updates (use `set({ key: value })` instead)

**Example: Nested Update**
```typescript
// Without produce (verbose)
set({
  datastores: state.datastores.map(ds =>
    ds.id === id
      ? { ...ds, tables: [...ds.tables, newTable] }
      : ds
  )
});

// With produce (cleaner)
set(produce(state => {
  const datastore = state.datastores.find(ds => ds.id === id);
  if (datastore) {
    datastore.tables.push(newTable);
  }
}));
```

### Action Best Practices

```typescript
// ✅ Good - Clear action with error handling
export default function createFetchDatastoresAction(set: ZustandSetter) {
  return async (organizationId: string) => {
    try {
      const { data, error } = await rpcClient.api.datastores[organizationId].get();

      if (error) {
        console.error('Failed to fetch datastores:', error);
        set({ datastores: [], error: error.value.message });
        return;
      }

      set({ datastores: data, error: null });
    } catch (err) {
      console.error('Unexpected error:', err);
      set({ error: 'Failed to load datastores' });
    }
  };
}

// ❌ Bad - No error handling, mutating state directly
export default function (set: ZustandSetter) {
  return async () => {
    const data = await fetch('/api/datastores').then(r => r.json());
    set({ datastores: data }); // What if this fails?
  };
}
```

## Accessing the Store

### In React Components

Use the `useStore` hook from Zustand:

```typescript
import { useStore } from "zustand";
import { globalStore } from "@public/store/store.global";

function DatastoreList() {
  // Select only what you need (prevents unnecessary re-renders)
  const datastores = useStore(globalStore, (state) => state.datastores);

  // Or select multiple values
  const { datastores, user } = useStore(
    globalStore,
    (state) => ({ datastores: state.datastores, user: state.user })
  );

  return (
    <div>
      {datastores.map(ds => (
        <div key={ds.id}>{ds.internal_name}</div>
      ))}
    </div>
  );
}
```

### Calling Actions

```typescript
import { useStore } from "zustand";
import { globalStore } from "@public/store/store.global";

function RefreshButton() {
  // Get action from store
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  return (
    <button onClick={() => initialLoading()}>
      Refresh Data
    </button>
  );
}
```

### Selector Pattern (Performance)

**Always use selectors** to prevent unnecessary re-renders:

```typescript
// ✅ Good - Only re-renders when datastores change
const datastores = useStore(globalStore, (state) => state.datastores);

// ✅ Good - Only re-renders when user.name changes
const userName = useStore(globalStore, (state) => state.user?.name);

// ❌ Bad - Re-renders on ANY store change
const store = useStore(globalStore, (state) => state);
const datastores = store.datastores;
```

### Computed Selectors

For derived state, use inline selectors:

```typescript
// Select and compute
const activeDatastores = useStore(
  globalStore,
  (state) => state.datastores.filter(ds => ds.status === 'active')
);

// Select with transformation
const datastoreCount = useStore(
  globalStore,
  (state) => state.datastores.length
);
```

## Store Organization

### Slicing Pattern (Future)

As the store grows, consider slicing it into logical sections:

```typescript
export type TGlobalStore = {
  // User slice
  user: TUser | null;
  session: TSession | null;
  setUser: (user: TUser | null) => void;

  // Datastore slice
  datastores: TDatastore[];
  selectedDatastoreId: string | null;
  fetchDatastores: () => Promise<void>;

  // UI slice
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  toggleSidebar: () => void;
};

// Later, can be extracted to separate files:
// @public/store/slices/user.slice.ts
// @public/store/slices/datastore.slice.ts
// @public/store/slices/ui.slice.ts
```

## Testing the Store

### Testing Actions

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { createStore } from 'zustand';
import createFetchDatastoresAction from './action.fetch-datastores';

describe('fetchDatastores action', () => {
  let store: any;
  let set: any;

  beforeEach(() => {
    set = (updates: any) => {
      store = { ...store, ...updates };
    };
    store = { datastores: [] };
  });

  it('should fetch and set datastores', async () => {
    const action = createFetchDatastoresAction(set);

    await action();

    expect(store.datastores).toHaveLength(2);
    expect(store.datastores[0].internal_name).toBe('test-db');
  });

  it('should handle errors gracefully', async () => {
    // Mock API error...
    const action = createFetchDatastoresAction(set);

    await action();

    expect(store.error).toBeTruthy();
    expect(store.datastores).toEqual([]);
  });
});
```

## Common Patterns

### Loading States

```typescript
export type TGlobalStore = {
  datastores: TDatastore[];
  isLoadingDatastores: boolean;
  datastoresError: string | null;

  fetchDatastores: () => Promise<void>;
};

export default function createFetchDatastoresAction(set: ZustandSetter) {
  return async () => {
    set({ isLoadingDatastores: true, datastoresError: null });

    try {
      const { data, error } = await rpcClient.api.datastores.get();

      if (error) {
        set({
          isLoadingDatastores: false,
          datastoresError: error.value.message
        });
        return;
      }

      set({
        datastores: data,
        isLoadingDatastores: false,
        datastoresError: null
      });
    } catch (err) {
      set({
        isLoadingDatastores: false,
        datastoresError: 'Unexpected error'
      });
    }
  };
}
```

### Optimistic Updates

```typescript
export default function createDeleteDatastoreAction(set: ZustandSetter, get: ZustandGetter) {
  return async (datastoreId: string) => {
    const { datastores } = get();

    // Optimistically remove from UI
    const optimisticDatastores = datastores.filter(ds => ds.id !== datastoreId);
    set({ datastores: optimisticDatastores });

    try {
      const { error } = await rpcClient.api.datastores[datastoreId].delete();

      if (error) {
        // Rollback on error
        set({ datastores });
        console.error('Failed to delete:', error);
      }
    } catch (err) {
      // Rollback on error
      set({ datastores });
      console.error('Unexpected error:', err);
    }
  };
}
```

### Persistence (Optional)

For persisting store to localStorage:

```typescript
import { persist } from 'zustand/middleware';

export const globalStore = createStore(
  persist<TGlobalStore>(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'app-storage', // localStorage key
      partialize: (state) => ({ theme: state.theme }), // Only persist theme
    }
  )
);
```

## Debugging

### Browser DevTools

The store is exposed on `window.store` for debugging:

```typescript
// In browser console:
window.store.getState() // View current state
window.store.getState().datastores // Access specific state
window.store.getState().initialLoading() // Call actions
```

### Zustand DevTools (Optional)

Install Zustand DevTools for Redux DevTools integration:

```typescript
import { devtools } from 'zustand/middleware';

export const globalStore = createStore(
  devtools<TGlobalStore>(
    (set, get) => ({ /* store */ }),
    { name: 'GlobalStore' }
  )
);
```

## Migration from Local State

When promoting local state to global:

```typescript
// Before: Local state in component
function DatastoreList() {
  const [datastores, setDatastores] = useState<TDatastore[]>([]);

  useEffect(() => {
    fetchDatastores().then(setDatastores);
  }, []);

  return <div>{/* ... */}</div>;
}

// After: Global state
function DatastoreList() {
  const datastores = useStore(globalStore, (state) => state.datastores);

  // No need for useEffect - data is already loaded globally

  return <div>{/* ... */}</div>;
}
```

## Refreshing Store After Mutations

When dialogs or components perform mutations (create, update, delete), **always refresh the global store** to keep it in sync with the server state.

### Pattern: Refresh After Dialog Actions

```typescript
import { useState } from "react";
import { useStore } from "zustand";
import { globalStore } from "@public/store/store.global";
import rpcClient from "@public/rpc-client";
import { toast } from "sonner";

export function AddTableDialog({ datastoreId, open, onOpenChange }) {
  const [tableName, setTableName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Get refresh action from global store
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  const handleConfirm = async () => {
    if (!tableName.trim() || isLoading) return;

    setIsLoading(true);
    try {
      // 1. Make API call
      const { data, error } = await rpcClient.api.v1.datastore[datastoreId].schema.patch({
        type: "add-table",
        table: tableName.trim(),
      });

      if (error) {
        toast.error("Failed to add table");
        return;
      }

      toast.success("Table added successfully");

      // 2. Refresh global store to sync with server
      await initialLoading();

      // 3. Close dialog
      onOpenChange(false);
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // ... rest of component
}
```

### When to Refresh

**Always refresh after:**
- Creating resources (tables, datastores)
- Updating resources (rename table, modify schema)
- Deleting resources (drop table, delete datastore)

**Don't refresh for:**
- Read-only operations (fetching, searching)
- Local UI state changes (theme, sidebar toggle)

### Example: Delete with Store Refresh

```typescript
export function DeleteDatastoreDialog({ metadata, open, onOpenChange }) {
  const initialLoading = useStore(globalStore, (state) => state.initialLoading);

  const handleDelete = async () => {
    const { error } = await rpcClient.api.v1.datastore[metadata.datastoreId].delete();

    if (error) {
      toast.error("Failed to delete datastore");
      return;
    }

    toast.success("Datastore deleted");

    // Refresh store to remove deleted datastore from list
    await initialLoading();

    onOpenChange(false);
  };

  // ... rest of component
}
```

### Why This Pattern?

1. **Single Source of Truth** - Global store stays in sync with server
2. **Automatic UI Updates** - All components using the store re-render with fresh data
3. **No Manual Updates** - No need to manually update store state after mutations
4. **Server Authority** - Server response is the source of truth, not client assumptions

## Complete Example

See `@public/store/store.global.ts` for the reference implementation combining all patterns above.

## Real-World Examples

### Feature Dialogs with Store Refresh

See `@public/features/datastore-dialogs/components/` for complete examples:
- `AddTableDialog.tsx` - Creates table, then refreshes store
- `DeleteTableDialog.tsx` - Deletes table, then refreshes store
- `RenameTableDialog.tsx` - Renames table, then refreshes store
- `DeleteDatastoreDialog.tsx` - Deletes datastore, then refreshes store
