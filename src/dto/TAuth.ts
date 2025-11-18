import type { TSession } from "./TSession";
import type { TUser } from "./TUser";

export type TAuth = {
  user: TUser;
  session: TSession;
}
