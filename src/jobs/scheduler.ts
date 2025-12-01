import { kysely } from "@server/db";
import type { TJob, TJobType } from "@server/dto/TJob";
import { sql } from "kysely";
import type { TJobResult } from "./job.typs";


// Pick the next runnable job:
// - unlocked pending/failed rows ready to run
// - or stale processing rows whose lock is older than 1 hour (runner likely died)
async function pullNextJob(lockedBy = "scheduler"): Promise<TJob | null> {
  const staleLockThreshold = sql<string>`datetime(CURRENT_TIMESTAMP, '-1 hour')`;

  const jobDb = await kysely.with("next_job", (db) =>
    db
      .selectFrom("job")
      .select(["id"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("state", "in", ["pending", "failed"]),
            eb.or([
              eb("locked_at", "is", null),
              eb("locked_at", "<", staleLockThreshold),
            ]),
          ]),
          eb.and([
            eb("state", "=", "processing"),
            eb.or([
              eb("locked_at", "is", null),
              eb("locked_at", "<", staleLockThreshold),
            ]),
          ]),
        ]),
      )
      .whereRef("attempts", "<", "max_attempts")
      .where(sql<string>`datetime(runs_after)`, "<=", sql<string>`CURRENT_TIMESTAMP`)
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
  if (!jobDb) return null;

  return {
    ...jobDb,
    payload: JSON.parse(jobDb.payload),
    type: jobDb.type as TJobType,
    state: jobDb.state as 'pending' | 'failed' | 'processing' | 'completed',
  }


}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

async function markJobFailure(job: TJob, errorMessage: string, retryDelaySeconds = 60) {
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

async function spawnRunner(runnerId: string, job: TJob) {
  const childProc = Bun.spawn(["bun", "src/jobs/runner.ts", JSON.stringify(job)], {
    async ipc(message: TJobResult, childProc) {
      message.newJobs.forEach(async (newJob) => {
        await kysely.insertInto('job').values({
          ...newJob,
          payload: JSON.stringify(newJob.payload),
        }).execute();
      })
      if (message.error) {
        await markJobFailure(job, message.error);
      } else {
        await markJobSuccess(job.id)
      }

    },
    async onExit(subprocess, exitCode, signalCode, error) {
      if (exitCode !== 0) {
        await markJobFailure(job, 'Runner exited with code ' + exitCode + ' ' + signalCode + ' ' + error);
      }
    },

    timeout: 1000 * 60 * 5, // 5 minutes
    stdout: "inherit",
    stderr: "inherit",
  });

  await childProc.exited
}

async function runJob(runnerId: string) {
  // console.log('runJob ' + new Date().toTimeString().slice(0, 8));
  // TODO: orchestrate worker loops once job handlers exist.
  while (true) {
    const job = await pullNextJob(runnerId);
    if (job == null) {
      await wait(1000);
      continue;
    }

    console.log(`${runnerId} running job ${job.id}`);
    try {
      await spawnRunner(runnerId, job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markJobFailure(job, message);
    }
  }
}


export function startJobLoop() {
  runJob('runner-1');
  // runJob('runner-2');
  // runJob('runner-3');
}