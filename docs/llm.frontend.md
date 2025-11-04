## Frontend file structure

all frontend files are in @src/frontend

We use a feature folder patterns.
Frontend features are put in including components and hooks and local! state.

Feature not related data must be put in the global zustand store. @src/frontend/store/store.global.ts

All sharable components are put in @src/frontend/components
All basecn components will automatically be installed in @src/frontend/components/ui

All sharable hooks are put in @src/frontend/hooks