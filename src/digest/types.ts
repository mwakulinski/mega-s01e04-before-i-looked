// Plan morning-digest § 1. The contract every part of § 2 codes against; the reader itself
// lives in src/digest/read.ts.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after it parsed.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night. Times are kept as the log wrote them, offset included.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as '—'
  runs: number; // lines for this job
  retries: number; // lines with status 'retry'
  lastStatus: RunStatus;
  lastError: string | null; // the most recent `error` seen for this job
  firstAt: string;
  lastAt: string;
};

// No file for the night is not the same as an empty night: the page answers 404 for one and
// "nothing ran" for the other.
export type Night =
  | { found: false }
  | { found: true; rows: DigestRow[]; badLines: number }; // rows sorted by job

export type ReadNight = (runsDir: string, night: string) => Night;
