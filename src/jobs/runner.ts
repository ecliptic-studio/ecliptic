/**
 * Entry point for Bun.spawn
 * 
 * Takes TJob as serialized JSON
 */

import type { TJob } from "@server/dto/TJob";
import { jobPullEmailsFromMicrosoft } from "./job.pull-emails-from-microsoft";
import { kysely } from "@server/db";
import type { TJobResult } from "./job.typs";
import { tInternal } from "@server/error/t-error";

if(!process.send) {
  const errorMsg = 'No process.send found. Make sure to spawn the runner with Bun.spawn'
  console.error(errorMsg);
  process.exit(1);
}

const jobJson = process.argv[2];

if(!jobJson) {
  const error: TJobResult = {
    newJobs: [],
    error: 'No job provided',
  } ;
  process.send(error);
  process.exit(0);
}

const job: TJob = JSON.parse(jobJson);

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
await wait(2000);

let jobResult: TJobResult = {
  error: null,
  newJobs: [],
}

switch(job.type) {
  case 'pull-emails-from-microsoft':
    await jobPullEmailsFromMicrosoft({db: kysely}, {job}).then(([result, error]) => {
      if(error) {
        jobResult.error = tInternal('en', error)
        return
      }
      jobResult = result
    })
    break;
  default:
    const error: TJobResult = {
      newJobs: [],
      error: 'Unknown job type: ' + job.type,
    } ;
    process.send(error)
    process.exit(0);
}

process.send(jobResult);

process.exit(0);