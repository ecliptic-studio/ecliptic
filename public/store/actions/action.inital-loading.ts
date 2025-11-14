import type { ZustandSetter } from "./store.types";
import apis from "@public/api-calls";
import { produce } from 'immer';
import { toast } from "sonner";
import type { TGlobalStore } from "../store.global";


export default function (set: ZustandSetter) {
  // load data from server
  // not yet

  return async () => {
    const [data, error] = await apis["/api/v1/data"].GET()
    if(error !== null) {
      console.error(error)
      toast.error(error)
    } else {
      set(produce((state: TGlobalStore) => { 
        state.datastores = data.datastores
       }))
    }
  }
}