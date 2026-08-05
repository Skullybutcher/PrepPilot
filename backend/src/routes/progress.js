import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const STRIVER_PATH = path.resolve('src/data/striver-a2z.json');

router.get('/', async (req, res) => {
  try {
    const sheet = JSON.parse(await fs.readFile(STRIVER_PATH, 'utf-8'));

    let total = 0, done = 0;
    const byStep = sheet.steps.map((step) => {
      let stepTotal = 0, stepDone = 0;
      step.subSteps.forEach((sub) =>
        sub.problems.forEach((p) => {
          stepTotal++; total++;
          if (p.status === 'done') { stepDone++; done++; }
        })
      );
      return { stepId: step.stepId, stepName: step.stepName, done: stepDone, total: stepTotal };
    });

    res.json({ dsa: { done, total, percent: Math.round((done / total) * 100), byStep } });
  } catch (err) {
    console.error('Failed to compute progress:', err.message);
    res.status(500).json({ error: 'Failed to compute progress' });
  }
});

export default router;