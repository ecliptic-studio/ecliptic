import { kysely } from "@server/db";
import type { Job } from "@server/db.d";
import type { Selectable } from "kysely";
import { sql } from "kysely";

type JobRow = Selectable<Job> & { id: number };

// Pick the next runnable job:
// - unlocked pending/failed rows ready to run
// - or stale processing rows whose lock is older than 1 hour (runner likely died)
async function pullNextJob(lockedBy = "scheduler"): Promise<JobRow | null> {
  const staleLockThreshold = sql<string>`datetime(CURRENT_TIMESTAMP, '-1 hour')`;

  return kysely.transaction().execute(async (trx) => {
    const job = await trx
      .with("next_job", (db) =>
        db
          .selectFrom("job")
          .select(["id"])
          .where((eb) =>
            eb.or([
              eb.and([
                eb("state", "in", ["pending", "failed"]),
                eb("locked_at", "is", null),
              ]),
              eb.and([
                eb("state", "=", "processing"),
                eb("locked_at", "<", staleLockThreshold),
              ]),
            ]),
          )
          .whereRef("attempts", "<", "max_attempts")
          .where("runs_after", "<=", sql<string>`CURRENT_TIMESTAMP`)
          .orderBy("runs_after", "asc")
          .orderBy("id", "asc")
          .limit(1),
      )
      .updateTable("job")
      .set({
        state: "processing",
        locked_by: lockedBy,
        locked_at: sql`CURRENT_TIMESTAMP`,
        updated_at: sql`CURRENT_TIMESTAMP`,
        attempts: sql`attempts + 1`,
      })
      .where("id", "in", (eb) =>
        eb.selectFrom("next_job").select("next_job.id"),
      )
      .returningAll()
      .executeTakeFirst();

    if (!job || job.id == null) {
      return null;
    }

    return job as JobRow;
  });
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runJob(runnerId: string) {
  // console.log('runJob ' + new Date().toTimeString().slice(0, 8));
  // TODO: orchestrate worker loops once job handlers exist.
  while(true) {
    console.log(`${runnerId} waiting for job`);
    const job = await pullNextJob(runnerId);
    if(job == null) {
      await wait(1000);
      continue;
    }

    console.log(`${runnerId} running job ${job.id}`);
    try {
      // TODO: execute job handler based on job.type
      await markJobSuccess(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markJobFailure(job, message);
    }
  }
}

async function markJobSuccess(jobId: number) {
  await kysely
    .updateTable("job")
    .set({
      state: "completed",
      locked_at: null,
      completed_at: sql`CURRENT_TIMESTAMP`,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .where("id", "=", jobId)
    .executeTakeFirst();
}

async function markJobFailure(job: JobRow, errorMessage: string, retryDelaySeconds = 60) {
  const hasRetriesRemaining = job.attempts < job.max_attempts;
  const nextState = hasRetriesRemaining ? "failed" : "dead";
  const retryWindow = `${retryDelaySeconds} seconds`;

  const updateBuilder = kysely
    .updateTable("job")
    .set({
      state: nextState,
      locked_at: null,
      error_message: errorMessage,
      updated_at: sql`CURRENT_TIMESTAMP`,
      ...(hasRetriesRemaining
        ? { runs_after: sql`datetime(CURRENT_TIMESTAMP, ${retryWindow})` }
        : {}),
    })
    .where("id", "=", job.id);

  await updateBuilder.executeTakeFirst();
}

export function startJobLoop() {
  runJob('runner-1');
  // runJob('runner-2');
  // runJob('runner-3');
}