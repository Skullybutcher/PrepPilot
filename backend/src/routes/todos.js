import { Router } from 'express';
import { searchIssues } from '../jira/client.js';

const router = Router();

router.get('/today', async (req, res) => {
  try {
    const jql = `project = ${process.env.JIRA_PROJECT_KEY} AND issuetype = Subtask ORDER BY updated DESC`;
    const result = await searchIssues(jql, ['summary', 'status', 'labels']);
    const issues = result.issues ?? [];

    const todos = issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      track: issue.fields.labels?.[0] || 'unknown',
    }));

    res.json({ date: new Date().toISOString().split('T')[0], todos });
  } catch (err) {
    console.error('Failed to fetch today todos:', err.message);
    res.status(500).json({ error: 'Failed to fetch today todos' });
  }
});

export default router;