/**
 * user.js — User profile routes (Jira credential management)
 *
 * POST /api/user/jira-config  — upsert the authenticated user's Jira credentials
 * GET  /api/user/jira-config  — retrieve the authenticated user's Jira config (token masked)
 *
 * Credentials are stored in Supabase PostgreSQL `profiles` table.
 * The Jira API token is AES-256-GCM encrypted before storage.
 *
 * Required Supabase table (run in Supabase SQL editor):
 * ---------------------------------------------------------------------------
 *   create table if not exists profiles (
 *     id               uuid primary key references auth.users(id) on delete cascade,
 *     jira_base_url    text,
 *     jira_email       text,
 *     encrypted_jira_token text,
 *     jira_project_key text,
 *     updated_at       timestamptz default now()
 *   );
 *
 *   -- Row-Level Security: users can only access their own row
 *   alter table profiles enable row level security;
 *   create policy "Users manage own profile"
 *     on profiles for all
 *     using  (auth.uid() = id)
 *     with check (auth.uid() = id);
 * ---------------------------------------------------------------------------
 *
 * Note: The backend uses the service-role key (bypasses RLS) so we enforce
 * access ourselves via req.userId set by the requireAuth middleware.
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// Supabase admin client (service-role — bypasses RLS; we enforce access manually)
// ---------------------------------------------------------------------------
let _adminClient = null;

function getAdminClient() {
  if (_adminClient) return _adminClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  _adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _adminClient;
}

// ---------------------------------------------------------------------------
// POST /api/user/jira-config
// Body: { jiraBaseUrl, jiraEmail, jiraApiToken, jiraProjectKey }
// ---------------------------------------------------------------------------
router.post('/jira-config', requireAuth, async (req, res) => {
  const { jiraBaseUrl, jiraEmail, jiraApiToken, jiraProjectKey } = req.body;

  if (!jiraBaseUrl || !jiraEmail || !jiraApiToken || !jiraProjectKey) {
    return res.status(400).json({
      error: 'All four fields are required: jiraBaseUrl, jiraEmail, jiraApiToken, jiraProjectKey',
    });
  }

  // Encrypt the API token before persisting
  let encryptedToken;
  try {
    encryptedToken = encrypt(jiraApiToken);
  } catch (err) {
    // ENCRYPTION_KEY not configured — warn and store placeholder in dev
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[user] ENCRYPTION_KEY not set — storing token unencrypted in dev mode');
      encryptedToken = `plaintext:${jiraApiToken}`;
    } else {
      return res.status(500).json({ error: 'Encryption service not configured' });
    }
  }

  let supabase;
  try {
    supabase = getAdminClient();
  } catch (err) {
    // Supabase not configured — local dev mode, just return ok
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[user] Supabase not configured — skipping DB write in dev mode');
      return res.json({ ok: true });
    }
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { error } = await supabase.from('profiles').upsert(
    {
      id:                    req.userId,
      jira_base_url:         jiraBaseUrl.trim().replace(/\/$/, ''), // strip trailing slash
      jira_email:            jiraEmail.trim().toLowerCase(),
      encrypted_jira_token:  encryptedToken,
      jira_project_key:      jiraProjectKey.trim().toUpperCase(),
      updated_at:            new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('[user] Supabase upsert error:', error.message);
    return res.status(500).json({ error: 'Failed to save configuration' });
  }

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/user/jira-config
// Returns the stored Jira config with the token masked (***).
// Used by the Settings page to show current configuration.
// ---------------------------------------------------------------------------
router.get('/jira-config', requireAuth, async (req, res) => {
  let supabase;
  try {
    supabase = getAdminClient();
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return res.json(null);
    }
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('jira_base_url, jira_email, jira_project_key, updated_at')
    .eq('id', req.userId)
    .single();

  if (error || !data) {
    return res.json(null); // No config saved yet
  }

  res.json({
    jiraBaseUrl:    data.jira_base_url,
    jiraEmail:      data.jira_email,
    jiraApiToken:   '••••••••', // never return the real token
    jiraProjectKey: data.jira_project_key,
    updatedAt:      data.updated_at,
  });
});

// ---------------------------------------------------------------------------
// Internal helper — fetch and decrypt a user's Jira credentials from Supabase.
// Called by Jira route handlers that need dynamic credentials.
//
// Returns: { jiraBaseUrl, jiraEmail, jiraApiToken, jiraProjectKey }
// Throws if credentials are not found or Supabase is unavailable.
// ---------------------------------------------------------------------------
export async function getUserJiraCredentials(userId) {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('jira_base_url, jira_email, encrypted_jira_token, jira_project_key')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error('Jira credentials not found. Please configure your Jira account in Settings.');
  }

  let jiraApiToken;
  try {
    // Handle dev-mode plaintext fallback
    if (data.encrypted_jira_token?.startsWith('plaintext:')) {
      jiraApiToken = data.encrypted_jira_token.slice('plaintext:'.length);
    } else {
      jiraApiToken = decrypt(data.encrypted_jira_token);
    }
  } catch (err) {
    throw new Error(`Failed to decrypt Jira token: ${err.message}`);
  }

  return {
    jiraBaseUrl:    data.jira_base_url,
    jiraEmail:      data.jira_email,
    jiraApiToken,
    jiraProjectKey: data.jira_project_key,
  };
}

export default router;
