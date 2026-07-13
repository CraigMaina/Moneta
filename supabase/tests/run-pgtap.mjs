// Docker-free pgTAP runner.
//
// `supabase test db` runs pgTAP inside a Docker container, so it can't be used
// on a machine without Docker (see DECISIONS.md — this environment has none).
// This script executes a pgTAP .sql file directly over a normal Postgres
// connection and prints the TAP result, so the RLS suite stays runnable after
// every migration change — CLAUDE.md requires the RLS assertion test never be
// skipped.
//
// Usage:
//   SUPABASE_DB_URL="postgresql://…:5432/postgres" node supabase/tests/run-pgtap.mjs
//   SUPABASE_DB_URL=…  node supabase/tests/run-pgtap.mjs supabase/tests/database/rls.test.sql
//
// The connection string (which contains the DB password) is read ONLY from the
// environment — never pass it on the command line or hardcode it here. Use the
// session-mode connection (port 5432), not the transaction pooler (6543):
// the suite uses SET LOCAL ROLE / set_config, which transaction mode rejects.

import { readFileSync } from 'node:fs'
import pg from 'pg'

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.MONETA_DB_URL
const sqlPath = process.argv[2] ?? 'supabase/tests/database/rls.test.sql'

if (!dbUrl) {
  console.error('Set SUPABASE_DB_URL (session-mode, port 5432) to the target database.')
  process.exit(2)
}

const sql = readFileSync(sqlPath, 'utf8')
const client = new pg.Client({ connectionString: dbUrl })

try {
  await client.connect()
  // Simple-query protocol runs the whole multi-statement file, including its
  // own begin/rollback; node-pg returns one result object per statement.
  const results = await client.query(sql)
  const sets = Array.isArray(results) ? results : [results]
  let passed = 0
  let failed = 0
  for (const r of sets) {
    for (const row of r?.rows ?? []) {
      const line = Object.values(row)[0]
      if (typeof line !== 'string') continue
      if (/^\s*ok\b/.test(line)) passed++
      else if (/^\s*not ok\b/.test(line)) failed++
      if (/^\s*(ok|not ok|#|\d+\.\.\d+)/.test(line)) console.log(line)
    }
  }
  console.log(`\n=== ${sqlPath}: ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
} catch (err) {
  console.error('EXECUTION ERROR:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
