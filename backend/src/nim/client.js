// Thin client for NVIDIA NIM's OpenAI-compatible chat completions endpoint.
// Used by generator/rebalanceSuggestion.js (FR6) and, later, the FR7 plan
// chat endpoint. Kept generic on purpose — no FR6-specific logic here.

import fetch from 'node-fetch';
import 'dotenv/config';

const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
// Prefer a Mistral-based model by default where available; fall back to Nemotron otherwise.
const DEFAULT_MODEL = 'mistralai/mistral-nemotron';

/**
 * Call NIM's chat completions endpoint and return the assistant's raw
 * message content (string). Callers that need structured output should
 * pass responseFormat: 'json_object' and parse the result themselves —
 * this function stays a plain string in/out wrapper.
 *
 * @param {object} params
 * @param {{role: string, content: string}[]} params.messages
 * @param {string} [params.model] - defaults to NIM_MODEL env var, then Nemotron 3 Nano
 * @param {'json_object'|undefined} [params.responseFormat]
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 */
export async function nimChat({
  messages,
  model = process.env.NIM_MODEL || DEFAULT_MODEL,
  responseFormat,
  temperature = 0.3,
  maxTokens = 1024,
}) {
  const { NIM_API_KEY } = process.env;
  if (!NIM_API_KEY) {
    throw new Error('Missing NIM_API_KEY. Copy .env.example to .env and fill in NIM_API_KEY.');
  }

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${NIM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NIM_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NIM API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error(`NIM API returned no content: ${JSON.stringify(data)}`);
  }
  return content;
}
