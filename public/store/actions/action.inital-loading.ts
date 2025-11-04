import type { ZustandSetter } from "./store.types";
import rpcClient from "@public/rpc-client";
import { produce } from 'immer';
import { toast } from "sonner";
import type { TGlobalStore } from "../store.global";


export default function (set: ZustandSetter) {
  // load data from server
  // not yet

  return async () => {
    const {data, error} = await rpcClient.api.v1.data.get()
    if(error) {
      console.error(error.value.message)
      toast.error(error.value.message)
    } else {
      set(produce((state: TGlobalStore) => { 
        state.datastores = data.datastores
       }))
    }
  }
}