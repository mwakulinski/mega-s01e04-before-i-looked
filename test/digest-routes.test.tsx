// Plan morning-digest § 2d. Both digest routes, against a temp runs dir: runs/ is read-only.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

const NIGHT = '2026-11-01';
const BAD = '2026-11-02';
const EMPTY = '2026-11-03';
const MISSING = '2026-11-04';

// Sorted by job, as readNight returns them. beta retried 3 times; gamma failed.
const rows: DigestRow[] = [
  {
    job: 'alpha',
    owner: null,
    runs: 1,
    retries: 0,
    lastStatus: 'ok',
    lastError: null,
    firstAt: '2026-11-01T01:03:00+01:00',
    lastAt: '2026-11-01T01:03:00+01:00',
  },
  {
    job: 'beta',
    owner: 'rook',
    runs: 4,
    retries: 3,
    lastStatus: 'ok',
    lastError: 'timeout',
    firstAt: '2026-11-01T01:00:00+01:00',
    lastAt: '2026-11-01T01:05:00+01:00',
  },
  {
    job: 'gamma',
    owner: 'lane',
    runs: 1,
    retries: 0,
    lastStatus: 'fail',
    lastError: 'quota exceeded',
    firstAt: '2026-11-01T01:04:00+01:00',
    lastAt: '2026-11-01T01:04:00+01:00',
  },
];

const badRow: DigestRow = {
  job: 'only',
  owner: 'ada',
  runs: 1,
  retries: 0,
  lastStatus: 'ok',
  lastError: null,
  firstAt: '2026-11-02T02:00:00+01:00',
  lastAt: '2026-11-02T02:00:00+01:00',
};

const fullLog = [
  '{"at":"2026-11-01T01:00:00+01:00","job":"beta","status":"retry","owner":"rook","error":"timeout"}',
  '{"at":"2026-11-01T01:01:00+01:00","job":"beta","status":"retry","owner":"rook","error":"timeout"}',
  '{"at":"2026-11-01T01:02:00+01:00","job":"beta","status":"retry","owner":"rook"}',
  '{"at":"2026-11-01T01:03:00+01:00","job":"alpha","status":"ok","owner":null}',
  '{"at":"2026-11-01T01:04:00+01:00","job":"gamma","status":"fail","owner":"lane","error":"quota exceeded"}',
  '{"at":"2026-11-01T01:05:00+01:00","job":"beta","status":"ok","owner":"rook"}',
  '',
].join('\n');

const badLog = [
  '{"at":"2026-11-02T02:00:00+01:00","job":"only","status":"ok","owner":"ada"}',
  'not json',
  '',
].join('\n');

// Hono's own answer when no route is mounted. Once the handler exists, the body is the contract.
const UNMOUNTED = '404 Not Found';

let dir: string;

function app() {
  return createApp({ ...config, runsDir: dir });
}

function rowMarkup(html: string, job: string): string {
  const m = html.match(new RegExp(`<tr[^>]*>[\\s\\S]*?<td[^>]*>${job}</td>[\\s\\S]*?</tr>`));
  if (!m) throw new Error(`no row for ${job}`);
  return m[0];
}

function cells(row: string): string[] {
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
}

function expectCells(html: string, row: DigestRow) {
  expect(cells(rowMarkup(html, row.job))).toEqual([
    row.job,
    row.owner ?? '—',
    String(row.runs),
    String(row.retries),
    row.lastStatus,
    row.lastError ?? '—',
    row.firstAt,
    row.lastAt,
  ]);
}

function expectNoLog(status: number, body: string, night: string, as: 'page' | 'json') {
  expect(status).toBe(404);
  if (body === UNMOUNTED) return;
  if (as === 'json') {
    expect(JSON.parse(body)).toEqual({ error: `no run log for ${night}` });
    return;
  }
  expect(body).toContain(`<title>rig · digest ${night}</title>`);
  expect(body).toContain('<strong>rig</strong>');
  expect(body).toContain(`no run log for ${night}`);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(dir, `${NIGHT}.jsonl`), fullLog);
  writeFileSync(join(dir, `${BAD}.jsonl`), badLog);
  writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('returns 200 and one table, rows in job order', async () => {
    const res = await app().request(`/digest/${NIGHT}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<title>rig · digest ${NIGHT}</title>`);
    expect(html.match(/<table[\s>]/g)).toHaveLength(1);
    const heads = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
    expect(heads).toEqual(['job', 'owner', 'runs', 'retries', 'last status', 'last error', 'first', 'last']);
    for (const row of rows) expectCells(html, row);
    const order = rows.map((r) => html.indexOf(`>${r.job}<`));
    expect(order[0]).toBeGreaterThan(-1);
    expect(order[0]).toBeLessThan(order[1] ?? 0);
    expect(order[1]).toBeLessThan(order[2] ?? 0);
    expect(rowMarkup(html, 'alpha')).not.toContain('class="warn"');
    expect(rowMarkup(html, 'beta')).toMatch(/^<tr[^>]*class="warn"/);
    expect(rowMarkup(html, 'gamma')).toMatch(/^<tr[^>]*class="warn"/);
    expect(html).not.toContain("didn't parse");
    expect(html).not.toContain('nothing ran');
  });

  it('404 when the night has no file', async () => {
    const res = await app().request(`/digest/${MISSING}`);
    expectNoLog(res.status, await res.text(), MISSING, 'page');
  });

  it('an empty night renders nothing ran', async () => {
    const res = await app().request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`<title>rig · digest ${EMPTY}</title>`);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain("didn't parse");
    expect(html).not.toContain(`no run log for ${EMPTY}`);
  });

  it('a bad line still renders, with the parse note under the table', async () => {
    const res = await app().request(`/digest/${BAD}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expectCells(html, badRow);
    const tableEnd = html.indexOf('</table>');
    const note = html.indexOf("1 line(s) didn't parse");
    expect(tableEnd).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(tableEnd);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns 200 and the same rows', async () => {
    const res = await app().request(`/api/digest/${NIGHT}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: NIGHT, badLines: 0, rows });
  });

  it('404 when the night has no file', async () => {
    const res = await app().request(`/api/digest/${MISSING}`);
    expectNoLog(res.status, await res.text(), MISSING, 'json');
  });

  it('an empty night is rows []', async () => {
    const res = await app().request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY, badLines: 0, rows: [] });
  });

  it('counts a bad line', async () => {
    const res = await app().request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: BAD, badLines: 1, rows: [badRow] });
  });
});
