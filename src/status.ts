import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RigConfig } from './config.js';
import { parseLine } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

// Run lines of one night, by status. A line that doesn't parse is not counted.
export type NightCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type NightOnDisk = {
  night: string;
  ok: number;
  retry: number;
  fail: number;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightOnDisk[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function readLog(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw e;
  }
}

// Counts parsed lines in <runsDir>/<night>.jsonl. Bad lines are skipped.
export function nightCounts(runsDir: string, night: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  const text = readLog(join(runsDir, `${night}.jsonl`));
  if (text === null) return counts;
  for (const raw of text.split('\n')) {
    const line = parseLine(raw);
    if (!line) continue;
    counts[line.status]++;
  }
  return counts;
}

export function readStatus(config: RigConfig): Status {
  const { runsDir } = config;
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(runsDir).map((night) => ({ night, ...nightCounts(runsDir, night) })),
  };
}
