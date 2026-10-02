/**
 * api.js — PrepPilot API client
 *
 * BASE URL resolution order:
 *  1. VITE_API_URL env var (set on Vercel for production)
 *  2. Falls back to '/api' (Vite dev proxy → localhost:4000)
 *
 * If VITE_API_URL is explicitly set but points to an unreachable host,
 * fetch will throw a network error with a clear message rather than the
 * cryptic "Unexpected token '<'" HTML-parse error that happens when
 * Vercel's SPA router intercepts the request.
 */
import { supabase } from './lib/supabase';

const BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Returns the Authorization header for the current Supabase session, or
 * an empty object if there is no active session (unauthenticated routes).
 */
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

/** Wraps fetch: throws a human-readable error on non-2xx or HTML responses */
async function apiFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    throw new Error(
      `Network error — cannot reach backend at ${BASE}. ` +
      `Check that VITE_API_URL is set correctly (current: "${BASE}"). ` +
      `Original: ${networkErr.message}`
    );
  }

  // Detect Vercel SPA fallback (HTML served instead of JSON)
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || contentType.includes('text/html')) {
    const bodyText = await res.text();
    if (contentType.includes('text/html')) {
      throw new Error(
        `Backend URL misconfigured — got an HTML page instead of JSON. ` +
        `Set VITE_API_URL to your backend URL (e.g. https://<app>.onrender.com/api). ` +
        `Current BASE: "${BASE}"`
      );
    }
    let errMsg = `Request failed (${res.status})`;
    try { errMsg = JSON.parse(bodyText).error || errMsg; } catch (_) {}
    throw new Error(errMsg);
  }

  return res.json();
}

export async function getTodayTodos() {
  return apiFetch(`${BASE}/todos/today`);
}

export async function getBoard() {
  return apiFetch(`${BASE}/board`);
}

export async function getProgress() {
  return apiFetch(`${BASE}/progress`);
}

export async function transitionTodo(key, transitionName) {
  return apiFetch(`${BASE}/todos/${key}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: transitionName }),
  });
}

export async function updateStatus(key, status) {
  return apiFetch(`${BASE}/todos/${key}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export const planChat = (messages) =>
  apiFetch(`${BASE}/plan/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

export const planApply = (config) =>
  apiFetch(`${BASE}/plan/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });

export const getLatestRebalance = () =>
  fetch(`${BASE}/rebalance/latest`)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null);

export const approveRebalance = () =>
  apiFetch(`${BASE}/rebalance/approve`, { method: 'POST' });

// ---------------------------------------------------------------------------
// User / Jira config (Phase D — authenticated routes)
// ---------------------------------------------------------------------------

/**
 * Save (upsert) the current user's Jira credentials.
 * Attaches the Supabase session JWT as Authorization header.
 * @param {{ jiraBaseUrl, jiraEmail, jiraApiToken, jiraProjectKey }} config
 */
export async function saveJiraConfig(config) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  };
  return apiFetch(`${BASE}/user/jira-config`, {
    method: 'POST',
    headers,
    body: JSON.stringify(config),
  });
}

/**
 * Fetch the current user's stored Jira config (token masked).
 * Returns null if no config has been saved yet.
 */
export async function getJiraConfig() {
  const headers = await authHeaders();
  return apiFetch(`${BASE}/user/jira-config`, { headers });
}
