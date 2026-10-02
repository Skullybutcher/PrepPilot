/**
 * testSupabaseConnection.js — smoke-tests the Phase D Supabase + encryption setup.
 *
 * Run with: node src/scripts/testSupabaseConnection.js
 *
 * Checks:
 *  1. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars are present.
 *  2. ENCRYPTION_KEY env var is present and valid (64 hex chars).
 *  3. Can connect to Supabase (list tables via service-role).
 *  4. `profiles` table exists.
 *  5. encrypt() / decrypt() round-trip works correctly.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from '../lib/encryption.js';

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  ❌ ${label}${detail ? `: ${detail}` : ''}`);
  failed++;
}

// ── 1. Env vars ──────────────────────────────────────────────────────────────
console.log('\n[1] Environment variables');

if (process.env.SUPABASE_URL) ok('SUPABASE_URL is set');
else fail('SUPABASE_URL is missing');

if (process.env.SUPABASE_SERVICE_ROLE_KEY) ok('SUPABASE_SERVICE_ROLE_KEY is set');
else fail('SUPABASE_SERVICE_ROLE_KEY is missing');

if (process.env.ENCRYPTION_KEY?.length === 64) ok('ENCRYPTION_KEY is set and 64 chars');
else fail('ENCRYPTION_KEY is missing or wrong length', `got ${process.env.ENCRYPTION_KEY?.length ?? 0} chars`);

// ── 2. Encryption round-trip ──────────────────────────────────────────────────
console.log('\n[2] Encryption round-trip');

try {
  const original = 'test-jira-api-token-abc123';
  const ciphertext = encrypt(original);
  const roundtrip = decrypt(ciphertext);

  if (roundtrip === original) ok('encrypt() → decrypt() returns original plaintext');
  else fail('Round-trip mismatch', `got "${roundtrip}"`);

  // Ensure each encrypt call produces a different ciphertext (random IV)
  const ct2 = encrypt(original);
  if (ciphertext !== ct2) ok('Each encrypt() call produces a unique ciphertext (random IV)');
  else fail('IVs are not random — two encryptions of the same plaintext match');
} catch (err) {
  fail('Encryption round-trip threw', err.message);
}

// ── 3. Supabase connectivity + profiles table ─────────────────────────────────
console.log('\n[3] Supabase connectivity');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('  ⏭  Skipping Supabase checks (env vars missing)');
} else {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Probe: select 0 rows from profiles — fails if table doesn't exist
    const { error } = await supabase.from('profiles').select('id').limit(0);

    if (!error) {
      ok('Connected to Supabase successfully');
      ok('`profiles` table exists and is queryable');
    } else if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
      ok('Connected to Supabase successfully');
      fail('`profiles` table does not exist — run the SQL migration from summary.md');
    } else if (error.message.toLowerCase().includes('invalid api key') ||
               error.message.toLowerCase().includes('apikey') ||
               error.message.toLowerCase().includes('jwt')) {
      fail('Supabase auth failed — check SUPABASE_SERVICE_ROLE_KEY', error.message);
    } else {
      ok('Connected to Supabase successfully');
      fail('Unexpected profiles query error', error.message);
    }
  } catch (netErr) {
    fail('Could not connect to Supabase', netErr.message);
  }

  // Probe RLS: verify service-role can read the table schema by counting rows
  try {
    const { count, error: countErr } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (!countErr) {
      ok(`Service-role client has full read access to \`profiles\` (${count ?? 0} rows)`);
    } else {
      fail('Service-role read from `profiles` failed', countErr.message);
    }
  } catch (e) {
    fail('Read probe threw', e.message);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`\n── Result: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
