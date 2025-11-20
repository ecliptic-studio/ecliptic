import type { Selectable } from "kysely";
import type { MailboxEmail } from "@server/db.d";
import type { TJob } from "@server/dto/TJob";

export type TJobResult<T = any> = {
  newJobs: TJob[];
  result?: T;
  error: string | null
}
