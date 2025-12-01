import type { Selectable } from "kysely";
import type { MailboxEmail } from "@server/db.d";
import type { TJob } from "@server/dto/TJob";

export type TJobResult<T = any> = {
  newJobs: Omit<TJob<'pull-emails-from-microsoft'>, 'id'>[];
  result?: T;
  error: string | null
}
