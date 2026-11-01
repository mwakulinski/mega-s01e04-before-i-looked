import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';
import type { DigestRow, Night } from '../src/digest/types.js';

function rowsOf(night: Night): DigestRow[] {
  if (!night.found) throw new Error('night not found');
  return night.rows;
}

function row(night: Night, job: string): DigestRow {
  const r = rowsOf(night).find((x) => x.job === job);
  if (!r) throw new Error(`no row for ${job}`);
  return r;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('gives 5 jobs, sorted, and 1 bad line', () => {
    expect(night.found).toBe(true);
    if (!night.found) return;
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('fixtures/refresh: 4 runs, 3 retries, last ok', () => {
    expect(row(night, 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('digest/render keeps the row with owner null', () => {
    const r = row(night, 'digest/render');
    expect(r.owner).toBeNull();
    expect(r.runs).toBe(1);
    expect(r.lastError).toBeNull();
  });

  it('notes/backup failed with "quota exceeded"', () => {
    const r = row(night, 'notes/backup');
    expect(r.lastStatus).toBe('fail');
    expect(r.lastError).toBe('quota exceeded');
  });

  it('keeps times as written, offset included', () => {
    const r = row(night, 'lane/sync');
    expect(r.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(r.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('no file for the night is not found', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({ found: false });
  });

  it('an empty file is an empty night', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ found: true, rows: [], badLines: 0 });
  });

  it('counts bad lines and never throws', () => {
    const lines = [
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      'not json',
      '[1,2]',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"maybe","owner":"x"}',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok"}',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":7}',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"x","error":5}',
      '{"job":"a","status":"ok","owner":"x"}',
      '',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n'));
    const night = readNight(dir, '2026-01-01');
    expect(night).toMatchObject({ found: true, badLines: 7 });
    expect(rowsOf(night)).toHaveLength(1);
  });

  it('lastError is the most recent error, even after an ok', () => {
    const lines = [
      '{"at":"t1","job":"a","status":"retry","owner":"x","error":"first"}',
      '{"at":"t2","job":"a","status":"retry","owner":"x","error":"second"}',
      '{"at":"t3","job":"a","status":"ok","owner":"x"}',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n') + '\n');
    expect(row(readNight(dir, '2026-01-01'), 'a')).toMatchObject({
      runs: 3,
      retries: 2,
      lastStatus: 'ok',
      lastError: 'second',
      firstAt: 't1',
      lastAt: 't3',
    });
  });

  it('a night that is not YYYY-MM-DD is not found, even if the file exists', () => {
    writeFileSync(join(dir, 'secret.jsonl'), '{"at":"t","job":"a","status":"ok","owner":null}');
    expect(readNight(dir, 'secret')).toEqual({ found: false });
    expect(readNight(join(dir, 'sub'), '../secret')).toEqual({ found: false });
    expect(readNight(dir, '2026-01-01/../secret')).toEqual({ found: false });
  });
});
