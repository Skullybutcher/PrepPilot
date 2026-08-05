import { Router } from 'express';
import { searchIssues, jiraRequest, transitionIssue} from '../jira/client.js';

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

    // Auto-start: anything still "To Do" when first viewed today moves to "In Progress"
    await Promise.all(
      todos
        .filter((t) => t.status === 'To Do')
        .map(async (t) => {
          try {
            await transitionIssue(t.key, 'In Progress');
            t.status = 'In Progress'; // reflect it in this same response
          } catch (err) {
            console.error(`Auto-transition failed for ${t.key}:`, err.message);
            // leave status as-is, don't fail the whole request over one issue
          }
        })
    );

    res.json({ date: new Date().toISOString().split('T')[0], todos });
  } catch (err) {
    console.error('Failed to fetch today todos:', err.message);
    res.status(500).json({ error: 'Failed to fetch today todos' });
  }
});

router.get('/:key/transitions', async (req, res) => {
  try {
    const data = await jiraRequest(`/issue/${req.params.key}/transitions`);
    res.json(data.transitions.map((t) => ({ name: t.name, targetStatus: t.to.name })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:key/status', async (req, res) => {
  const { key } = req.params;
  const { transition } = req.body;
  if (!transition) return res.status(400).json({ error: 'transition is required' });
  try {
    await transitionIssue(key, transition);
    res.json({ key, transition });
  } catch (err) {
    console.error('Failed to transition issue:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;