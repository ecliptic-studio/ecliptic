import { createStore } from 'zustand';
import createInitialLoadingAction from './actions/action.inital-loading';
import type { TDatastore } from '@dto/TDatastore';
import { betterAuthClient } from "@public/lib/auth-client";

type TError = {
  code: string
  message: string
}

export type TGlobalStore = {
  // no sliced yet
  datastores: TDatastore[]
  initialLoading: () => Promise<void>
}

export const globalStore = createStore<TGlobalStore>((set, get) => {
  const store = {
    datastores: [],
    // Actions
    initialLoading: createInitialLoadingAction(set),
  }

  // auto-load in AuthGuard.tsx

  
  return store
})
// @ts-ignore
window.store = globalStore