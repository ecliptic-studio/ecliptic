# App Sidebar Feature

The App Sidebar is a comprehensive navigation and layout feature that provides the main application shell with sidebar navigation, header management, and content rendering.

## Overview

The App Sidebar feature combines multiple UI patterns to create a cohesive application navigation experience:

- **Sidebar Navigation**: Collapsible sidebar with hierarchical datastore/table navigation
- **Dynamic Header**: Context-aware header that pages can customize
- **User Menu**: Dropdown menu with profile, settings, and authentication actions
- **Layout Management**: Handles the main application layout with responsive behavior

## Architecture

### Component Structure

```
@public/features/app-sidebar/
├── index.ts                     # Public API exports
├── AppSidebarProvider.tsx       # Main provider component (all-in-one)
└── app-sidebar.i18n.json        # Feature translations
```

**Note**: This is currently a single-component implementation. All UI logic (header, datastore navigation, table menus, user menu) is contained within `AppSidebarProvider.tsx`. Future refactoring could split this into separate components in a `components/` subdirectory.

### Key Component

#### AppSidebarProvider

The main component that wraps the entire application layout. This is a single comprehensive component that includes all sidebar functionality.

**Structure:**
```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarHeader>
      {/* App branding with Zap icon */}
    </SidebarHeader>

    <SidebarContent>
      {/* Datastore navigation tree */}
    </SidebarContent>

    <SidebarFooter>
      {/* User menu dropdown */}
    </SidebarFooter>
  </Sidebar>

  <SidebarInset>
    <header>
      {/* Dynamic header from HeaderContext */}
    </header>
    <div>
      <Outlet /> {/* React Router page content */}
    </div>
  </SidebarInset>
</SidebarProvider>
```

**Responsibilities:**
- Provides the base UI structure using basecn/shadcn Sidebar components
- Integrates with `HeaderContext` for dynamic header content
- Renders React Router `<Outlet />` for page content
- Manages collapsible state for datastore navigation trees
- Displays user authentication status and actions
- Provides context menus for datastore/table CRUD operations

### State Management

#### Global Store Integration

The sidebar reads from `globalStore`:

```typescript
const datastores = useStore(globalStore, (state) => state.datastores);
```

**Store Schema:**
- `datastores: TDatastore[]` - List of all datastores with schema information

The sidebar does NOT write to global store - it only reads. Actions like creating/deleting datastores are handled by dialog features.

#### Local State

Managed via React `useState`:

```typescript
const [openDatastores, setOpenDatastores] = useState<Record<string, boolean>>({});
```

**Purpose:** Track which datastore nodes are expanded/collapsed in the tree view.

**Why not Zustand?** This is simple UI toggle state that doesn't need to be shared globally. Using `useState` is sufficient and follows the principle of "local state for local concerns."

### Context Integration

#### HeaderContext

The sidebar integrates with `HeaderContext` to provide dynamic header management:

```tsx
const { headerContent } = useHeader();

// Pages can set header content using:
setHeaderContent({
  title: "My Page",
  subtitle: "Description",
  actions: <Button>Action</Button>
});
```

**Header Structure:**
```typescript
interface HeaderContent {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;  // Right-aligned action buttons
}
```

This allows each page to customize the header without prop drilling.

#### DatastoreDialogsProvider

The sidebar uses the `datastore-dialogs` feature for CRUD operations:

```tsx
const { openDialog } = useDatastoreDialogs();

openDialog("addTable", {
  datastoreId: "abc123",
  tableName: "users"
});
```

**Available Dialogs:**
- `addTable` - Create new table in datastore
- `renameTable` - Rename existing table
- `deleteTable` - Delete table
- `deleteDatastore` - Delete entire datastore

This keeps the sidebar component clean by delegating dialog management to a specialized feature.

### Internationalization (i18n)

The sidebar uses the centralized i18n system with feature-local translations:

```typescript
import appSidebarTranslations from "./app-sidebar.i18n.json";
import { t } from "@public/i18n/t";
import { getLangFx } from "@public/i18n/get-lang";

const lang = getLangFx(); // Gets current language from cookie/browser
const text = t(lang, appSidebarTranslations.dataStores); // "Data Stores" or "Datenspeicher"
```

**Translation File Structure (`app-sidebar.i18n.json`):**
```json
{
  "appName": { "en": "Ecliptic", "de": "Ecliptic" },
  "appSubtitle": { "en": "Core", "de": "Core" },
  "dataStores": { "en": "Data Stores", "de": "Datenspeicher" },
  "addTable": { "en": "Add Table", "de": "Tabelle hinzufügen" },
  "renameTable": { "en": "Rename Table", "de": "Tabelle umbenennen" },
  "deleteTable": { "en": "Delete Table", "de": "Tabelle löschen" },
  "deleteDatastore": { "en": "Delete Datastore", "de": "Datenspeicher löschen" },
  "profile": { "en": "Profile", "de": "Profil" },
  "settings": { "en": "Settings", "de": "Einstellungen" },
  "logOut": { "en": "Log out", "de": "Abmelden" },
  "guest": { "en": "Guest", "de": "Gast" }
}
```

**All UI text is translated:**
- App branding (name, subtitle)
- Navigation labels (Data Stores section)
- Context menu actions (Add/Rename/Delete for tables and datastores)
- User menu items (Profile, Settings, Log out)
- Fallback text (Guest user)

**Supported Languages:** Currently `en` (English) and `de` (German). The i18n system supports 30+ languages, but only the languages with actual translations are implemented.

### Navigation

The sidebar uses React Router for navigation:

```tsx
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();

// Navigate to datastore creation
navigate("/datastore");

// Navigate to table detail
navigate(`/datastore/${datastoreId}/table/${tableName}`);
```

### Authentication

Uses BetterAuth for session management:

```tsx
import { betterAuthClient } from "@public/lib/auth-client";

const { data: session } = betterAuthClient.useSession();

// Access user info
session?.user?.name
session?.user?.email
session?.user?.image

// Sign out
betterAuthClient.signOut();
```

## Component Hierarchy

```
AppSidebarProvider (Single component containing all logic)
├── SidebarProvider (from @components/ui/sidebar)
    ├── Sidebar
    │   ├── SidebarHeader
    │   │   └── SidebarMenu
    │   │       └── SidebarMenuItem
    │   │           └── SidebarMenuButton (App branding: Ecliptic Core with Zap icon)
    │   │
    │   ├── SidebarContent
    │   │   └── SidebarGroup
    │   │       ├── SidebarGroupLabel ("Data Stores" + Plus button)
    │   │       └── SidebarGroupContent
    │   │           └── SidebarMenu
    │   │               └── For each datastore:
    │   │                   └── SidebarMenuItem
    │   │                       └── Collapsible
    │   │                           ├── CollapsibleTrigger (Datastore name + chevron)
    │   │                           ├── DropdownMenu (Add Table, Delete Datastore)
    │   │                           └── CollapsibleContent
    │   │                               └── SidebarMenu (nested tables)
    │   │                                   └── For each table:
    │   │                                       └── SidebarMenuItem
    │   │                                           ├── SidebarMenuButton (navigates to table)
    │   │                                           └── DropdownMenu (Rename, Delete)
    │   │
    │   ├── SidebarFooter
    │   │   └── DropdownMenu
    │   │       ├── DropdownMenuTrigger (Avatar + User info)
    │   │       └── DropdownMenuContent
    │   │           ├── Profile
    │   │           ├── Settings
    │   │           └── Log out
    │   │
    │   └── SidebarRail
    │
    └── SidebarInset
        ├── <header> (Dynamic from HeaderContext)
        │   ├── SidebarTrigger (toggle button)
        │   ├── title + subtitle
        │   └── actions (right-aligned buttons)
        │
        └── <div> (scrollable content area)
            └── <Outlet /> (React Router renders page here)
```

## Data Flow

1. **Initial Load**: `globalStore.initialLoading()` fetches datastores from API
2. **Store Update**: Datastores stored in `globalStore.datastores`
3. **Sidebar Renders**: Reads datastores from store and renders tree
4. **User Actions**:
   - Click table → Navigate to table page
   - Click "..." menu → Open dialog via `useDatastoreDialogs()`
   - Dialog success → Refetches data → Store updates → Sidebar re-renders
5. **Header Updates**: Pages call `setHeaderContent()` → Header re-renders

## Usage Example

### Integration with AuthGuard

The sidebar is integrated via the `AuthGuard` component, which wraps all protected routes:

```tsx
// In AuthGuard.tsx
import { AppSidebarProvider } from "@public/features/app-sidebar";

export function AuthGuard() {
  const { data: session, isPending, error } = betterAuthClient.useSession();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (error || !session?.user) {
    return <Navigate to="/signup" replace />;
  }

  // Authenticated users see the sidebar layout
  return <AppSidebarProvider />; // Contains <Outlet /> for child routes
}
```

### App.tsx Structure

```tsx
// Required provider wrapping order
<BrowserRouter>
  <HeaderProvider>
    <QueryClientProvider client={queryClient}>
      <DatastoreDialogsProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/signin" element={<SigninPage />} />

          {/* Protected routes - wrapped by AuthGuard which renders AppSidebarProvider */}
          <Route element={<AuthGuard />}>
            <Route path="/" element={<Home />} />
            <Route path="/datastore" element={<DatastorePage />} />
            <Route path="/datastore/:id/table/:tableName" element={<DatastoreTablePage />} />
          </Route>
        </Routes>
        <Toaster />
      </DatastoreDialogsProvider>
    </QueryClientProvider>
  </HeaderProvider>
</BrowserRouter>
```

### Setting Page Headers

```tsx
// In any page component
import { useHeader } from "@public/contexts/HeaderContext";
import { useEffect } from "react";

function MyPage() {
  const { setHeaderContent, clearHeader } = useHeader();

  useEffect(() => {
    setHeaderContent({
      title: "My Page Title",
      subtitle: "Optional description",
      actions: (
        <Button onClick={handleAction}>
          Action Button
        </Button>
      ),
    });

    return () => clearHeader(); // Clean up on unmount
  }, [setHeaderContent, clearHeader]);

  return <div>Page content</div>;
}
```

### Triggering Dialogs from Other Components

```tsx
import { useDatastoreDialogs } from "@public/features/datastore-dialogs";

function MyComponent() {
  const { openDialog } = useDatastoreDialogs();

  return (
    <Button onClick={() =>
      openDialog("addTable", {
        datastoreId: "abc123"
      })
    }>
      Add Table
    </Button>
  );
}
```

## Styling

Uses Tailwind CSS with basecn component library (shadcn/ui API with Base UI primitives):

- **Sidebar**: `@components/ui/sidebar` - Pre-built sidebar primitives from basecn
- **Dropdown Menus**: `@components/ui/dropdown-menu` - Base UI dropdowns
- **Avatar**: `@components/ui/avatar` - User profile display
- **Collapsible**: `@components/ui/collapsible` - Expandable tree nodes

**Theme Support**: Automatically supports light/dark mode via Tailwind's `dark:` variants.

**Icons**: Uses `lucide-react` for all icons (Zap, Database, Table, ChevronDown, ChevronRight, MoreVertical, Plus, User, Settings, LogOut).

## Best Practices

1. **Don't access global store directly in pages**: The sidebar handles reading datastore data. Pages should receive data as props or use specific hooks.

2. **Use HeaderContext for page titles**: Don't create custom headers in page components - use the sidebar's header system.

3. **Use datastore dialogs feature**: Don't create inline dialogs for CRUD operations - use the centralized dialog system.

4. **Keep sidebar logic minimal**: The sidebar is for navigation, not business logic. Delegate complex operations to features/subroutines.

5. **Translation keys**: Only add translations that are actually used. Remove unused keys to keep the i18n file clean.

## Testing

Testing the sidebar requires mocking several dependencies:

```typescript
import { render, screen } from '@testing-library/react';
import { AppSidebarProvider } from './index';
import { BrowserRouter } from 'react-router-dom';

describe('AppSidebarProvider', () => {
  it('renders datastores from global store', () => {
    // Mock globalStore with test data
    // Mock betterAuthClient.useSession
    // Mock HeaderContext
    // Mock DatastoreDialogsProvider

    render(
      <BrowserRouter>
        <HeaderProvider>
          <DatastoreDialogsProvider>
            <AppSidebarProvider />
          </DatastoreDialogsProvider>
        </HeaderProvider>
      </BrowserRouter>
    );

    // Assert datastores are visible
    expect(screen.getByText('My Datastore')).toBeInTheDocument();
  });

  it('opens dialog when clicking add table', () => {
    // Mock useDatastoreDialogs with spy
    const openDialogSpy = vi.fn();

    // Render and click "Add Table" in dropdown
    // Assert openDialogSpy was called with correct args
    expect(openDialogSpy).toHaveBeenCalledWith('addTable', {
      datastoreId: 'test-id'
    });
  });

  it('displays user info from auth session', () => {
    // Mock session with user data
    // Assert user name and email are displayed
  });

  it('navigates to table page when clicking table', () => {
    // Mock navigate
    // Click table menu item
    // Assert navigate was called with correct path
  });
});
```

**Testing Challenges**: This component has many dependencies (global store, auth, routing, contexts). Consider splitting into smaller components for easier testing.

## Migration Notes

**Before (Component):**
- Located in `@public/components/AppSidebar.tsx`
- Located in `@public/components/AppSidebar.i18n.json`
- Hardcoded strings like "Add Table", "Profile", "Log out", etc.
- i18n file had 90 lines with many unused keys (objectStores, workflows, tooltips, etc.)
- Named `AppSidebar` (generic component name)
- All logic in single 286-line component

**After (Feature):**
- Located in `@public/features/app-sidebar/AppSidebarProvider.tsx`
- Located in `@public/features/app-sidebar/app-sidebar.i18n.json`
- All UI text properly translated using `t(lang, translations.key)`
- i18n file has 14 lines with only 11 used keys (cleaned up 79 unused keys)
- Named `AppSidebarProvider` (reflects role as layout provider)
- Uses `getLangFx()` to get current language dynamically
- Self-contained feature folder structure
- Feature-local i18n file
- Cleaner public API via `index.ts`
- Still a single component (future: could be split into sub-components)

## Dependencies

**Required Providers:**
- `<HeaderProvider>` - For dynamic header management
- `<DatastoreDialogsProvider>` - For CRUD dialogs

**Required Store:**
- `globalStore` - Must have `datastores` array

**External Services:**
- BetterAuth session (for user menu)
- React Router (for navigation)

## Future Enhancements

### Potential Feature Improvements:
1. **Search/Filter**: Add search bar to filter datastores and tables
2. **Keyboard Shortcuts**: Add hotkeys for navigation (e.g., Cmd+K for quick search)
3. **Favorites**: Pin frequently used tables to the top
4. **Recent Items**: Show recently accessed tables
5. **Drag & Drop**: Reorder datastores or tables
6. **Multi-Select**: Bulk operations on multiple tables
7. **Breadcrumbs**: Show current location in datastore hierarchy
8. **Notifications**: Badge count for changes or alerts

### Potential Refactoring:
1. **Split into sub-components**: Break down the 286-line component into:
   - `components/SidebarHeader.tsx` - App branding
   - `components/DatastoreNavigation.tsx` - Datastore tree
   - `components/DatastoreMenuItem.tsx` - Individual datastore with dropdown
   - `components/TableMenuItem.tsx` - Individual table with actions
   - `components/UserMenu.tsx` - Footer dropdown

2. **Extract hooks**:
   - `hooks/useDatastoreTree.ts` - Handle collapse/expand state
   - `hooks/useDatastoreActions.ts` - Handle CRUD actions

3. **Local state management**: If state grows complex, consider feature-local Zustand store

### Code Quality:
- Add comprehensive tests (currently none)
- Add JSDoc comments to component props
- Extract magic numbers to constants
- Add error boundaries for graceful failures
