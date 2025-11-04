import { createStore } from 'zustand';
import createInitialLoadingAction from './actions/action.inital-loading';
import type { TDatastore } from '@dto/TDatastore';

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
  
  // Auto-load data on store creation
  setTimeout(() => store.initialLoading(), 0)
  
  return store
})
// @ts-ignore
window.store = globalStore