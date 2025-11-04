# Feature Folder Pattern

The feature folder pattern organizes related functionality into self-contained modules. Each feature contains its own components, hooks, state management, and utilities.

But still relies on global.store. If local state like ui toggle. useState is enough. No Zustand needed.

## Feature Location

**All features live in:**
```
@public/features/
```

Each feature is a self-contained folder with its own structure.

## When to Use Feature Folders

Create a feature folder when:
- **Multiple related components** work together for a specific functionality
- **Local state management** is needed that doesn't belong in global store
- **Custom hooks** are specific to this feature
- **Complexity** warrants organization beyond a single component

**Examples of good features:**
- `@public/features/datastore-dialogs/` - All datastore CRUD dialogs
- `@public/features/workflow-editor/` - Workflow visual editor
- `@public/features/auth-forms/` - Login/signup forms
- `@public/features/data-table/` - Advanced table with filtering/sorting

**Don't create a feature for:**
- Single components (use `@public/components/` instead)
- Shared utilities (use `@public/lib/` or `@public/utils/`)
- Global state (use `@public/store/`)

## Feature Structure

### Basic Feature Structure

```
@public/features/my-feature/
├── index.ts                    # Public API - what the feature exports
├── MyFeatureProvider.tsx       # Context provider (if needed)
├── components/                 # Feature-specific components
│   ├── ComponentA.tsx
│   └── ComponentB.tsx
├── hooks/                      # Feature-specific hooks
│   ├── useMyFeature.ts
│   └── useMyFeatureState.ts
├── types.ts                    # Feature types (if complex)
└── utils.ts                    # Feature utilities (if needed)
```

### Advanced Feature Structure

For complex features:

```
@public/features/workflow-editor/
├── index.ts                    # Public exports
├── WorkflowEditorProvider.tsx  # Main provider
├── components/
│   ├── WorkflowCanvas.tsx
│   ├── NodePalette.tsx
│   ├── PropertyPanel.tsx
│   └── Toolbar.tsx
├── hooks/
│   ├── useWorkflowEditor.ts
│   ├── useNodeDrag.ts
│   └── useWorkflowValidation.ts
├── store/
│   ├── workflow-editor.store.ts  # Feature-local Zustand store
│   └── actions/
│       ├── action.add-node.ts
│       └── action.connect-nodes.ts
├── types.ts
├── utils/
│   ├── node-validation.ts
│   └── layout-engine.ts
└── constants.ts
```

## The Index File (Public API)

The `index.ts` defines what the feature exports to the outside world.

### Minimal Export

```typescript
// @public/features/datastore-dialogs/index.ts

/**
 * Datastore Dialogs Feature
 *
 * Centralized dialog management system for datastore operations.
 * Provides type-safe dialog triggering from anywhere in the application.
 */

export { DatastoreDialogsProvider, useDatastoreDialogs } from "./DatastoreDialogsProvider";
export type {
  DatastoreDialogName,
  DatastoreDialogRegistry,
  AddTableMetadata,
  RenameTableMetadata,
  DeleteTableMetadata,
  DeleteDatastoreMetadata,
} from "./types";
```

### Key Principles

1. **Only export what's needed** - Keep internal components private
2. **Type exports** - Export TypeScript types consumers need
3. **Documentation** - Add JSDoc comment explaining the feature
4. **Re-exports** - Centralize exports from submodules

## Provider Pattern

Features often expose a Provider component for context-based state management.

### Provider Structure

```typescript
// @public/features/my-feature/MyFeatureProvider.tsx

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Context value interface - what the provider exposes
 */
interface MyFeatureContextValue {
  state: MyFeatureState;
  actions: {
    doSomething: (arg: string) => void;
    resetState: () => void;
  };
}

/**
 * Create context
 */
const MyFeatureContext = createContext<MyFeatureContextValue | null>(null);

/**
 * Provider props
 */
interface MyFeatureProviderProps {
  children: ReactNode;
  initialValue?: string; // Optional configuration
}

/**
 * Provider component - manages feature state and logic
 */
export function MyFeatureProvider({ children, initialValue }: MyFeatureProviderProps) {
  const [state, setState] = useState<MyFeatureState>({
    value: initialValue || '',
    isOpen: false,
  });

  const doSomething = (arg: string) => {
    setState((prev) => ({ ...prev, value: arg }));
  };

  const resetState = () => {
    setState({ value: '', isOpen: false });
  };

  return (
    <MyFeatureContext.Provider value={{ state, actions: { doSomething, resetState } }}>
      {children}
    </MyFeatureContext.Provider>
  );
}

/**
 * Hook to access feature context
 */
export function useMyFeature() {
  const context = useContext(MyFeatureContext);
  if (!context) {
    throw new Error("useMyFeature must be used within MyFeatureProvider");
  }
  return context;
}
```

### Provider Best Practices

```typescript
// ✅ Good - Separate state and actions
interface ContextValue {
  state: MyState;
  actions: MyActions;
}

// ✅ Good - Type-safe actions
const actions = {
  setValue: (value: string) => setState({ value }),
  increment: () => setState(s => ({ count: s.count + 1 })),
};

// ✅ Good - Memoize expensive computations
const derivedValue = useMemo(
  () => computeExpensiveValue(state),
  [state]
);

// ❌ Bad - Mixing state and actions in flat object
interface ContextValue {
  value: string;
  count: number;
  setValue: (v: string) => void;
  increment: () => void;
}

// ❌ Bad - Not memoizing providers
return (
  <Context.Provider value={{ state, actions }}>  {/* Creates new object every render */}
    {children}
  </Context.Provider>
);
```

## Feature-Local State Management

Features can have their own Zustand store for complex state:

```typescript
// @public/features/workflow-editor/store/workflow-editor.store.ts

import { createStore } from 'zustand';

export type WorkflowEditorStore = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;

  addNode: (node: Node) => void;
  removeNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
};

export const workflowEditorStore = createStore<WorkflowEditorStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, node]
  })),

  removeNode: (nodeId) => set((state) => ({
    nodes: state.nodes.filter(n => n.id !== nodeId),
    edges: state.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
  })),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
}));
```

**When to use feature-local store:**
- State is complex with many actions
- Multiple components in the feature need the same state
- State updates are frequent

**When to use Context instead:**
- Simple state (2-3 values)
- Infrequent updates
- Provider wraps a small component tree

## Feature Components

Components inside a feature are private by default. Only export what's needed.

```typescript
// @public/features/my-feature/components/InternalComponent.tsx
// Not exported from index.ts - private to feature

export function InternalComponent() {
  return <div>Internal use only</div>;
}

// @public/features/my-feature/components/PublicComponent.tsx
// Exported from index.ts - public API

export function PublicComponent() {
  return <div>Available to other features</div>;
}
```

### Component Organization

```typescript
// ✅ Good - Clear component hierarchy
components/
├── MyFeatureMain.tsx       # Main component
├── SubComponentA.tsx       # Used by Main
├── SubComponentB.tsx       # Used by Main
└── dialogs/
    ├── CreateDialog.tsx
    └── EditDialog.tsx

// ❌ Bad - Flat structure with unclear relationships
components/
├── Component1.tsx
├── Component2.tsx
├── Component3.tsx
├── Component4.tsx
└── Component5.tsx
```

## Feature Hooks

Hooks encapsulate feature logic and can be reused across feature components.

```typescript
// @public/features/data-table/hooks/useTableFilter.ts

import { useState, useMemo } from 'react';

export function useTableFilter<T>(data: T[], filterKey: keyof T) {
  const [filterValue, setFilterValue] = useState('');

  const filteredData = useMemo(() => {
    if (!filterValue) return data;
    return data.filter(item =>
      String(item[filterKey]).toLowerCase().includes(filterValue.toLowerCase())
    );
  }, [data, filterKey, filterValue]);

  return {
    filterValue,
    setFilterValue,
    filteredData,
  };
}
```

### Hook Best Practices

```typescript
// ✅ Good - Descriptive hook names
useWorkflowValidation()
useNodeDragAndDrop()
useTableSorting()

// ✅ Good - Return objects for clarity
return {
  data: filteredData,
  isLoading,
  error,
  refetch,
};

// ✅ Good - Type parameters for reusability
function useTableFilter<T>(data: T[], key: keyof T) { }

// ❌ Bad - Generic hook names
useData()
useLogic()
useState() // Conflicts with React

// ❌ Bad - Return arrays when many values
return [data, loading, error, refetch, page, setPage]; // Hard to remember order
```

## Feature Types

Define feature-specific types in `types.ts`:

```typescript
// @public/features/workflow-editor/types.ts

/**
 * Node in the workflow
 */
export interface WorkflowNode {
  id: string;
  type: 'action' | 'condition' | 'loop';
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

/**
 * Edge connecting two nodes
 */
export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

/**
 * Workflow validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Type aliases for common types
 */
export type NodeId = string;
export type EdgeId = string;
```

## Integration with Global Store

Features should avoid direct global store access. Instead, pass data as props.

```typescript
// ✅ Good - Feature receives props, no global store dependency
function MyFeature({ datastores }: { datastores: TDatastore[] }) {
  return <div>{datastores.length} datastores</div>;
}

// Parent component provides data from global store
function Parent() {
  const datastores = useStore(globalStore, (state) => state.datastores);
  return <MyFeature datastores={datastores} />;
}

// ❌ Bad - Feature directly accesses global store
function MyFeature() {
  const datastores = useStore(globalStore, (state) => state.datastores);
  return <div>{datastores.length} datastores</div>;
}
```

**Exceptions:** Features can access global store if they truly need global state (auth, theme, etc.).

## Complete Example: Dialog Feature

This example shows a complete feature implementation:

```typescript
// @public/features/datastore-dialogs/index.ts
export { DatastoreDialogsProvider, useDatastoreDialogs } from "./DatastoreDialogsProvider";
export type { DatastoreDialogName, DatastoreDialogRegistry } from "./types";

// @public/features/datastore-dialogs/types.ts
export interface AddTableMetadata {
  datastoreId: string;
  tableName?: string;
}

export interface DatastoreDialogRegistry {
  addTable: AddTableMetadata;
  renameTable: RenameTableMetadata;
  // ... more dialogs
}

export type DatastoreDialogName = keyof DatastoreDialogRegistry;

// @public/features/datastore-dialogs/DatastoreDialogsProvider.tsx
export function DatastoreDialogsProvider({ children }: Props) {
  const [dialogStates, setDialogStates] = useState<Record<string, DialogState>>({});

  const openDialog: OpenDialogFn = (name, metadata) => {
    setDialogStates(prev => ({ ...prev, [name]: { open: true, metadata } }));
  };

  return (
    <Context.Provider value={{ openDialog }}>
      {children}
      <AddTableDialog {...dialogStates.addTable} />
      {/* ... more dialogs */}
    </Context.Provider>
  );
}

// Usage in components
function MyComponent() {
  const { openDialog } = useDatastoreDialogs();

  return (
    <button onClick={() => openDialog("addTable", { datastoreId: "123" })}>
      Add Table
    </button>
  );
}
```

## Feature Documentation

Add a README.md for complex features:

```markdown
# Workflow Editor Feature

Visual workflow builder with drag-and-drop node editing.

## Usage

\`\`\`tsx
import { WorkflowEditorProvider, WorkflowCanvas } from "@public/features/workflow-editor";

function App() {
  return (
    <WorkflowEditorProvider>
      <WorkflowCanvas />
    </WorkflowEditorProvider>
  );
}
\`\`\`

## Components

- `WorkflowCanvas` - Main editor canvas
- `NodePalette` - Available node types
- `PropertyPanel` - Edit node properties

## Hooks

- `useWorkflowEditor()` - Access editor state and actions
- `useNodeDrag()` - Handle node drag operations
```

## Testing Features

Test features as complete units:

```typescript
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { MyFeatureProvider, useMyFeature } from './index';

describe('MyFeature', () => {
  it('should provide context to children', () => {
    function TestComponent() {
      const { state } = useMyFeature();
      return <div>{state.value}</div>;
    }

    render(
      <MyFeatureProvider initialValue="test">
        <TestComponent />
      </MyFeatureProvider>
    );

    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('should throw error when used outside provider', () => {
    function TestComponent() {
      const context = useMyFeature(); // Should throw
      return <div>Should not render</div>;
    }

    expect(() => render(<TestComponent />)).toThrow();
  });
});
```

## Migration to Features

When to extract code into a feature:

1. **Identify cohesive functionality** - Related components/hooks working together
2. **Create feature folder** - `@public/features/my-feature/`
3. **Move components** - Organize into `components/` subdirectory
4. **Extract hooks** - Move to `hooks/` subdirectory
5. **Create provider** - If state management is needed
6. **Define exports** - Create `index.ts` with public API
7. **Update imports** - Change import paths to use feature
8. **Test thoroughly** - Ensure nothing broke

See `@public/features/datastore-dialogs/` for a complete reference implementation.
