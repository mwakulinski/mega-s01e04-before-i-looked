import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';
import type { DigestRow } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

type DigestBody = { night: string; badLines: number; rows: DigestRow[] };

describe('GET /api/digest/:night', () => {
  it('returns 2026-10-28: 5 rows, sorted by job, one bad line', async () => {
    const read = readNight(config.runsDir, '2026-10-28');
    if (!read.found) throw new Error('fixture night missing');

    const res = await createApp(config).request('/api/digest/2026-10-28');
    const body = (await res.json()) as DigestBody;

    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(5);
    expect(body.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    // Page uses readNight too, so this is the shared order.
    expect(body.rows).toEqual(read.rows);
  });

  it('404 when there is no run log for the night', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-01-01' });
  });
});
