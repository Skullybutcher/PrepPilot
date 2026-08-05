import fetch from 'node-fetch';
import 'dotenv/config';

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env;

function authHeader() {
  const token = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return `Basic ${token}`;
}

export async function jiraRequest(path, options = {}) {
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error(
      'Missing Jira credentials. Copy .env.example to .env and fill in JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.'
    );
  }

  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3${path}`, {
    ...options,
    headers: {
      Authorization: authHeader(),
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

/** Search issues via JQL. Used to pull current board state / velocity. */
export async function searchIssues(jql, fields = ['summary', 'status', 'labels', 'worklog']) {
  const params = new URLSearchParams();
  params.set('jql', jql);

  const normalizedFields = Array.isArray(fields) ? fields : ['summary', 'status', 'labels', 'worklog'];
  if (normalizedFields.length > 0) {
    params.set('fields', normalizedFields.join(','));
  }

  return jiraRequest(`/search/jql?${params.toString()}`, {
    method: 'GET',
  });
}

/** Create an issue (Epic, Story, or Subtask). */
export async function createIssue({ summary, issueType, parentKey, labels = [], description }) {
  const fields = {
    project: { key: JIRA_PROJECT_KEY },
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

  return jiraRequest('/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
}

/** Transition an issue's status (e.g. mark a subtask Done). */
export async function transitionIssue(issueKey, transitionName) {
  const transitions = await jiraRequest(`/issue/${issueKey}/transitions`);
  const match = transitions.transitions.find(
    (t) => t.name.toLowerCase() === transitionName.toLowerCase()
  );
  if (!match) {
    throw new Error(`No transition named "${transitionName}" found for ${issueKey}`);
  }
  return jiraRequest(`/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: match.id } }),
  });
}

/** Fetch worklogs for an issue (used for pace/velocity calculation). */
export async function getWorklogs(issueKey) {
  return jiraRequest(`/issue/${issueKey}/worklog`);
}

export const projectKey = JIRA_PROJECT_KEY;
