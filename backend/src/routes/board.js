import { Router } from 'express';
import { searchIssues } from '../jira/client.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const jql = `project = ${process.env.JIRA_PROJECT_KEY} ORDER BY updated DESC`;
    const result = await searchIssues(jql, ['summary', 'status', 'issuetype']);
    const issues = result.issues ?? [];

    const columns = { 'To Do': [], 'In Progress': [], Done: [] };
    issues.forEach((issue) => {
      const status = issue.fields.status.name;
      const bucket = columns[status] ? status : 'To Do';
      columns[bucket].push({
        key: issue.key,
        summary: issue.fields.summary,
        type: issue.fields.issuetype.name,
      });
    });

    res.json(columns);
  } catch (err) {
    console.error('Failed to fetch board:', err.message);
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

export default router;