import type { Night } from '../digest/types.js';

// Plan morning-digest § 2a. Rows stay in the order readNight returns.

export function Digest({ night, read }: { night: string; read: Night }) {
  if (!read.found) return <p>no run log for {night}</p>;

  return (
    <>
      <h1>digest {night}</h1>
      {read.rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {read.rows.map((row) => (
              <tr class={row.retries >= 3 || row.lastStatus === 'fail' ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? '—'}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {read.badLines > 0 ? <p>{read.badLines} line(s) didn't parse</p> : null}
    </>
  );
}
