const BASE = import.meta.env.VITE_API_URL;

export async function getTodayTodos() {
  const res = await fetch(`${BASE}/todos/today`);
  if (!res.ok) throw new Error('Failed to load todos');
  return res.json();
}

export async function getBoard() {
  const res = await fetch(`${BASE}/board`);
  if (!res.ok) throw new Error('Failed to load board');
  return res.json();
}

export async function getProgress() {
  const res = await fetch(`${BASE}/progress`);
  if (!res.ok) throw new Error('Failed to load progress');
  return res.json();
}

export async function transitionTodo(key, transitionName) {
  const res = await fetch(`${BASE}/todos/${key}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: transitionName }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to update status');
  return res.json();
}

export async function updateStatus(key, status) {
  const res = await fetch(`${BASE}/todos/${key}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to update status');
  return res.json();
}