/**
 * jira/client.js — Jira REST API wrapper
 *
 * Credential resolution order (per request):
 *  1. If `creds` argument is passed (from getUserJiraCredentials), use those.
 *  2. Fall back to JIRA_* env vars (CLI scripts, GitHub Actions, local dev).
 *
 * This lets HTTP routes use per-user Supabase credentials while existing
 * scripts (generateDailyTodos, weeklyRebalanceCheck) keep using env vars.
 */

import fetch from 'node-fetch';
import 'dotenv/config';

/**
 * Resolve Jira credentials from an explicit creds object or env vars.
 * @param {object|undefined} creds - optional { jiraBaseUrl, jiraEmail, jiraApiToken, jiraProjectKey }
 * @returns {{ baseUrl: string, email: string, token: string, projectKey: string }}
 */
function resolveCreds(creds) {
  if (creds) {
    const { jiraBaseUrl, jiraEmail, jiraApiToken, jiraProjectKey } = creds;
    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken || !jiraProjectKey) {
      throw new Error('Incomplete Jira credentials passed to jiraRequest');
    }
    return { baseUrl: jiraBaseUrl, email: jiraEmail, token: jiraApiToken, projectKey: jiraProjectKey };
  }

  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env;
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error(
      'Missing Jira credentials. Copy .env.example to .env and fill in JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.'
    );
  }
  return { baseUrl: JIRA_BASE_URL, email: JIRA_EMAIL, token: JIRA_API_TOKEN, projectKey: JIRA_PROJECT_KEY };
}

function authHeader(email, token) {
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

/**
 * Make an authenticated Jira REST API v3 request.
 *
 * @param {string} path   - e.g. '/issue/PROJ-1'
 * @param {object} options - fetch options (method, body, headers, ...)
 * @param {object} [creds] - optional per-user credentials override
 */
export async function jiraRequest(path, options = {}, creds) {
  const { baseUrl, email, token } = resolveCreds(creds);

  const res = await fetch(`${baseUrl}/rest/api/3${path}`, {
    ...options,
    headers: {
      Authorization: authHeader(email, token),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira API error ${res.status} on ${path}: ${body}`);
  }

  // Some Jira endpoints (e.g. DELETE) return no content
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Search issues via JQL.
 * @param {string} jql
 * @param {string[]} fields
 * @param {object} [creds]
 */
export async function searchIssues(jql, fields = ['summary', 'status', 'labels', 'worklog'], creds) {
  const params = new URLSearchParams();
  params.set('jql', jql);

  const normalizedFields = Array.isArray(fields) ? fields : ['summary', 'status', 'labels', 'worklog'];
  if (normalizedFields.length > 0) {
    params.set('fields', normalizedFields.join(','));
  }

  return jiraRequest(`/search/jql?${params.toString()}`, { method: 'GET' }, creds);
}

/**
 * Create an issue (Epic, Story, or Subtask).
 * @param {object} params
 * @param {object} [creds]
 */
export async function createIssue({ summary, issueType, parentKey, labels = [], description }, creds) {
  const { projectKey } = resolveCreds(creds);

  const fields = {
    project: { key: projectKey },
    summary,
    issuetype: { id: issueType },
    labels,
  };

  if (description) {
    fields.description = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }],
    };
  }

  if (parentKey) {
    fields.parent = { key: parentKey };
  }

  return jiraRequest('/issue', { method: 'POST', body: JSON.stringify({ fields }) }, creds);
}

/**
 * Transition an issue's status (e.g. mark a subtask Done).
 * @param {string} issueKey
 * @param {string} transitionName
 * @param {object} [creds]
 */
export async function transitionIssue(issueKey, transitionName, creds) {
  const transitions = await jiraRequest(`/issue/${issueKey}/transitions`, {}, creds);
  const match = transitions.transitions.find(
    (t) => t.name.toLowerCase() === transitionName.toLowerCase()
  );
  if (!match) {
    throw new Error(`No transition named "${transitionName}" found for ${issueKey}`);
  }
  return jiraRequest(
    `/issue/${issueKey}/transitions`,
    { method: 'POST', body: JSON.stringify({ transition: { id: match.id } }) },
    creds
  );
}

/**
 * Fetch worklogs for an issue.
 * @param {string} issueKey
 * @param {object} [creds]
 */
export async function getWorklogs(issueKey, creds) {
  return jiraRequest(`/issue/${issueKey}/worklog`, {}, creds);
}

/**
 * Fetch an issue's changelog.
 * @param {string} issueKey
 * @param {object} [creds]
 */
export async function getIssueChangelog(issueKey, creds) {
  return jiraRequest(`/issue/${issueKey}/changelog`, {}, creds);
}

// Re-export for callers that still use the old module-level constant
export const projectKey = process.env.JIRA_PROJECT_KEY;
