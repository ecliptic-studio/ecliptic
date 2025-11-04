import type { TGlobalStore } from '../store.global';

export type ZustandSetter = (
  partial: TGlobalStore | Partial<TGlobalStore> | ((state: TGlobalStore) => TGlobalStore | Partial<TGlobalStore>),
  replace?: false | undefined
) => void;

export type ZustandGetter = () => TGlobalStore;