/**
 * auth.js — Express middleware that verifies a Supabase JWT and attaches
 * the authenticated user's ID to `req.userId`.
 *
 * Requires env vars:
 *   SUPABASE_URL      — e.g. https://xyzabc.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service-role key (never the anon key)
 *
 * Usage:
 *   import { requireAuth } from '../middleware/auth.js';
 *   router.post('/secure-endpoint', requireAuth, handler);
 *
 * The client must send:
 *   Authorization: Bearer <supabase-access-token>
 */

import { createClient } from '@supabase/supabase-js';

let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. ' +
      'These are required for JWT verification.'
    );
  }

  _supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabase;
}

/**
 * Express middleware. Extracts and verifies the Bearer token from the
 * Authorization header. On success, sets req.userId = user.id and calls next().
 * On failure, returns 401.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    // Supabase not configured — for local development without Supabase, bypass auth
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] Supabase not configured — bypassing auth in dev mode');
      req.userId = 'dev-user';
      return next();
    }
    return res.status(500).json({ error: 'Auth service not configured' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = user.id;
  next();
}
