export type TJobType = 'pull-emails-from-microsoft';

export type TJobPayloadPullEmailsFromMicrosoft = {
  mailboxEmail: string;
  nextLink?: string;
}

// Map job types to their payload types
type TJobPayloadMap = {
  'pull-emails-from-microsoft': TJobPayloadPullEmailsFromMicrosoft;
}

// Generic job type that infers payload based on type
// Usage: TJob (payload is Record<string, any>)
// Usage: TJob<'pull-emails-from-microsoft'> (payload is TJobPayloadPullEmailsFromMicrosoft)
export type TJob<T extends TJobType = TJobType> = {
  id: number;
  type: T;
  payload: T extends keyof TJobPayloadMap ? TJobPayloadMap[T] : Record<string, any>;
  state: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  runs_after: string;
  locked_by: string | null;
  locked_at: string | null;
  attempts: number;
  max_attempts: number;
}