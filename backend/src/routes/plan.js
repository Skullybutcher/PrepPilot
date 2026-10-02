// FR7 — Conversational Plan Builder
// POST /api/plan/chat  — multi-turn NIM conversation; extracts proposedConfig from reply
// POST /api/plan/apply — validates and atomically writes an approved config to disk

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { nimChat } from '../nim/client.js';

const router = Router();

const CONFIG_PATH = path.resolve('src/config/roadmap.config.json');
const STRIVER_PATH = path.resolve('src/data/striver-a2z.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function buildStriverSummary(sheet) {
  return sheet.steps.map((step) => {
    let stepTotal = 0, stepDone = 0;
    step.subSteps.forEach((sub) =>
      sub.problems.forEach((p) => {
        stepTotal++;
        if (p.status === 'done') stepDone++;
      })
    );
    return { stepId: step.stepId, stepName: step.stepName, done: stepDone, total: stepTotal };
  });
}

// ---------------------------------------------------------------------------
// POST /api/plan/chat
// ---------------------------------------------------------------------------
router.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '`messages` must be a non-empty array' });
  }

  // Load fresh on every request so config edits are reflected immediately
  let config, striverSummary;
  try {
    config = loadJson(CONFIG_PATH);
    const sheet = loadJson(STRIVER_PATH);
    striverSummary = buildStriverSummary(sheet);
  } catch (err) {
    return res.status(500).json({ error: `Failed to load context files: ${err.message}` });
  }

  // Detect whether the first user message is a structured context dump from the
  // PlanSetupModal (starts with "Goal:"). If so, extract it and embed it into
  // the system prompt so the model has the full context in its instructions.
  const firstUser = messages[0];
  let initialContextBlock = '';
  if (firstUser?.role === 'user' && /^Goal:/m.test(firstUser.content)) {
    initialContextBlock = `\n\nUser's preparation context (from onboarding form):\n${firstUser.content}`;
  }

  const systemPrompt = `You are a placement-prep roadmap assistant. Your job is to help the user create or revise their structured roadmap config.${initialContextBlock}

Current roadmap config (JSON):
\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

Current Striver A2Z progress (done/total per step):
${JSON.stringify(striverSummary, null, 2)}

When proposing changes to the config, output the full updated config as a fenced JSON block:
\`\`\`json
{ ... full RoadmapConfig ... }
\`\`\`

Only include the fenced block when you are proposing a concrete config change. Do not include it for general questions or clarifications. The user must explicitly confirm before changes are applied — never overwrite the config without approval.`;

  const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages];

  const primaryModel = process.env.NIM_CHAT_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b';
  const fallbackModel = process.env.NIM_CHAT_MODEL_FALLBACK || 'nvidia/nemotron-3-super-120b-a12b';

  let reply;
  try {
    reply = await nimChat({ messages: fullMessages, model: primaryModel, maxTokens: 4096 });
  } catch (primaryErr) {
    try {
      reply = await nimChat({ messages: fullMessages, model: fallbackModel, maxTokens: 4096 });
    } catch (fallbackErr) {
      return res.status(502).json({ error: `NIM call failed: ${fallbackErr.message}` });
    }
  }

  // Extract a fenced ```json ... ``` block if present — that's the proposedConfig
  let proposedConfig;
  const fenceMatch = reply.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      proposedConfig = JSON.parse(fenceMatch[1].trim());
    } catch {
      // Malformed JSON block — surface reply as-is without proposedConfig
    }
  }

  const response = { reply };
  if (proposedConfig !== undefined) response.proposedConfig = proposedConfig;
  res.json(response);
});

// ---------------------------------------------------------------------------
// POST /api/plan/apply
// ---------------------------------------------------------------------------
router.post('/apply', (req, res) => {
  const { config } = req.body;

  // Minimal validation per plan.md contract
  if (!config || typeof config.startDate !== 'string') {
    return res.status(400).json({ error: 'config.startDate (string) is required' });
  }
  if (!Array.isArray(config.quarters) || config.quarters.length === 0) {
    return res.status(400).json({ error: 'config.quarters must be a non-empty array' });
  }
  if (typeof config.recoveryWeekEveryNWeeks !== 'number') {
    return res.status(400).json({ error: 'config.recoveryWeekEveryNWeeks (number) is required' });
  }

  const tmpPath = CONFIG_PATH + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpPath, CONFIG_PATH);
  } catch (err) {
    return res.status(500).json({ error: `Failed to write config: ${err.message}` });
  }

  res.json({ ok: true });
});

export default router;
