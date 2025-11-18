import type { TDatastore } from '@dto/TDatastore';
import type { TMailbox } from '@server/dto/TMailbox';
import { createStore } from 'zustand';
import createInitialLoadingAction from './actions/action.inital-loading';

type TError = {
  code: string
  message: string
}

export type TGlobalStore = {
  // no sliced yet
  datastores: TDatastore[]
  mailboxes: TMailbox[]
  initialLoading: () => Promise<void>
}

export const globalStore = createStore<TGlobalStore>((set, get) => {
  const store = {
    datastores: [],
    mailboxes: [],
    // Actions
    initialLoading: createInitialLoadingAction(set),
  }

  // auto-load in AuthGuard.tsx

  
  return store
})
// @ts-ignore
window.store = globalStore