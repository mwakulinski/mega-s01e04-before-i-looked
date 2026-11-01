import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

// Plan morning-digest § 1. Reads runs/<night>.jsonl into one row per job. A line that doesn't
// parse is counted, never thrown: the night still renders.

// Only a plain date: anything else could reach outside runsDir.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

function isStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && STATUSES.includes(v);
}

// One line of the log, or null when it isn't a valid RunLine.
export function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || at === '') return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (!('owner' in o) || (owner !== null && typeof owner !== 'string')) return null;
  if (error !== undefined && typeof error !== 'string') return null;
  return error === undefined ? { at, job, status, owner } : { at, job, status, owner, error };
}

function readFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw e;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return { found: false };
  const text = readFile(join(runsDir, `${night}.jsonl`));
  if (text === null) return { found: false };

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue; // blank lines (the trailing newline) are not lines
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    // File order is log order: the latest line wins for owner, status and time.
    const row = rows.get(line.job);
    if (!row) {
      rows.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    if (line.error !== undefined) row.lastError = line.error;
    if (line.owner !== null) row.owner = line.owner;
    row.lastAt = line.at;
  }

  const sorted = [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { found: true, rows: sorted, badLines };
};
