import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a> ok 10 · retry 4 · fail 1');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a> ok 7 · retry 0 · fail 0');
    expect(html.indexOf('2026-10-28')).toBeLessThan(html.indexOf('2026-10-27'));
  });

  it('counts parsed lines only and still links a night with a bad line', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-status-'));
    try {
      writeFileSync(
        join(dir, '2026-11-01.jsonl'),
        [
          JSON.stringify({ at: '2026-11-01T01:00:00+01:00', job: 'a', status: 'ok', owner: 'rook' }),
          'not json',
          JSON.stringify({ at: '2026-11-01T01:01:00+01:00', job: 'a', status: 'fail', owner: null, error: 'x' }),
          JSON.stringify({ at: '2026-11-01T01:02:00+01:00', job: 'b', status: 'retry', owner: 'rook' }),
          '',
        ].join('\n'),
      );
      const res = await createApp({ ...config, runsDir: dir }).request('/');
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('<a href="/digest/2026-11-01">2026-11-01</a> ok 1 · retry 1 · fail 1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
